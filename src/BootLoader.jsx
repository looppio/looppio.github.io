import { useLayoutEffect, useRef, useState } from 'react';
import './boot-loader.css';

// Keep the first boot across React refreshes, but start afresh on a page reload.
const storeKey = Symbol.for('oleksii.portfolio.boot.v1');
const store = (globalThis[storeKey] ??= {
  generation: 0,
  listeners: new Set(),
  snapshot: {
    status: 'idle',
    progress: 0,
    loaded: 0,
    total: 0,
    phase: 'Loading portfolio',
    dismissed: false,
  },
});
const notify = (next) => {
  store.snapshot = { ...store.snapshot, ...next };
  if (typeof document !== 'undefined' && document.documentElement?.dataset)
    document.documentElement.dataset.portfolioBoot = store.snapshot.dismissed
      ? 'complete'
      : store.snapshot.status === 'revealing'
        ? 'revealing'
        : 'loading';
  for (const listener of store.listeners) listener(store.snapshot);
};
export const getBootState = () => store.snapshot;
export function subscribeBoot(listener) {
  store.listeners.add(listener);
  return () => store.listeners.delete(listener);
}
export function beginBoot(total) {
  if (store.snapshot.dismissed) return null;
  const token = ++store.generation;
  notify({
    status: 'loading',
    progress: 0,
    loaded: 0,
    total: Math.max(1, total || 1),
    phase: 'Loading portfolio',
    error: null,
  });
  return token;
}
export function bindBootRenderer(token, driver) {
  if (token === null || token !== store.generation) return () => {};
  const binding = { token, ...driver };
  store.driver = binding;
  return () => {
    if (store.driver === binding) store.driver = null;
  };
}
export function releaseBoot(rects) {
  if (store.snapshot.status !== 'ready' || store.snapshot.dismissed) return;
  const driver = store.driver;
  if (!driver || driver.token !== store.generation) return;
  notify({ status: 'revealing', phase: 'Opening portfolio' });
  try {
    if (driver.release(rects) === false)
      failBoot(driver.token, new Error('The visual transition could not start.'));
  } catch (error) {
    failBoot(driver.token, error);
  }
}
export function reportBootReveal(token, detail = {}) {
  if (
    token === null ||
    token !== store.generation ||
    store.snapshot.dismissed ||
    store.snapshot.status !== 'revealing'
  )
    return;
  const style = typeof document !== 'undefined' ? document.documentElement?.style : null;
  if (!style) return;
  style.setProperty('--boot-hud-alpha', String(detail.hudAlpha ?? 0));
  style.setProperty('--boot-content-alpha', String(detail.contentAlpha ?? 0));
}
export function finishBootReveal(token) {
  if (
    token === null ||
    token !== store.generation ||
    store.snapshot.dismissed ||
    store.snapshot.status !== 'revealing'
  )
    return;
  reportBootReveal(token, { hudAlpha: 1, contentAlpha: 1 });
  notify({ status: 'ready', dismissed: true });
}
export function reportBoot(token, detail = {}) {
  if (
    token === null ||
    token !== store.generation ||
    store.snapshot.dismissed ||
    store.snapshot.status !== 'loading'
  )
    return;
  const total = Math.max(1, Number(detail.total) || store.snapshot.total);
  const loaded = Math.min(total, Math.max(store.snapshot.loaded, Number(detail.loaded) || 0));
  // The last percent belongs to a successful rendered frame, never a timer.
  notify({
    loaded,
    total,
    progress: Math.max(store.snapshot.progress, Math.min(0.99, loaded / total)),
    phase: detail.phase || 'Loading portfolio',
  });
}
export function completeBoot(token) {
  if (
    token === null ||
    token !== store.generation ||
    store.snapshot.dismissed ||
    store.snapshot.status !== 'loading'
  )
    return;
  notify({ status: 'ready', progress: 1, loaded: store.snapshot.total, phase: 'Portfolio ready' });
}
export function failBoot(token, error) {
  if (token === null || token !== store.generation || store.snapshot.dismissed) return;
  notify({ status: 'error', error, phase: 'The visual preview could not start.' });
}

export default function BootLoader() {
  const [snapshot, setSnapshot] = useState(getBootState),
    [display, setDisplay] = useState(() => getBootState().progress);
  const root = useRef(null),
    current = useRef(display);
  useLayoutEffect(() => {
    const unsubscribe = subscribeBoot(setSnapshot);
    setSnapshot(getBootState());
    return unsubscribe;
  }, []);
  useLayoutEffect(() => {
    if (snapshot.dismissed || snapshot.status === 'revealing' || snapshot.status === 'error')
      return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0,
      cancelled = false;
    const publish = (value) => {
      current.current = value;
      setDisplay(value);
      store.driver?.setProgress?.(value);
    };
    const finish = () => {
      publish(snapshot.progress);
      if (snapshot.status === 'ready')
        releaseBoot(
          Array.from(root.current?.querySelectorAll('.boot-loader-bar') || [], (element) => {
            const { left, top, width, height } = element.getBoundingClientRect();
            return { left, top, width, height };
          }),
        );
    };
    if (query.matches) {
      finish();
      return;
    }
    // Source app SH eases real preload updates over .8s with power3.out.
    const from = current.current,
      to = Math.max(from, snapshot.progress),
      started = performance.now();
    const animate = (time) => {
      if (cancelled) return;
      const p = Math.min(1, Math.max(0, (time - started) / 800));
      const value = Math.min(to, from + (to - from) * (1 - Math.pow(1 - p, 4)));
      publish(value);
      if (p < 1) frame = requestAnimationFrame(animate);
      else finish();
    };
    if (to === from) finish();
    else frame = requestAnimationFrame(animate);
    const reduce = () => {
      if (query.matches) {
        cancelAnimationFrame(frame);
        cancelled = true;
        finish();
      }
    };
    query.addEventListener?.('change', reduce);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      query.removeEventListener?.('change', reduce);
    };
  }, [snapshot.progress, snapshot.status, snapshot.dismissed]);
  useLayoutEffect(() => {
    if (snapshot.dismissed) return;
    const prior = document.activeElement,
      targets = Array.from(document.querySelectorAll('.portfolio,.case-view,.lightbox'));
    const element = root.current,
      block = (event) => {
        if (event.cancelable) event.preventDefault();
        event.stopPropagation();
      };
    element?.addEventListener('wheel', block, { passive: false });
    element?.addEventListener('touchmove', block, { passive: false });
    const saved = targets.map((element) => ({
      element,
      inert: element.inert,
      busy: element.getAttribute('aria-busy'),
    }));
    for (const { element } of saved) {
      element.inert = true;
      element.setAttribute('aria-busy', 'true');
    }
    root.current?.focus({ preventScroll: true });
    return () => {
      element?.removeEventListener('wheel', block);
      element?.removeEventListener('touchmove', block);
      for (const { element, inert, busy } of saved) {
        element.inert = inert;
        if (busy === null) element.removeAttribute('aria-busy');
        else element.setAttribute('aria-busy', busy);
      }
      if (
        root.current?.contains(document.activeElement) &&
        prior?.isConnected &&
        prior !== document.body
      )
        prior.focus?.({ preventScroll: true });
    };
  }, [snapshot.dismissed]);
  if (snapshot.dismissed) return null;
  const leaving = snapshot.status === 'revealing',
    percent = Math.min(
      snapshot.status === 'ready' || leaving ? 100 : 99,
      Math.floor(display * 100),
    ),
    error = snapshot.status === 'error';
  return (
    <section
      ref={root}
      className={`boot-loader${leaving ? ' boot-loader-revealing' : ''}${snapshot.status === 'ready' ? ' boot-loader-ready' : ''}${error ? ' boot-loader-error' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Loading portfolio"
      tabIndex={-1}
      onPointerDownCapture={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Tab') {
          event.preventDefault();
          if (error) root.current?.querySelector('button')?.focus();
        } else if (
          !error &&
          [
            'ArrowUp',
            'ArrowDown',
            'ArrowLeft',
            'ArrowRight',
            'PageUp',
            'PageDown',
            'Home',
            'End',
            ' ',
          ].includes(event.key)
        )
          event.preventDefault();
      }}
    >
      <div className="boot-loader-content">
        <div
          className="boot-loader-bars"
          role="progressbar"
          aria-label="Portfolio loading progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-valuetext={error ? 'Loading interrupted' : `${percent}%`}
        >
          {[0, 1, 2].map((index) => (
            <span className="boot-loader-bar" key={index}>
              <i
                style={{ transform: `scaleX(${Math.max(0, Math.min(1, display * 3 - index))})` }}
              />
            </span>
          ))}
        </div>
        <div className="boot-loader-caption">
          <span role="status">{error ? 'Unable to load preview' : 'Loading portfolio'}</span>
          <span className="boot-loader-percent" aria-hidden="true">
            {percent.toString().padStart(2, '0')}%
          </span>
        </div>
        {error && (
          <div className="boot-loader-recovery">
            <p>Try reloading this page.</p>
            <button type="button" onClick={() => window.location.reload()}>
              Reload portfolio
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
