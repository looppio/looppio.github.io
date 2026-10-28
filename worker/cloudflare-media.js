// Only the MP4/PDF paths configured in wrangler.cloudflare.jsonc run Worker-first.
// The ASSETS binding owns the files; this module makes no external requests.
import mediaManifest from './cloudflare-media-manifest.json' with { type: 'json' };

const conditionalHeaders = [
  'Range',
  'If-Range',
  'If-Match',
  'If-Unmodified-Since',
  'If-None-Match',
  'If-Modified-Since',
];

function httpDate(value) {
  if (!value || !/GMT$/.test(value)) return NaN;
  return Date.parse(value);
}

function tags(value) {
  // Commas are legal inside opaque tags, so splitting on commas is insufficient.
  return value?.match(/(?:W\/)?"[\x21\x23-\x7e\x80-\xff]*"/g) || [];
}

function matchesTag(condition, current, weak) {
  if (condition.trim() === '*') return true;
  if (!current) return false;
  const normalize = (value) => (weak ? value.replace(/^W\//, '') : value);
  return tags(condition).some(
    (tag) =>
      (weak || (!tag.startsWith('W/') && !current.startsWith('W/'))) &&
      normalize(tag) === normalize(current),
  );
}

function preconditionStatus(requestHeaders, responseHeaders) {
  const etag = responseHeaders.get('ETag');
  const modified = httpDate(responseHeaders.get('Last-Modified'));
  const ifMatch = requestHeaders.get('If-Match');
  if (ifMatch !== null) {
    if (!matchesTag(ifMatch, etag, false)) return 412;
  } else {
    const unmodified = httpDate(requestHeaders.get('If-Unmodified-Since'));
    if (Number.isFinite(unmodified) && modified > unmodified) return 412;
  }
  const ifNoneMatch = requestHeaders.get('If-None-Match');
  if (ifNoneMatch !== null) {
    if (matchesTag(ifNoneMatch, etag, true)) return 304;
  } else {
    const since = httpDate(requestHeaders.get('If-Modified-Since'));
    if (Number.isFinite(since) && modified <= since) return 304;
  }
  return null;
}

function ifRangeMatches(value, headers) {
  if (value === null) return true;
  if (value.startsWith('"')) {
    return value === headers.get('ETag');
  }
  const date = httpDate(value);
  const modified = httpDate(headers.get('Last-Modified'));
  const served = httpDate(headers.get('Date'));
  // An HTTP-date If-Range requires an exact, strong validator, not a <= comparison.
  // Without proof that Last-Modified is at least 60 seconds old, send the full file.
  return Number.isFinite(date) && date === modified && served - modified >= 60_000;
}

function byteRange(value, size) {
  if (!value || value.length > 256) return null;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(value.trim());
  if (!match || (!match[1] && !match[2])) return null;
  const total = BigInt(size);
  if (!match[1]) {
    const suffix = BigInt(match[2]);
    if (!suffix || !total) return { unsatisfiable: true };
    return { start: Number(suffix >= total ? 0n : total - suffix), end: size - 1 };
  }
  const start = BigInt(match[1]);
  const end = match[2] ? BigInt(match[2]) : total - 1n;
  if (start >= total || end < start) return { unsatisfiable: true };
  return { start: Number(start), end: Number(end >= total ? total - 1n : end) };
}

function rangeStream(body, start, end) {
  const reader = body.getReader();
  let position = 0;
  let stopped = false;
  return new ReadableStream({
    async pull(controller) {
      try {
        while (!stopped) {
          const { value, done } = await reader.read();
          if (stopped) return;
          if (done) throw new Error('Asset ended before its declared Content-Length');
          const chunkStart = position;
          position += value.byteLength;
          if (position <= start) continue;
          const from = Math.max(0, start - chunkStart);
          const to = Math.min(value.byteLength, end + 1 - chunkStart);
          controller.enqueue(value.subarray(from, to));
          if (position > end) {
            stopped = true;
            controller.close();
            await reader.cancel('Requested byte range completed');
          }
          return;
        }
      } catch (error) {
        if (!stopped) {
          stopped = true;
          controller.error(error);
          await reader.cancel(error).catch(() => {});
        }
      }
    },
    async cancel(reason) {
      stopped = true;
      await reader.cancel(reason);
    },
  });
}

function fixedLengthBody(body, length) {
  // Workers ignores a manually assigned Content-Length for generic streams.
  // Node's test runtime has no FixedLengthStream; the underlying byte stream is shared.
  if (typeof FixedLengthStream === 'undefined') return body;
  const fixed = new FixedLengthStream(length);
  // pipeTo propagates source failure and downstream cancellation in both directions.
  // Observe its rejection as the returned readable already carries the same error.
  body.pipeTo(fixed.writable).catch(() => {});
  return fixed.readable;
}

async function emptyResponse(source, status, headers) {
  await source.body?.cancel();
  headers.delete('Content-Range');
  if (status === 304) headers.delete('Content-Length');
  else headers.set('Content-Length', '0');
  return new Response(null, { status, headers });
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (!/^\/assets\/.*\.(mp4|pdf)$/.test(path) || !['GET', 'HEAD'].includes(request.method)) {
      return env.ASSETS.fetch(request);
    }

    const upstreamHeaders = new Headers(request.headers);
    for (const name of conditionalHeaders) upstreamHeaders.delete(name);
    upstreamHeaders.set('Accept-Encoding', 'identity');
    const source = await env.ASSETS.fetch(new Request(request, { headers: upstreamHeaders }));
    if (source.status !== 200) return source;

    const headers = new Headers(source.headers);
    headers.delete('Content-Range');
    const condition = preconditionStatus(request.headers, headers);
    if (condition) return emptyResponse(source, condition, headers);

    const rawSize = headers.get('Content-Length');
    // ASSETS can omit Content-Length internally even when the edge later emits it.
    // The Wrangler build hook verifies every manifest size/hash against its asset bundle.
    const size =
      rawSize === null
        ? mediaManifest.files[path]?.bytes
        : /^\d+$/.test(rawSize)
          ? Number(rawSize)
          : NaN;
    const encoding = headers.get('Content-Encoding');
    const canSlice =
      Number.isSafeInteger(size) && size >= 0 && (!encoding || encoding === 'identity');
    headers.set('Accept-Ranges', canSlice ? 'bytes' : 'none');
    if (request.method === 'HEAD') {
      if (canSlice) headers.set('Content-Length', String(size));
      // workerd can omit HEAD's optional Content-Length; do not fetch a GET body for it.
      await source.body?.cancel();
      return new Response(null, { status: 200, headers });
    }

    const range =
      canSlice && ifRangeMatches(request.headers.get('If-Range'), headers)
        ? byteRange(request.headers.get('Range'), size)
        : null;
    if (!range) return new Response(source.body, { status: 200, headers });
    if (range.unsatisfiable) {
      const response = await emptyResponse(source, 416, headers);
      response.headers.set('Content-Range', `bytes */${size}`);
      return response;
    }
    // A nonempty successful GET must have a stream before partial headers are emitted.
    if (!source.body) return new Response(null, { status: 502 });
    headers.set('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
    headers.set('Content-Length', String(range.end - range.start + 1));
    const body = fixedLengthBody(
      rangeStream(source.body, range.start, range.end),
      range.end - range.start + 1,
    );
    return new Response(body, { status: 206, headers });
  },
};
