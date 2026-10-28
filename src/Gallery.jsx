import { useLayoutEffect, useRef, useState } from 'react';
import PortfolioScene from './reference/PortfolioScene.js';
import {
  beginBoot,
  reportBoot,
  completeBoot,
  failBoot,
  bindBootRenderer,
  reportBootReveal,
  finishBootReveal,
} from './BootLoader.jsx';
import './gallery.css';

export default function Gallery({
  projects,
  onOpen,
  onDismissOverlay,
  overlay,
  mode,
  project,
  phase,
  onTransitionEnd,
  hovered,
  mouse,
  visibleIds,
  filtersOpen = false,
}) {
  const host = useRef(null),
    track = useRef(null),
    engine = useRef(null),
    latest = useRef({}),
    sceneState = useRef(null),
    filterState = useRef(null);
  latest.current = { onOpen, onTransitionEnd, onDismissOverlay };
  sceneState.current = { overlay, mode, project, phase, hovered, mouse, filtersOpen };
  filterState.current = visibleIds;
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    let disposed = false;
    const bootToken = beginBoot(projects.length + 3);
    setReady(false);
    // A case can survive a content-module refresh while its GL scene does not.
    // Restore its DOM sheet and media until the replacement scene can draw it.
    for (const view of document.querySelectorAll('.case-view.gl-case-ready'))
      view.classList.remove('gl-case-ready');
    for (const media of document.querySelectorAll('.case-view .gl-media-ready'))
      media.classList.remove('gl-media-ready');
    const scene = new PortfolioScene(host.current, track.current, projects, {
      onOpen: (p) => latest.current.onOpen(p),
      onDismissOverlay: () => latest.current.onDismissOverlay?.(),
      onTransitionEnd: (p) => latest.current.onTransitionEnd(p),
      bootEnabled: bootToken !== null,
      onBootProgress: (detail) => {
        if (!disposed && engine.current === scene) reportBoot(bootToken, detail);
      },
      onBootReady: () => {
        if (!disposed && engine.current === scene) completeBoot(bootToken);
      },
      onBootError: (error) => {
        if (!disposed && engine.current === scene) failBoot(bootToken, error);
      },
      onBootRevealFrame: (detail) => {
        if (!disposed && engine.current === scene) reportBootReveal(bootToken, detail);
      },
      onBootRevealComplete: () => {
        if (!disposed && engine.current === scene) finishBootReveal(bootToken);
      },
    });
    engine.current = scene;
    const unbindBoot = bindBootRenderer(bootToken, {
      setProgress: (value) => scene.setBootProgress?.(value),
      release: (rects) => scene.releaseBoot(rects),
    });
    scene.setState(sceneState.current);
    scene.setFilters(filterState.current);
    scene
      .start()
      .then(() => {
        if (disposed || engine.current !== scene) return;
        // Props may have changed while fonts, covers or the sky were loading.
        scene.setState(sceneState.current);
        scene.setFilters(filterState.current);
        setReady(true);
      })
      .catch((err) => {
        if (!disposed && engine.current === scene) {
          failBoot(bootToken, err);
          console.error('Portfolio scene:', err);
        }
      });
    return () => {
      disposed = true;
      unbindBoot();
      scene.dispose();
      if (engine.current === scene) engine.current = null;
    };
  }, [projects]);
  useLayoutEffect(() => {
    engine.current?.setState(sceneState.current);
  }, [overlay, mode, project, phase, hovered, mouse, filtersOpen]);
  useLayoutEffect(() => {
    engine.current?.setFilters(filterState.current);
  }, [visibleIds, projects]);
  const visible = visibleIds == null ? null : new Set(visibleIds),
    inputBlocked = Boolean(overlay || project || mode === 'full' || filtersOpen);
  return (
    <div
      ref={host}
      className={`gallery ${ready ? 'gl-ready' : ''} ${mode === 'full' ? 'gallery-full' : ''} ${project ? 'gallery-project' : ''}`}
    >
      <div
        className="gallery-viewport"
        aria-hidden={inputBlocked}
        inert={inputBlocked ? true : undefined}
      >
        <div className="gallery-track" ref={track}>
          {projects.map((p) => (
            <button
              className="gallery-card"
              key={p.id}
              data-id={p.id}
              data-gl="card"
              data-cover-video={typeof p.coverVideo === 'string' ? p.coverVideo : p.coverVideo?.src}
              hidden={visible ? !visible.has(p.id) : undefined}
              style={visible && !visible.has(p.id) ? { display: 'none' } : undefined}
              aria-label={`Open ${p.title}`}
              onClick={(e) => engine.current?.activate(p, e)}
            >
              <img
                alt=""
                width={p.coverWidth}
                height={p.coverHeight}
                draggable="false"
                onLoad={(e) => {
                  e.currentTarget.parentElement.style.setProperty(
                    '--aspect',
                    e.currentTarget.naturalWidth / e.currentTarget.naturalHeight,
                  );
                  engine.current?.measure();
                }}
              />
              <span className="gallery-tags">
                {(p.tags || [p.category]).map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </span>
              <span className="gallery-caption">{p.title}</span>
              <span className="gallery-arrow" aria-hidden="true">
                →
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="lens-disc" aria-hidden="true" />
    </div>
  );
}
