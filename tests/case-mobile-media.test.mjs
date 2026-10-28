import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const referenceRoot = fileURLToPath(new URL('../src/reference/', import.meta.url));
const source = await readFile(new URL('../src/reference/CaseView.jsx', import.meta.url), 'utf8');
const bundled = await build({
  stdin: {
    contents: source + '\nexport {CaseMedia, CaseVideo, centerCaseMedia, isCaseElementParked};',
    resolveDir: referenceRoot,
    loader: 'jsx',
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  jsx: 'automatic',
  loader: { '.css': 'empty' },
  plugins: [
    {
      name: 'mobile-media-probe',
      setup(builder) {
        builder.onResolve({ filter: /^react(?:\/jsx-runtime)?$/ }, (args) => ({
          path: args.path,
          namespace: 'probe',
        }));
        builder.onResolve({ filter: /@phosphor-icons\/react\/dist\/csr\// }, (args) => ({
          path: args.path.split('/').at(-1),
          namespace: 'icon',
        }));
        builder.onLoad({ filter: /.*/, namespace: 'icon' }, (args) => ({
          contents: `export const ${args.path}Icon=()=>null;`,
        }));
        builder.onLoad({ filter: /.*/, namespace: 'probe' }, (args) => ({
          contents:
            args.path === 'react'
              ? 'export const useCallback=f=>f,useLayoutEffect=()=>{},useMemo=f=>f(),useRef=value=>({current:value}),useState=value=>[typeof value==="function"?value():value,()=>{}];'
              : 'export const jsx=(type,props)=>({type,props}),jsxs=jsx,Fragment=Symbol.for("mobile.fragment");',
        }));
      },
    },
  ],
});
const { CaseMedia, CaseVideo, centerCaseMedia, isCaseElementParked } = await import(
  'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
);
const project = {
  title: 'Portrait media',
  cover: '/poster.webp',
  coverWidth: 1276,
  coverHeight: 718,
};
const portrait = {
  src: '/phone.webp',
  type: 'image',
  alt: 'Mobile provider selection',
  width: 390,
  height: 844,
  presentation: 'mobile',
};

test('portrait image constrains the actual measured surface while retaining aspect and full lightbox input', () => {
  let enlarged;
  const image = CaseMedia({
    media: portrait,
    project,
    index: 2,
    onLightbox: (item) => {
      enlarged = item;
    },
  });
  assert.equal(image.type, 'button');
  assert.equal(image.props['data-presentation'], 'mobile');
  assert.equal(image.props['data-media-index'], 2);
  assert.equal(image.props.style['--case-mobile-aspect'], 390 / 844);
  assert.equal(image.props.children.props.style.aspectRatio, '390 / 844');
  image.props.onClick();
  assert.strictEqual(enlarged, portrait);
});

test('portrait video and its poster reserve the same original aspect before the first decoded frame', () => {
  const media = { ...portrait, src: '/phone.mp4', type: 'video', poster: '/phone-poster.webp' };
  const frame = CaseVideo({ media, project, index: 3, duplicate: false });
  assert.equal(frame.props['data-presentation'], 'mobile');
  assert.equal(frame.props.style.aspectRatio, '390 / 844');
  assert.equal(frame.props.style['--case-mobile-aspect'], 390 / 844);
  const [video, poster] = frame.props.children.props.children;
  for (const child of [video, poster]) {
    assert.equal(child.props.width, 390);
    assert.equal(child.props.height, 844);
  }
  assert.equal(video.props.poster, media.poster);
  assert.equal(poster.props.src, media.poster);
  assert.notEqual(frame.props['data-video-ready'], 'true');
});

test('other cases retain their original image and video presentation without a portrait opt-in', () => {
  const media = { ...portrait, presentation: undefined };
  const image = CaseMedia({ media, project, index: 0 });
  assert.equal(image.props['data-presentation'], undefined);
  assert.equal(image.props.style, undefined);
  const video = CaseVideo({ media: { ...media, type: 'video' }, project, index: 0 });
  assert.equal(video.props['data-presentation'], undefined);
  assert.deepEqual(video.props.style, { aspectRatio: '390 / 844' });
});

test('a titled mobile group remains one scroll item with independently interactive image and video children', () => {
  const video = { ...portrait, src: '/phone.mp4', type: 'video', poster: '/phone-poster.webp' };
  const media = {
    type: 'group',
    layout: 'mobile-pair',
    title: 'Responsive discovery',
    caption: 'Search and filter controls across mobile screens.',
    items: [portrait, video],
  };
  let enlarged,
    focused = 0,
    measured = 0;
  const onFocus = () => focused++,
    onMeasure = () => measured++;
  const group = CaseMedia({
    media,
    project: { ...project, id: 'demo' },
    index: 4,
    slot: 'original-4',
    duplicate: false,
    onLightbox: (item) => {
      enlarged = item;
    },
    onFocus,
    onMeasure,
  });
  assert.equal(group.type, 'section');
  assert.equal(group.props.className, 'case-media-group');
  assert.equal(group.props['data-layout'], 'mobile-pair');
  assert.equal(group.props.tabIndex, undefined);
  const [copy, body] = group.props.children;
  assert.equal(copy.props.children[0].props.children, media.title);
  assert.equal(copy.props.children[1].props.children, media.caption);
  assert.equal(group.props['aria-labelledby'], copy.props.children[0].props.id);
  assert.equal(group.props['aria-describedby'], copy.props.children[1].props.id);
  assert.equal(body.props.children.length, 2);
  const image = CaseMedia(body.props.children[0].props),
    videoNode = CaseMedia(body.props.children[1].props),
    frame = CaseVideo(videoNode.props);
  assert.match(image.props.className, /case-media-item/);
  assert.match(frame.props.className, /case-media-item/);
  assert.equal(image.props['data-case-slot'], 'original-4-0');
  assert.equal(frame.props['data-case-slot'], 'original-4-1');
  assert.equal(image.props['data-media-index'], 4);
  assert.equal(frame.props['data-media-index'], 4);
  image.props.onClick();
  assert.strictEqual(enlarged, portrait);
  image.props.onFocus();
  image.props.children.props.onLoad();
  const clip = frame.props.children.props.children[0];
  assert.equal(clip.props.controls, true);
  assert.equal(clip.props.tabIndex, 0);
  clip.props.onFocus();
  assert.equal(focused, 2);
  assert.equal(measured, 1);
});

test('looped group copies use unique slots and keep their descendants outside keyboard and accessibility navigation', () => {
  const media = {
    type: 'group',
    layout: 'single',
    title: 'Screen detail',
    items: [portrait, { ...portrait, type: 'video', src: '/phone.mp4' }],
  };
  const group = CaseMedia({
    media,
    project: { ...project, id: 'demo' },
    index: 1,
    slot: 'repeat-0-0',
    duplicate: true,
  });
  assert.equal(group.props['aria-hidden'], true);
  assert.equal(group.props['data-layout'], 'single');
  const children = group.props.children[1].props.children,
    image = CaseMedia(children[0].props),
    frame = CaseVideo(CaseMedia(children[1].props).props);
  assert.equal(image.props['data-case-slot'], 'repeat-0-0-0');
  assert.equal(frame.props['data-case-slot'], 'repeat-0-0-1');
  assert.equal(image.props.tabIndex, -1);
  assert.equal(image.props['aria-hidden'], true);
  assert.equal(image.props.children.props.alt, '');
  const clip = frame.props.children.props.children[0];
  assert.equal(clip.props.controls, false);
  assert.equal(clip.props.tabIndex, -1);
});

test('keyboard focus centers a grouped child inside its virtual scroll record while ordinary media keeps existing centering', () => {
  const calls = [],
    scroll = {
      current: 0,
      center(index) {
        calls.push(['center', index]);
        this.current = 100;
      },
      reset(value) {
        calls.push(['reset', value]);
        this.current = value;
      },
    };
  const sheet = { getBoundingClientRect: () => ({ top: 20, height: 700 }) };
  const child = { closest: () => ({}), getBoundingClientRect: () => ({ top: 900, height: 600 }) };
  centerCaseMedia(scroll, sheet, child, 4);
  assert.deepEqual(calls, [
    ['center', 4],
    ['reset', 930],
  ]);
  calls.length = 0;
  centerCaseMedia(scroll, sheet, { closest: () => null }, 2);
  assert.deepEqual(calls, [['center', 2]]);
  const group = { _parked: true },
    item = { _parked: false, parentElement: group },
    video = { parentElement: item };
  assert.equal(isCaseElementParked(video), true);
  group._parked = false;
  assert.equal(isCaseElementParked(video), false);
});
