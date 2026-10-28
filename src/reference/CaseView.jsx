import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftIcon } from '@phosphor-icons/react/dist/csr/ArrowLeft';
import { ArrowRightIcon } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { ArrowUpRightIcon } from '@phosphor-icons/react/dist/csr/ArrowUpRight';
import { CaretDownIcon } from '@phosphor-icons/react/dist/csr/CaretDown';
import { CaretUpIcon } from '@phosphor-icons/react/dist/csr/CaretUp';
import { XIcon } from '@phosphor-icons/react/dist/csr/X';
import { projectDetails } from '../projectDetails.js';
import { createVerticalScroll } from './scroll.js';
import { collapsedDisclosureHeight } from './caseDisclosure.js';
import './case.css';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const mix = (a, b, amount) => a + (b - a) * amount;
const progressLength = 2 * Math.PI * 11.5;
const interactiveField = (element) =>
  element?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(element?.tagName || '');

function CaseBreakdown({ id, title, items, onMeasure }) {
  const sectionRef = useRef(null);
  const listRef = useRef(null);
  const pendingLayoutRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [metrics, setMetrics] = useState({ height: 0, collapsible: false });
  const collapsed = metrics.collapsible && !expanded;
  const bodyId = `${id}-body`;

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return undefined;
    let disposed = false;
    const measure = () => {
      if (disposed) return;
      const lineHeight = parseFloat(getComputedStyle(list).lineHeight);
      const rows = [...list.children].map((row) => ({
        height: row.offsetHeight,
        marginTop: parseFloat(getComputedStyle(row).marginTop) || 0,
      }));
      const height = collapsedDisclosureHeight(lineHeight, rows);
      const collapsible = height > 0 && list.scrollHeight > height + 1;
      setMetrics((previous) =>
        Math.abs(previous.height - height) < 0.5 && previous.collapsible === collapsible
          ? previous
          : { height, collapsible },
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    document.fonts?.ready.then(measure);
    measure();
    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, [items]);

  useLayoutEffect(() => {
    onMeasure(pendingLayoutRef.current);
    pendingLayoutRef.current = null;
  }, [expanded, metrics, onMeasure]);

  const changeExpanded = (value) => {
    pendingLayoutRef.current = {
      disclosureAnchor: sectionRef.current,
      beforeTop: sectionRef.current?.getBoundingClientRect().top,
      collapse: !value,
    };
    setExpanded(value);
  };
  const expand = () => {
    if (collapsed) changeExpanded(true);
  };
  const key = (event) => {
    if (collapsed && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      event.stopPropagation();
      expand();
    }
  };
  const focus = (event) => {
    if (event.currentTarget.matches(':focus-visible'))
      onMeasure({ focusTarget: event.currentTarget });
  };

  return (
    <section
      ref={sectionRef}
      className="case-breakdown case-disclosure"
      aria-labelledby={id}
      data-expanded={metrics.collapsible && expanded ? 'true' : 'false'}
      data-collapsible={metrics.collapsible ? 'true' : 'false'}
      style={{ '--case-disclosure-collapsed-height': `${metrics.height}px` }}
    >
      <h2 id={id}>{title}</h2>
      <div
        id={bodyId}
        className="case-disclosure-body"
        role={collapsed ? 'button' : undefined}
        tabIndex={collapsed ? 0 : undefined}
        aria-label={collapsed ? `Show more ${title.toLowerCase()}` : undefined}
        aria-expanded={collapsed ? false : undefined}
        data-case-furniture=""
        onClick={expand}
        onKeyDown={key}
        onFocus={focus}
      >
        <ul ref={listRef} aria-hidden={collapsed || undefined}>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <span className="case-disclosure-blur" aria-hidden="true" />
      </div>
      {metrics.collapsible && (
        <button
          className="case-disclosure-toggle"
          type="button"
          data-case-furniture=""
          aria-expanded={expanded}
          aria-controls={bodyId}
          aria-label={`${expanded ? 'Show less' : 'Show more'} ${title.toLowerCase()}`}
          onClick={() => changeExpanded(!expanded)}
          onFocus={focus}
        >
          {expanded ? 'Show less' : 'Show more'}
          {expanded ? (
            <CaretUpIcon size={14} aria-hidden="true" />
          ) : (
            <CaretDownIcon size={14} aria-hidden="true" />
          )}
        </button>
      )}
    </section>
  );
}

function productWebsite(project) {
  if (typeof project.websiteUrl !== 'string' || !project.websiteUrl.trim()) return null;
  try {
    const url = new URL(project.websiteUrl);
    const host = url.hostname.toLowerCase();
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (
      ['behance.net', 'dribbble.com'].some(
        (domain) => host === domain || host.endsWith(`.${domain}`),
      )
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}

function poseBetween(element, from, to, amount) {
  if (!element || !from || !to) return;
  const x = (to.left + to.width / 2 - from.left - from.width / 2) * amount;
  const y = (to.top + to.height / 2 - from.top - from.height / 2) * amount;
  const scaleX = mix(1, to.width / Math.max(1, from.width), amount);
  const scaleY = mix(1, to.height / Math.max(1, from.height), amount);
  element.style.transform = `translate3d(${x}px,${y}px,0) scale(${scaleX},${scaleY})`;
}

function mobileMediaStyle(media) {
  if (media.presentation !== 'mobile' || !(media.width > 0 && media.height > 0)) return undefined;
  return { '--case-mobile-aspect': media.width / media.height };
}

function isCaseElementParked(element) {
  for (let current = element; current; current = current.parentElement)
    if (current._parked) return true;
  return false;
}

function centerCaseMedia(scroll, sheet, element, index) {
  if (!scroll) return;
  scroll.center(index);
  if (!element?.closest?.('[data-case-group]') || !sheet) return;
  // A stacked mobile group can be taller than the viewport. First restore its
  // virtual scroll record, then bring the focused child into that viewport.
  const target = element.getBoundingClientRect(),
    viewport = sheet.getBoundingClientRect();
  const delta =
    target.top + Math.min(target.height, viewport.height) / 2 - viewport.top - viewport.height / 2;
  if (Number.isFinite(delta)) scroll.reset(scroll.current + delta);
}

function CaseVideo({ media, project, index, slot, duplicate, onMeasure, onFocus }) {
  const videoRef = useRef(null);
  const boxRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const poster = media.poster || project.cover;
  const dimensions = media.width > 0 && media.height > 0 ? media : project;
  const width = dimensions === media ? media.width : project.coverWidth;
  const height = dimensions === media ? media.height : project.coverHeight;
  const aspect =
    width > 0 && height > 0
      ? { aspectRatio: `${width} / ${height}`, ...mobileMediaStyle(media) }
      : undefined;

  useLayoutEffect(() => {
    setFailed(false);
  }, [media.src]);
  useLayoutEffect(() => {
    const video = videoRef.current;
    const box = boxRef.current;
    if (!video || failed) return undefined;
    let disposed = false;
    const ready = () => {
      if (disposed) return;
      if (video.error) {
        error();
        return;
      }
      box.dataset.videoReady = String(
        !video.error && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0,
      );
      onMeasure?.();
    };
    const error = () => {
      if (!disposed) {
        box.dataset.videoReady = 'false';
        setFailed(true);
        onMeasure?.();
      }
    };
    const events = ['loadedmetadata', 'loadeddata', 'canplay', 'emptied'];
    events.forEach((name) => video.addEventListener(name, ready));
    video.addEventListener('error', error);
    video.defaultMuted = video.muted = true;
    // Restore src after the StrictMode effect cleanup as well as a real mount.
    if (video.getAttribute('src') !== media.src) {
      video.setAttribute('src', media.src);
      video.load();
    }
    ready();
    return () => {
      disposed = true;
      events.forEach((name) => video.removeEventListener(name, ready));
      video.removeEventListener('error', error);
      box.dataset.videoReady = 'false';
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [media.src, failed, onMeasure]);

  return (
    <div
      ref={boxRef}
      className="case-media-item case-video"
      data-case-media
      data-media-index={index}
      data-case-slot={slot}
      data-presentation={media.presentation === 'mobile' ? 'mobile' : undefined}
      style={aspect}
      aria-hidden={duplicate || undefined}
    >
      {failed ? (
        <img
          src={poster}
          alt={duplicate ? '' : media.alt || project.title}
          width={width}
          height={height}
          onLoad={onMeasure}
          draggable="false"
        />
      ) : (
        <>
          <video
            ref={videoRef}
            src={media.src}
            poster={poster}
            width={width}
            height={height}
            loop
            muted
            playsInline
            controls={!duplicate}
            preload="metadata"
            tabIndex={duplicate ? -1 : 0}
            aria-label={media.alt || `${project.title} interaction preview`}
            onFocus={onFocus}
          />
          <img
            className="case-video-poster"
            src={poster}
            alt=""
            aria-hidden="true"
            width={width}
            height={height}
            onLoad={onMeasure}
            draggable="false"
          />
        </>
      )}
    </div>
  );
}

function CaseMedia({ media, project, index, slot, duplicate, onLightbox, onMeasure, onFocus }) {
  if (media.type === 'group') {
    const groupSlot = slot ?? `media-${index}`;
    const titleId = `${project.id || project.slug || 'case'}-${groupSlot}-title`;
    const captionId = `${project.id || project.slug || 'case'}-${groupSlot}-caption`;
    return (
      <section
        className="case-media-group"
        data-case-group
        data-media-index={index}
        data-case-slot={groupSlot}
        data-layout={media.layout === 'mobile-pair' ? 'mobile-pair' : 'single'}
        aria-hidden={duplicate || undefined}
        aria-labelledby={media.title ? titleId : undefined}
        aria-describedby={media.caption ? captionId : undefined}
      >
        {(media.title || media.caption) && (
          <div className="case-media-group-copy">
            {media.title && <h2 id={titleId}>{media.title}</h2>}
            {media.caption && <p id={captionId}>{media.caption}</p>}
          </div>
        )}
        <div className="case-media-group-items">
          {(Array.isArray(media.items) ? media.items : []).map((item, childIndex) => (
            <CaseMedia
              key={`${groupSlot}-${childIndex}`}
              media={item}
              project={project}
              index={index}
              slot={`${groupSlot}-${childIndex}`}
              duplicate={duplicate}
              onLightbox={onLightbox}
              onMeasure={onMeasure}
              onFocus={onFocus}
            />
          ))}
        </div>
      </section>
    );
  }
  if (media.type === 'video')
    return <CaseVideo {...{ media, project, index, slot, duplicate, onMeasure, onFocus }} />;
  return (
    <button
      type="button"
      className="case-media-item case-image"
      data-case-media
      data-media-index={index}
      data-case-slot={slot}
      data-presentation={media.presentation === 'mobile' ? 'mobile' : undefined}
      style={mobileMediaStyle(media)}
      aria-label={`Enlarge ${media.alt || project.title}`}
      aria-hidden={duplicate || undefined}
      tabIndex={duplicate ? -1 : 0}
      onClick={() => onLightbox?.(media)}
      onFocus={onFocus}
    >
      <img
        src={media.src}
        alt={duplicate ? '' : media.alt || `${project.title}, screen ${index + 1}`}
        loading={index > 1 ? 'lazy' : 'eager'}
        decoding="async"
        draggable="false"
        onLoad={onMeasure}
        style={
          media.width && media.height
            ? { aspectRatio: `${media.width} / ${media.height}` }
            : undefined
        }
      />
    </button>
  );
}

/**
 * React port of the project route in rY37MP56.js.
 * The article is the shared card-to-sheet FLIP destination. A single external
 * portfolio-tick drives both the source column adapter and horizontal scrub.
 */
export default function CaseView({
  project,
  projects = [],
  onClose,
  onMove,
  onLightbox,
  transitionState = 'settled',
}) {
  const viewRef = useRef(null);
  const sheetRef = useRef(null);
  const copyRef = useRef(null);
  const stackRef = useRef(null);
  const progressRef = useRef(null);
  const arcRef = useRef(null);
  const previousSlotRef = useRef(null);
  const nextSlotRef = useRef(null);
  const previousSurfaceRef = useRef(null);
  const nextSurfaceRef = useRef(null);
  const scrollRef = useRef(null);
  const measureRef = useRef(() => {});
  const [extraCopies, setExtraCopies] = useState(0);
  const [copyOverflow, setCopyOverflow] = useState(false);
  const [small, setSmall] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= 649,
  );
  const [mouse, setMouse] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(hover: hover) and (pointer: fine)').matches,
  );
  const liveRef = useRef({ onClose, onMove, onLightbox, transitionState, mouse, small });
  liveRef.current = { onClose, onMove, onLightbox, transitionState, mouse, small };

  const index = Math.max(
    0,
    projects.findIndex((item) => item.id === project.id),
  );
  const previous =
    projects.length > 1 ? projects[(index - 1 + projects.length) % projects.length] : null;
  const next = projects.length > 1 ? projects[(index + 1) % projects.length] : null;
  const media = useMemo(
    () =>
      project.media?.length
        ? project.media
        : [{ src: project.cover, type: 'image', alt: project.title }],
    [project],
  );
  const renderedMedia = useMemo(() => {
    const originals = media.map((item, mediaIndex) => ({
      item,
      mediaIndex,
      duplicate: false,
      key: `original-${mediaIndex}`,
    }));
    // The source adds only the tail when a desktop column is too short to loop.
    const tail = media.length >= 3 ? media.slice(1) : media;
    for (let copy = 0; copy < extraCopies; copy += 1) {
      tail.forEach((item, tailIndex) =>
        originals.push({
          item,
          mediaIndex: media.length >= 3 ? tailIndex + 1 : tailIndex,
          duplicate: true,
          key: `repeat-${copy}-${tailIndex}`,
        }),
      );
    }
    return originals;
  }, [media, extraCopies]);

  const onMeasure = useCallback((change) => measureRef.current(change), []);
  const openMedia = useCallback((item) => liveRef.current.onLightbox?.(item), []);

  useLayoutEffect(() => {
    const sizeQuery = window.matchMedia('(max-width: 649px)');
    const mouseQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
    const update = () => {
      setSmall(sizeQuery.matches);
      setMouse(mouseQuery.matches);
    };
    update();
    sizeQuery.addEventListener('change', update);
    mouseQuery.addEventListener('change', update);
    return () => {
      sizeQuery.removeEventListener('change', update);
      mouseQuery.removeEventListener('change', update);
    };
  }, []);

  useLayoutEffect(() => {
    setExtraCopies(0);
    if (copyRef.current) copyRef.current.scrollTop = 0;
  }, [project.id, mouse]);

  useLayoutEffect(() => {
    const view = viewRef.current;
    const sheet = sheetRef.current;
    const stack = stackRef.current;
    const copy = copyRef.current;
    if (!view || !sheet || !stack) return undefined;
    let measureTimer = 0;
    let pendingDisclosure = null;
    let disposed = false;
    const isEnabled = () =>
      liveRef.current.transitionState === 'settled' &&
      !document.querySelector('.lightbox, [data-lightbox-open="true"]') &&
      view.isConnected;
    const updateProgress = (value) => {
      const progress = clamp(value, 0, 1);
      if (progressRef.current) {
        progressRef.current.dataset.progress = String(progress);
        progressRef.current.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
      }
      if (arcRef.current)
        arcRef.current.style.strokeDashoffset = String(progressLength * (1 - progress));
    };
    const column = createVerticalScroll({
      outer: sheet,
      inner: stack,
      lead: small ? copyRef.current : null,
      finite: () => !liveRef.current.mouse,
      enabled: () => isEnabled() && !view.hasAttribute('data-scrubbing'),
      onProgress: updateProgress,
      onVelocity: (velocity) => {
        view.dataset.scrollVelocity = String(velocity);
      },
    });
    scrollRef.current = column;
    const measure = (change) => {
      if (disposed) return;
      if (change?.disclosureAnchor || (change?.focusTarget && !pendingDisclosure?.collapse))
        pendingDisclosure = change;
      clearTimeout(measureTimer);
      measureTimer = window.setTimeout(() => {
        if (disposed) return;
        column.measure();
        const disclosure = pendingDisclosure;
        pendingDisclosure = null;
        const anyExpanded = Boolean(copy?.querySelector('.case-disclosure[data-expanded="true"]'));
        if (
          liveRef.current.small &&
          disclosure?.collapse &&
          disclosure.disclosureAnchor.isConnected
        ) {
          const anchor = disclosure.disclosureAnchor.getBoundingClientRect();
          const viewport = sheet.getBoundingClientRect();
          const desiredTop = clamp(
            disclosure.beforeTop,
            viewport.top + 16,
            Math.max(viewport.top + 16, viewport.bottom - anchor.height - 16),
          );
          column.reset(clamp(column.current + anchor.top - desiredTop, 0, column.maxScroll));
        } else if (liveRef.current.small && disclosure?.focusTarget?.isConnected) {
          const target = disclosure.focusTarget.getBoundingClientRect();
          const viewport = sheet.getBoundingClientRect();
          const delta =
            target.top < viewport.top + 16
              ? target.top - viewport.top - 16
              : target.bottom > viewport.bottom - 16
                ? target.bottom - viewport.bottom + 16
                : 0;
          if (delta) column.reset(clamp(column.current + delta, 0, column.maxScroll));
        } else if (liveRef.current.small && column.current > column.maxScroll) {
          column.reset(column.maxScroll);
        }
        if (!liveRef.current.small && disclosure?.collapse && !anyExpanded && copy)
          copy.scrollTop = 0;
        setCopyOverflow(
          !liveRef.current.small && Boolean(copy && copy.scrollHeight > copy.clientHeight + 1),
        );
        if (
          liveRef.current.mouse &&
          stack.scrollHeight < sheet.clientHeight * 1.15 &&
          extraCopies < 6
        )
          setExtraCopies((copies) => Math.min(6, copies + 1));
      }, 0);
    };
    measureRef.current = measure;
    const observer = new ResizeObserver(measure);
    observer.observe(sheet);
    observer.observe(stack);
    if (copyRef.current) observer.observe(copyRef.current);
    // Fonts and image decoding can change the lead and column height.
    document.fonts?.ready.then(() => {
      if (!disposed) measure();
    });
    measure();
    updateProgress(0);

    // Ue: horizontal project scrub is separate from the virtual vertical column.
    const scrub = {
      down: false,
      active: false,
      startX: 0,
      startY: 0,
      target: 0,
      current: 0,
      suppress: false,
      rects: null,
    };
    const resetScrub = () => {
      scrub.down = false;
      scrub.active = false;
      scrub.target = 0;
      view.removeAttribute('data-scrubbing');
    };
    const captureRects = () => {
      sheet.style.transform = '';
      if (previousSurfaceRef.current) previousSurfaceRef.current.style.transform = '';
      if (nextSurfaceRef.current) nextSurfaceRef.current.style.transform = '';
      scrub.rects = {
        sheet: sheet.getBoundingClientRect(),
        previous: previousSlotRef.current?.getBoundingClientRect(),
        next: nextSlotRef.current?.getBoundingClientRect(),
      };
    };
    const down = (event) => {
      if (
        !isEnabled() ||
        projects.length < 2 ||
        event.button !== 0 ||
        interactiveField(event.target) ||
        event.target.closest('a, video, [data-case-furniture], [data-copy-scroll]')
      )
        return;
      scrub.down = true;
      scrub.active = false;
      scrub.startX = event.clientX;
      scrub.startY = event.clientY;
      scrub.target = 0;
      scrub.suppress = false;
      captureRects();
    };
    const move = (event) => {
      if (!scrub.down || !isEnabled()) return;
      const x = event.clientX - scrub.startX;
      const y = event.clientY - scrub.startY;
      if (!scrub.active) {
        if (Math.abs(y) > 10 && Math.abs(y) > Math.abs(x)) {
          resetScrub();
          return;
        }
        if (Math.abs(x) < 10 || Math.abs(x) < Math.abs(y)) return;
        scrub.active = true;
        view.dataset.scrubbing = 'true';
      }
      event.preventDefault();
      scrub.suppress = true;
      const raw = -x / (document.documentElement.clientWidth * 0.8);
      scrub.target = clamp((0.4 * raw) / (1 + 0.8 * Math.abs(raw)), -1, 1);
      if (Math.abs(raw) > 0.25) {
        const direction = raw > 0 ? 1 : -1;
        resetScrub();
        liveRef.current.onMove?.(direction);
      }
    };
    const up = () => resetScrub();
    const cancelClick = (event) => {
      if (!scrub.suppress) return;
      scrub.suppress = false;
      event.preventDefault();
      event.stopPropagation();
    };
    const tick = (event) => {
      // Native focus/scrollIntoView must not add a second scroll to the virtual column.
      if (sheet.scrollTop) sheet.scrollTop = 0;
      if (sheet.scrollLeft) sheet.scrollLeft = 0;
      const ratio = Math.min(2, Math.max(0, event.detail?.ratio || 1));
      column.tick(Math.max(0, event.detail?.ratio ?? 1));
      scrub.current += (scrub.target - scrub.current) * Math.min(1, 0.11 * ratio);
      if (Math.abs(scrub.current) < 0.00005 && !scrub.active) scrub.current = 0;
      const amount = Math.abs(scrub.current);
      const rects = scrub.rects;
      if (rects) {
        const towardPrevious = scrub.current >= 0;
        poseBetween(sheet, rects.sheet, towardPrevious ? rects.previous : rects.next, amount);
        const incoming = towardPrevious ? nextSurfaceRef.current : previousSurfaceRef.current;
        const outgoing = towardPrevious ? previousSurfaceRef.current : nextSurfaceRef.current;
        const incomingRect = towardPrevious ? rects.next : rects.previous;
        poseBetween(incoming, incomingRect, rects.sheet, amount);
        if (outgoing)
          outgoing.style.transform = `translate3d(${(towardPrevious ? -1 : 1) * window.innerWidth * amount}px,0,0)`;
      }
      view.style.setProperty('--case-furniture-opacity', String(1 - amount));
      view.dataset.scrub = String(scrub.current);
    };
    const key = (event) => {
      if (
        !isEnabled() ||
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey ||
        event.repeat ||
        interactiveField(event.target)
      )
        return;
      if (event.key === 'Escape') {
        event.preventDefault();
        liveRef.current.onClose?.();
      } else if (event.key === 'ArrowRight' && projects.length > 1) {
        event.preventDefault();
        liveRef.current.onMove?.(1);
      } else if (event.key === 'ArrowLeft' && projects.length > 1) {
        event.preventDefault();
        liveRef.current.onMove?.(-1);
      }
    };
    const trapFocus = (event) => {
      if (event.key !== 'Tab' || !isEnabled()) return;
      const controls = [
        ...view.querySelectorAll(
          'a[href],button:not([tabindex="-1"]),[role="button"][tabindex="0"],video[controls],[data-copy-scroll]',
        ),
      ].filter(
        (element) => !element.closest('[aria-hidden="true"]') && !isCaseElementParked(element),
      );
      const first = controls[0],
        last = controls.at(-1);
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === sheet)
      ) {
        event.preventDefault();
        last?.focus({ preventScroll: true });
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus({ preventScroll: true });
      }
    };
    // Most descriptions fit without an extra scroller. On short desktop
    // viewports, keep the full breakdown readable without moving the images.
    const canScrollCopy = () =>
      !liveRef.current.small && Boolean(copy && copy.scrollHeight > copy.clientHeight + 1);
    let copyTouchY = null;
    const copyWheel = (event) => {
      if (canScrollCopy()) event.stopPropagation();
    };
    const copyPointer = (event) => {
      if (canScrollCopy()) event.stopPropagation();
    };
    const copyTouchStart = (event) => {
      if (!canScrollCopy()) return;
      copyTouchY = event.touches[0]?.clientY ?? null;
      event.stopPropagation();
    };
    const copyTouchMove = (event) => {
      if (!canScrollCopy() || copyTouchY === null) return;
      const y = event.touches[0]?.clientY;
      if (y === undefined) return;
      copy.scrollTop += copyTouchY - y;
      copyTouchY = y;
      event.preventDefault();
      event.stopPropagation();
    };
    const copyTouchEnd = (event) => {
      if (copyTouchY !== null) event.stopPropagation();
      copyTouchY = null;
    };
    const copyKey = (event) => {
      if (
        !canScrollCopy() ||
        event.target !== copy ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return;
      let amount;
      if (event.key === 'ArrowDown') amount = 40;
      else if (event.key === 'ArrowUp') amount = -40;
      else if (event.key === 'PageDown' || event.key === ' ')
        amount = copy.clientHeight * (event.shiftKey ? -0.9 : 0.9);
      else if (event.key === 'PageUp') amount = -copy.clientHeight * 0.9;
      else if (event.key === 'Home') amount = -copy.scrollHeight;
      else if (event.key === 'End') amount = copy.scrollHeight;
      else return;
      copy.scrollTop += amount;
      event.preventDefault();
      event.stopPropagation();
    };
    copy?.addEventListener('wheel', copyWheel, { passive: true });
    copy?.addEventListener('pointerdown', copyPointer);
    copy?.addEventListener('touchstart', copyTouchStart, { passive: true });
    copy?.addEventListener('touchmove', copyTouchMove, { passive: false });
    copy?.addEventListener('touchend', copyTouchEnd);
    copy?.addEventListener('touchcancel', copyTouchEnd);
    copy?.addEventListener('keydown', copyKey);
    view.addEventListener('pointerdown', down);
    view.addEventListener('click', cancelClick, true);
    view.addEventListener('keydown', trapFocus);
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('keydown', key);
    window.addEventListener('portfolio-tick', tick);
    return () => {
      disposed = true;
      clearTimeout(measureTimer);
      observer.disconnect();
      column.destroy();
      scrollRef.current = null;
      measureRef.current = () => {};
      sheet.style.transform = '';
      copy?.removeEventListener('wheel', copyWheel);
      copy?.removeEventListener('pointerdown', copyPointer);
      copy?.removeEventListener('touchstart', copyTouchStart);
      copy?.removeEventListener('touchmove', copyTouchMove);
      copy?.removeEventListener('touchend', copyTouchEnd);
      copy?.removeEventListener('touchcancel', copyTouchEnd);
      copy?.removeEventListener('keydown', copyKey);
      view.removeEventListener('pointerdown', down);
      view.removeEventListener('click', cancelClick, true);
      view.removeEventListener('keydown', trapFocus);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('keydown', key);
      window.removeEventListener('portfolio-tick', tick);
    };
  }, [project.id, small, mouse, extraCopies, projects.length]);

  useLayoutEffect(() => {
    if (transitionState !== 'settled') return;
    scrollRef.current?.measure();
    sheetRef.current?.focus({ preventScroll: true });
  }, [transitionState, project.id]);

  const focusMedia = (mediaIndex) => (event) => {
    if (!event.target.dataset.restoreFocus && event.target.matches(':focus-visible'))
      centerCaseMedia(
        scrollRef.current,
        sheetRef.current,
        event.currentTarget || event.target,
        mediaIndex,
      );
  };
  const websiteUrl = productWebsite(project);
  const details = projectDetails[project.id] || {};
  const title = details.title || project.title;
  const summary = details.summary || project.description;
  const tags = project.tags?.length ? project.tags : details.tags || [];
  const contributionPlaceholder = Array.isArray(details.contributionPlaceholder)
    ? details.contributionPlaceholder
    : typeof details.contributionPlaceholder === 'string'
      ? [details.contributionPlaceholder]
      : [];
  const contribution =
    details.verifiedContribution === true ? details.contribution || [] : contributionPlaceholder;
  const scope =
    details.verifiedContribution === true
      ? details.scope || []
      : details.scope || details.contribution || [];
  return (
    <section
      ref={viewRef}
      className="case-view"
      data-transition={transitionState}
      data-project={project.id}
      aria-label={`${project.title} case study`}
    >
      {previous && (
        <div
          ref={previousSlotRef}
          className="case-related case-related-previous"
          data-id={previous.id}
          data-gl="related"
        >
          <button
            ref={previousSurfaceRef}
            type="button"
            className="case-related-surface"
            aria-label={`Previous project: ${previous.title}`}
            onClick={() => onMove?.(-1)}
          >
            <ArrowLeftIcon size={16} weight="regular" aria-hidden="true" />
            <span className="sr-only">{previous.title}</span>
          </button>
        </div>
      )}
      {next && (
        <div
          ref={nextSlotRef}
          className="case-related case-related-next"
          data-id={next.id}
          data-gl="related"
        >
          <button
            ref={nextSurfaceRef}
            type="button"
            className="case-related-surface"
            aria-label={`Next project: ${next.title}`}
            onClick={() => onMove?.(1)}
          >
            <ArrowRightIcon size={16} weight="regular" aria-hidden="true" />
            <span className="sr-only">{next.title}</span>
          </button>
        </div>
      )}
      <article
        ref={sheetRef}
        className="case-sheet"
        data-flip-target="true"
        data-id={project.id}
        data-gl="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="case-title"
        tabIndex={-1}
      >
        <div
          ref={copyRef}
          className="case-copy case-furniture"
          data-copy-scroll={copyOverflow ? 'true' : undefined}
          tabIndex={copyOverflow ? 0 : undefined}
          aria-label={copyOverflow ? 'Project details' : undefined}
        >
          <h1 id="case-title">{title}</h1>
          <p className="case-description">{summary}</p>
          <div className="case-pills">
            {websiteUrl && (
              <a
                className="case-pill case-pill-round"
                href={websiteUrl}
                target="_blank"
                rel="noreferrer"
                aria-label={`Visit ${project.title} website`}
              >
                <ArrowUpRightIcon size={14} weight="regular" aria-hidden="true" />
              </a>
            )}
            {tags.map((tag) => (
              <span
                key={typeof tag === 'string' ? tag : tag.label}
                className="case-pill case-category"
              >
                {typeof tag === 'string' ? tag : tag.label}
              </span>
            ))}
          </div>
          {(details.role || details.period || details.duration) && (
            <dl className="case-facts">
              {details.role && (
                <div className="case-fact-role">
                  <dt>My role</dt>
                  <dd>{details.role}</dd>
                </div>
              )}
              {details.period && (
                <div>
                  <dt>Period</dt>
                  <dd>{details.period}</dd>
                </div>
              )}
              {details.duration && (
                <div>
                  <dt>Duration</dt>
                  <dd>{details.duration}</dd>
                </div>
              )}
            </dl>
          )}
          {contribution.length > 0 && (
            <CaseBreakdown
              key={`${project.id}-contribution`}
              id="case-contribution-title"
              title="My contribution"
              items={contribution}
              onMeasure={onMeasure}
            />
          )}
          {scope.length > 0 && (
            <CaseBreakdown
              key={`${project.id}-scope`}
              id="case-scope-title"
              title="Project scope"
              items={scope}
              onMeasure={onMeasure}
            />
          )}
        </div>
        <div ref={stackRef} className="case-stack case-furniture">
          {renderedMedia.map(({ item, mediaIndex, duplicate, key }) => (
            <CaseMedia
              key={`${project.id}-${key}`}
              media={item}
              project={project}
              index={mediaIndex}
              slot={key}
              duplicate={duplicate}
              onLightbox={openMedia}
              onMeasure={onMeasure}
              onFocus={focusMedia(mediaIndex)}
            />
          ))}
        </div>
        <div className="case-fixed-furniture case-furniture" data-case-furniture>
          <div
            ref={progressRef}
            className="case-progress"
            data-gl-progress
            data-progress="0"
            data-progress-color="#ffffff"
            role="progressbar"
            aria-label="Case study scroll progress"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow="0"
          >
            <svg
              className="case-progress-fallback"
              viewBox="0 0 25 25"
              fill="none"
              aria-hidden="true"
            >
              <circle className="case-progress-track" cx="12.5" cy="12.5" r="11.5" />
              <circle
                ref={arcRef}
                className="case-progress-arc"
                cx="12.5"
                cy="12.5"
                r="11.5"
                strokeDasharray={progressLength}
                strokeDashoffset={progressLength}
              />
            </svg>
          </div>
          <button type="button" className="case-close" aria-label="Close project" onClick={onClose}>
            <XIcon size={18} weight="regular" aria-hidden="true" />
          </button>
        </div>
      </article>
    </section>
  );
}
