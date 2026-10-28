import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import worker from '../worker/cloudflare-media.js';
import { checkMediaManifest, mediaManifest } from '../scripts/check-cloudflare-worker.mjs';

const payload = Uint8Array.from({ length: 257 }, (_, index) => index % 251);
const modified = 'Wed, 28 Oct 2026 10:00:00 GMT';
const served = 'Wed, 28 Oct 2026 10:05:00 GMT';

function fixture({
  status = 200,
  headers = {},
  chunkSize = 16,
  data = payload,
  omitLength = false,
} = {}) {
  let resolveCancellation;
  const state = {
    requests: [],
    pulls: 0,
    cancelled: 0,
    readBytes: 0,
    cancellation: new Promise((resolve) => {
      resolveCancellation = resolve;
    }),
  };
  const env = {
    ASSETS: {
      async fetch(request) {
        state.requests.push(request);
        let position = 0;
        const body = new ReadableStream({
          pull(controller) {
            state.pulls += 1;
            if (position === data.length) {
              controller.close();
              return;
            }
            const next = data.slice(position, position + chunkSize);
            position += next.length;
            state.readBytes += next.length;
            controller.enqueue(next);
          },
          cancel() {
            state.cancelled += 1;
            resolveCancellation();
          },
        });
        const response = new Response(request.method === 'HEAD' ? null : body, {
          status,
          headers: {
            'Content-Type': 'video/mp4',
            'Content-Length': String(data.length),
            ETag: '"fixture-v1"',
            'Last-Modified': modified,
            Date: served,
            'Content-Disposition': 'inline; filename="fixture.mp4"',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=0, must-revalidate',
            ...headers,
          },
        });
        if (omitLength) response.headers.delete('Content-Length');
        // A media handler must consume the body as a stream, not materialize it.
        for (const name of ['arrayBuffer', 'bytes', 'blob', 'text', 'json']) {
          response[name] = () => {
            throw new Error(`Whole-response ${name} is forbidden`);
          };
        }
        return response;
      },
    },
  };
  return { env, state };
}

async function call(headers = {}, options = {}) {
  const source = fixture(options);
  const request = new Request('https://portfolio.example/assets/fixture.mp4', {
    method: options.method || 'GET',
    headers,
  });
  const response = await worker.fetch(request, source.env);
  return { ...source, response, request };
}

async function bytes(response) {
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return new Uint8Array(Buffer.concat(chunks));
}

test('media ranges return the exact requested bytes and preserve representation headers', async () => {
  for (const [range, start, end] of [
    ['bytes=0-7', 0, 7],
    ['bytes=15-32', 15, 32],
    ['bytes=250-', 250, 256],
    ['bytes=-8', 249, 256],
    ['bytes=-9999', 0, 256],
    ['bytes=250-9999', 250, 256],
  ]) {
    const { response } = await call({ Range: range });
    assert.equal(response.status, 206, range);
    assert.equal(response.headers.get('Content-Range'), `bytes ${start}-${end}/257`);
    assert.equal(response.headers.get('Content-Length'), String(end - start + 1));
    assert.equal(response.headers.get('Accept-Ranges'), 'bytes');
    assert.equal(response.headers.get('Content-Type'), 'video/mp4');
    assert.equal(response.headers.get('ETag'), '"fixture-v1"');
    assert.equal(response.headers.get('Last-Modified'), modified);
    assert.equal(response.headers.get('Content-Disposition'), 'inline; filename="fixture.mp4"');
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
    assert.deepEqual(await bytes(response), payload.slice(start, end + 1), range);
  }
});

test('valid but unsatisfiable ranges return an empty 416 with the actual complete size', async () => {
  for (const range of ['bytes=257-', 'bytes=900-999', 'bytes=-0']) {
    const { response, state } = await call({ Range: range });
    assert.equal(response.status, 416, range);
    assert.equal(response.headers.get('Content-Range'), 'bytes */257');
    assert.equal((await bytes(response)).length, 0);
    assert.ok(state.readBytes <= 32, 'unsatisfiable range must not consume the media');
    assert.equal(state.cancelled, 1, 'unused source stream must be cancelled');
  }
});

test('unsupported or malformed ranges keep a complete response without a false 206', async () => {
  for (const range of ['items=0-3', 'bytes=0-3,7-9', 'bytes=hello', 'bytes=']) {
    const { response } = await call({ Range: range });
    assert.equal(response.status, 200, range);
    assert.equal(response.headers.get('Content-Range'), null);
    assert.deepEqual(await bytes(response), payload);
  }
});

test('range processing obtains one identity representation without upstream range or cache validators', async () => {
  const { response, state, request } = await call({
    Range: 'bytes=3-12',
    'If-Range': '"fixture-v1"',
    'If-None-Match': '"other-version"',
    'If-Modified-Since': 'Wed, 28 Oct 2026 09:00:00 GMT',
    'Accept-Encoding': 'gzip, br',
  });
  assert.equal(response.status, 206);
  await bytes(response);
  assert.equal(state.requests.length, 1);
  const upstream = state.requests[0];
  for (const name of ['Range', 'If-Range', 'If-None-Match', 'If-Modified-Since']) {
    assert.equal(upstream.headers.get(name), null, name);
  }
  assert.equal(upstream.headers.get('Accept-Encoding'), 'identity');
  assert.equal(request.headers.get('Range'), 'bytes=3-12', 'caller request remains unchanged');
});

test('If-Range requires the current strong ETag or a strong exact modification date', async () => {
  for (const validator of ['"fixture-v1"', modified]) {
    const { response } = await call({ Range: 'bytes=0-3', 'If-Range': validator });
    assert.equal(response.status, 206, validator);
    assert.deepEqual(await bytes(response), payload.slice(0, 4));
  }
  for (const validator of [
    '"old-version"',
    'W/"fixture-v1"',
    'Wed, 28 Oct 2026 09:00:00 GMT',
    'Wed, 28 Oct 2026 11:00:00 GMT',
    'not-a-validator',
  ]) {
    const { response } = await call({ Range: 'bytes=0-3', 'If-Range': validator });
    assert.equal(response.status, 200, validator);
    assert.equal(response.headers.get('Content-Range'), null);
    assert.deepEqual(await bytes(response), payload);
  }
  const { response } = await call(
    { Range: 'bytes=0-3', 'If-Range': modified },
    { headers: { Date: 'Wed, 28 Oct 2026 10:00:20 GMT' } },
  );
  assert.equal(response.status, 200, 'recent modification date is not a strong validator');
});

test('conditional GET takes priority over Range and weak If-None-Match comparison is supported', async () => {
  for (const validators of [
    { 'If-None-Match': 'W/"fixture-v1"' },
    { 'If-None-Match': '"other", "fixture-v1"' },
    { 'If-None-Match': '*' },
    { 'If-Modified-Since': served },
  ]) {
    const { response, state } = await call({ Range: 'bytes=0-3', ...validators });
    assert.equal(response.status, 304);
    assert.equal(response.headers.get('Content-Range'), null);
    assert.equal(response.headers.get('ETag'), '"fixture-v1"');
    assert.equal((await bytes(response)).length, 0);
    assert.equal(state.cancelled, 1);
  }
  const { response } = await call({
    Range: 'bytes=0-3',
    'If-None-Match': '"other-version"',
    'If-Modified-Since': served,
  });
  assert.equal(response.status, 206, 'present nonmatching ETag overrides modification date');
  assert.deepEqual(await bytes(response), payload.slice(0, 4));
});

test('failed write preconditions return 412 before caching or Range conditions', async () => {
  for (const validators of [
    { 'If-Match': '"old-version"' },
    { 'If-Match': 'W/"fixture-v1"' },
    { 'If-Unmodified-Since': 'Wed, 28 Oct 2026 09:00:00 GMT' },
    { 'If-Match': '"old-version"', 'If-None-Match': '"fixture-v1"' },
  ]) {
    const { response, state } = await call({ Range: 'bytes=0-3', ...validators });
    assert.equal(response.status, 412);
    assert.equal(response.headers.get('Content-Range'), null);
    assert.equal((await bytes(response)).length, 0);
    assert.equal(state.cancelled, 1);
  }
  for (const validators of [
    { 'If-Match': '*' },
    { 'If-Unmodified-Since': modified },
    { 'If-Match': '"fixture-v1"', 'If-Unmodified-Since': 'Wed, 28 Oct 2026 09:00:00 GMT' },
  ]) {
    const { response } = await call({ Range: 'bytes=0-3', ...validators });
    assert.equal(response.status, 206);
    assert.deepEqual(await bytes(response), payload.slice(0, 4));
  }
});

test('unsafe length or encoded representations never become invented partial responses', async () => {
  for (const headers of [
    { 'Content-Length': 'unknown' },
    { 'Content-Length': '9007199254740992' },
    { 'Content-Encoding': 'gzip' },
  ]) {
    const { response } = await call({ Range: 'bytes=0-3' }, { headers });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Range'), null);
    assert.equal(response.headers.get('Accept-Ranges'), 'none');
    assert.deepEqual(await bytes(response), payload);
  }
});

test('an empty representation has no satisfiable byte range', async () => {
  const { response } = await call({ Range: 'bytes=0-' }, { data: new Uint8Array() });
  assert.equal(response.status, 416);
  assert.equal(response.headers.get('Content-Range'), 'bytes */0');
  assert.equal((await bytes(response)).length, 0);
});

test('HEAD ignores Range and retains complete representation metadata with no response body', async () => {
  const { response } = await call({ Range: 'bytes=0-3' }, { method: 'HEAD' });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Length'), '257');
  assert.equal(response.headers.get('Content-Range'), null);
  assert.equal((await bytes(response)).length, 0);
});

test('early ranges are streamed with bounded reads and cancel the unused source tail', async () => {
  const { response, state } = await call({ Range: 'bytes=3-20' });
  assert.ok(state.readBytes < payload.length, 'fetch must not eagerly read the complete asset');
  assert.deepEqual(await bytes(response), payload.slice(3, 21));
  assert.ok(state.readBytes <= 64, `only needed chunks plus bounded prefetch: ${state.readBytes}`);
  assert.equal(state.cancelled, 1);
});

test('downstream cancellation propagates to the source reader', async () => {
  const { response, state } = await call({ Range: 'bytes=0-250' });
  const reader = response.body.getReader();
  await reader.read();
  await reader.cancel('visitor left the case');
  assert.equal(state.cancelled, 1);
  assert.ok(state.readBytes < payload.length);
});

test('missing assets and upstream errors are preserved instead of being relabelled partial success', async () => {
  for (const status of [404, 412, 500]) {
    const { response } = await call({ Range: 'bytes=0-3' }, { status });
    assert.equal(response.status, status);
    assert.equal(response.headers.get('Content-Range'), null);
    assert.deepEqual(await bytes(response), payload);
  }
});

test('PDF ranges preserve their MIME type and exact signature bytes', async () => {
  const pdf = new TextEncoder().encode('%PDF-1.7\nfixture-document');
  const source = fixture({ headers: { 'Content-Type': 'application/pdf' }, data: pdf });
  const response = await worker.fetch(
    new Request('https://portfolio.example/assets/cv/fixture.pdf', {
      headers: { Range: 'bytes=0-4' },
    }),
    source.env,
  );
  assert.equal(response.status, 206);
  assert.equal(response.headers.get('Content-Type'), 'application/pdf');
  assert.deepEqual(await bytes(response), new TextEncoder().encode('%PDF-'));
});

test('every checked-in MP4 and PDF path can reach media range handling', async () => {
  const names = readdirSync(new URL('../public/assets/', import.meta.url), { recursive: true })
    .filter((name) => /\.(mp4|pdf)$/i.test(name))
    .sort();
  assert.ok(names.some((name) => name === 'origin-sky.mp4'));
  assert.equal(names.filter((name) => name.startsWith('cv/') && name.endsWith('.pdf')).length, 5);
  for (const name of names) {
    const type = name.endsWith('.pdf') ? 'application/pdf' : 'video/mp4';
    const source = fixture({ headers: { 'Content-Type': type } });
    const response = await worker.fetch(
      new Request(`https://portfolio.example/assets/${name}`, { headers: { Range: 'bytes=0-4' } }),
      source.env,
    );
    assert.equal(response.status, 206, name);
    assert.equal(response.headers.get('Content-Type'), type, name);
    assert.deepEqual(await bytes(response), payload.slice(0, 5), name);
  }
});

test('missing binding length uses the checked media manifest for Range and HEAD', async () => {
  const data = new Uint8Array(
    readFileSync(new URL('../public/assets/origin-sky.mp4', import.meta.url)),
  );
  const url = 'https://portfolio.example/assets/origin-sky.mp4';
  const source = fixture({ data, omitLength: true });
  const response = await worker.fetch(
    new Request(url, { headers: { Range: 'bytes=0-3' } }),
    source.env,
  );
  assert.equal(response.status, 206);
  assert.equal(response.headers.get('Content-Range'), `bytes 0-3/${data.length}`);
  assert.deepEqual(await bytes(response), data.slice(0, 4));

  const headSource = fixture({ data, omitLength: true });
  const head = await worker.fetch(new Request(url, { method: 'HEAD' }), headSource.env);
  assert.equal(head.status, 200);
  if (head.headers.has('Content-Length')) {
    assert.equal(head.headers.get('Content-Length'), String(data.length));
  }
  assert.equal(headSource.state.requests[0].method, 'HEAD');
  assert.equal((await bytes(head)).length, 0);

  const unknown = await call({ Range: 'bytes=0-3' }, { omitLength: true });
  assert.equal(unknown.response.status, 200, 'unknown paths must not invent a length');
  assert.equal(unknown.response.headers.get('Accept-Ranges'), 'none');
  assert.deepEqual(await bytes(unknown.response), payload);
});

test('manifest guard rejects changed bytes, changed sizes, missing and newly added media', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'portfolio-media-manifest-'));
  try {
    await mkdir(join(directory, 'assets'));
    const asset = join(directory, 'assets', 'fixture.mp4');
    await writeFile(asset, payload);
    const manifestPath = join(directory, 'expected.json');
    await writeFile(manifestPath, JSON.stringify(await mediaManifest(directory)));
    assert.equal(await checkMediaManifest(directory, manifestPath), 1);

    const changed = payload.slice();
    changed[0] ^= 1;
    await writeFile(asset, changed);
    await assert.rejects(() => checkMediaManifest(directory, manifestPath), /does not match/);
    await writeFile(asset, payload.slice(1));
    await assert.rejects(() => checkMediaManifest(directory, manifestPath), /does not match/);
    await writeFile(asset, payload);
    const extra = join(directory, 'assets', 'new.pdf');
    await writeFile(extra, '%PDF-1.7');
    await assert.rejects(() => checkMediaManifest(directory, manifestPath), /does not match/);
    await rm(asset);
    await assert.rejects(() => checkMediaManifest(directory, manifestPath), /does not match/);
    await rm(extra);
    await assert.rejects(() => checkMediaManifest(directory, manifestPath), /No MP4\/PDF/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('the checked-in manifest matches every current public media file on a fresh checkout', async () => {
  const directory = new URL('../public/', import.meta.url);
  const count = await checkMediaManifest(directory.pathname);
  const inventory = readdirSync(new URL('../public/assets/', import.meta.url), {
    recursive: true,
  }).filter((name) => /\.(mp4|pdf)$/.test(name));
  assert.equal(count, inventory.length);
});

test('nonmedia requests remain asset requests without altering their headers', async () => {
  const source = fixture();
  const request = new Request('https://portfolio.example/assets/app.js?version=1', {
    headers: { Range: 'bytes=0-4', 'If-None-Match': '"unrelated"' },
  });
  const response = await worker.fetch(request, source.env);
  assert.equal(response.status, 200);
  assert.equal(source.state.requests[0].url, request.url);
  assert.equal(source.state.requests[0].headers.get('Range'), 'bytes=0-4');
  assert.equal(source.state.requests[0].headers.get('If-None-Match'), '"unrelated"');
  assert.deepEqual(await bytes(response), payload);
});

test('deployment invokes the Worker only for media, including nested case paths', () => {
  const rawConfig = readFileSync(new URL('../wrangler.cloudflare.jsonc', import.meta.url), 'utf8');
  const config = JSON.parse(rawConfig.replace(/,\s*([}\]])/g, '$1'));
  assert.equal(config.name, 'alextish-portfolio-preview');
  assert.equal(config.env.production.name, 'alextish-portfolio');
  assert.equal(config.main, 'worker/cloudflare-media.js');
  assert.equal(config.assets.binding, 'ASSETS');
  assert.equal(config.assets.not_found_handling, '404-page');
  assert.deepEqual(config.assets.run_worker_first, ['/assets/*.mp4', '/assets/*.pdf']);
  assert.deepEqual(config.env.production.assets.run_worker_first, config.assets.run_worker_first);
  const expressions = config.assets.run_worker_first.map(
    (pattern) =>
      new RegExp(
        `^${pattern
          .split('*')
          .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('.*')}$`,
      ),
  );
  const matches = (path) => expressions.some((pattern) => pattern.test(path));
  for (const name of readdirSync(new URL('../public/assets/', import.meta.url), {
    recursive: true,
  })) {
    if (/\.(mp4|pdf)$/.test(name)) assert.equal(matches(`/assets/${name}`), true, name);
  }
  for (const path of [
    '/',
    '/full/',
    '/projects/example/',
    '/assets/app.js',
    '/assets/app.css',
    '/assets/photo.webp',
    '/release-source.json',
  ]) {
    assert.equal(matches(path), false, path);
  }
});

test('a source that ends before the promised range fails its stream instead of claiming complete data', async () => {
  const { response } = await call(
    { Range: 'bytes=250-299' },
    { headers: { 'Content-Length': '300' } },
  );
  assert.equal(response.status, 206);
  await assert.rejects(() => bytes(response), /ended before.*Content-Length/);
});

test(
  'the Workers fixed-length bridge preserves exact bytes, cancellation and source failure',
  { timeout: 2000 },
  async () => {
    const original = globalThis.FixedLengthStream;
    const lengths = [];
    globalThis.FixedLengthStream = class {
      constructor(length) {
        lengths.push(length);
        let count = 0;
        const stream = new TransformStream({
          transform(chunk, controller) {
            count += chunk.byteLength;
            if (count > length) throw new Error('FixedLengthStream received too many bytes');
            controller.enqueue(chunk);
          },
          flush() {
            if (count !== length) throw new Error('FixedLengthStream received too few bytes');
          },
        });
        this.readable = stream.readable;
        this.writable = stream.writable;
      }
    };
    try {
      const short = await call({ Range: 'bytes=3-20' });
      assert.deepEqual(await bytes(short.response), payload.slice(3, 21));
      await short.state.cancellation;
      assert.equal(short.state.cancelled, 1);
      assert.ok(short.state.readBytes < payload.length);

      const cancelled = await call({ Range: 'bytes=0-250' });
      const reader = cancelled.response.body.getReader();
      await reader.read();
      await reader.cancel('visitor left');
      await cancelled.state.cancellation;
      assert.equal(cancelled.state.cancelled, 1);
      assert.ok(cancelled.state.readBytes < payload.length);

      const truncated = await call(
        { Range: 'bytes=250-299' },
        { headers: { 'Content-Length': '300' } },
      );
      await assert.rejects(() => bytes(truncated.response), /ended before.*Content-Length/);
      assert.deepEqual(lengths, [18, 251, 50]);
    } finally {
      if (original === undefined) delete globalThis.FixedLengthStream;
      else globalThis.FixedLengthStream = original;
    }
  },
);
