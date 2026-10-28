import { useEffect, useMemo, useRef, useState } from 'react';
import { DownloadSimpleIcon } from '@phosphor-icons/react/dist/csr/DownloadSimple';
import { ArrowUpRightIcon } from '@phosphor-icons/react/dist/csr/ArrowUpRight';
import { ArrowRightIcon } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { XIcon } from '@phosphor-icons/react/dist/csr/X';
import { StarFourIcon } from '@phosphor-icons/react/dist/csr/StarFour';
import { SquaresFourIcon } from '@phosphor-icons/react/dist/csr/SquaresFour';
import { FunnelSimpleIcon } from '@phosphor-icons/react/dist/csr/FunnelSimple';
import { CheckIcon } from '@phosphor-icons/react/dist/csr/Check';
import { DiceFiveIcon } from '@phosphor-icons/react/dist/csr/DiceFive';
import { ChatsCircleIcon } from '@phosphor-icons/react/dist/csr/ChatsCircle';
import { CurrencyBtcIcon } from '@phosphor-icons/react/dist/csr/CurrencyBtc';
import { StorefrontIcon } from '@phosphor-icons/react/dist/csr/Storefront';
import { StackIcon } from '@phosphor-icons/react/dist/csr/Stack';
import { HeartbeatIcon } from '@phosphor-icons/react/dist/csr/Heartbeat';
import Gallery from './Gallery.jsx';
import BootLoader from './BootLoader.jsx';
import { EmailCopy } from './ActionFeedback.jsx';
import CVPicker from './CVPicker.jsx';
import CaseView from './reference/CaseView.jsx';
import { projects } from './projects.js';
import { categories, filterProjects, groupedProjects } from './projectTaxonomy.js';
import { readTags, readAllGallery, selectionUrl, visibleSelection } from './portfolioSelection.js';
import { projectLabel } from './projectLabels.js';
import { readRoute } from './portfolioRoutes.js';
const links = {
  linkedin: 'https://www.linkedin.com/in/atishenko/',
  telegram: 'https://t.me/l91111',
  whatsapp: 'https://wa.me/380639465213?s=p',
  email: 'mailto:oleksii.tyshhenko.work@gmail.com',
};
const filtersSeenKey = 'oleksii.portfolio.filters-seen.v1';
function readFiltersSeen() {
  if (typeof window === 'undefined') return false;
  for (const name of ['localStorage', 'sessionStorage'])
    try {
      if (window[name]?.getItem(filtersSeenKey) === '1') return true;
    } catch {}
  return false;
}
function rememberFiltersSeen() {
  for (const name of ['localStorage', 'sessionStorage'])
    try {
      const storage = window[name];
      if (storage) {
        storage.setItem(filtersSeenKey, '1');
        return;
      }
    } catch {}
}
const categoryIcons = {
  igaming: DiceFiveIcon,
  'ai-chat-ux': ChatsCircleIcon,
  'fintech-web3': CurrencyBtcIcon,
  marketplaces: StorefrontIcon,
  'saas-crm': StackIcon,
  medtech: HeartbeatIcon,
};
function CategoryIcon({ id, ...props }) {
  const Icon = categoryIcons[id] || SquaresFourIcon;
  return <Icon {...props} aria-hidden="true" />;
}
function route() {
  return readRoute(location.pathname, projects);
}
function SocialLinks() {
  return (
    <nav className="social-links" aria-label="Contact Oleksii">
      <a href={links.linkedin} target="_blank" rel="noreferrer">
        LinkedIn
        <ArrowUpRightIcon aria-hidden="true" />
      </a>
      <a href={links.telegram} target="_blank" rel="noreferrer">
        Telegram
        <ArrowUpRightIcon aria-hidden="true" />
      </a>
      <a href={links.whatsapp} target="_blank" rel="noreferrer">
        WhatsApp
        <ArrowUpRightIcon aria-hidden="true" />
      </a>
      <EmailCopy
        address={links.email.slice(7)}
        telegram={links.telegram}
        linkedin={links.linkedin}
      />
    </nav>
  );
}
export function App() {
  const initial = route();
  const [view, setView] = useState(initial.view),
    [project, setProject] = useState(initial.project),
    [phase, setPhase] = useState(initial.project ? 'opening' : 'settled'),
    [overlay, setOverlay] = useState(null),
    [lightbox, setLightbox] = useState(null),
    [hovered, setHovered] = useState(0);
  const [selected, setSelected] = useState(() => readTags(location.search));
  const filtersOpen = overlay === 'filters';
  const [allGallery, setAllGallery] = useState(() => readAllGallery(location.search));
  const [filtersSeen, setFiltersSeen] = useState(readFiltersSeen);
  const filterTrigger = useRef(null);
  const cvTrigger = useRef(null);
  const closeOverlay = () => {
    setOverlay(null);
    if (overlay === 'cv') cvTrigger.current?.focus({ preventScroll: true });
  };
  const visibleProjects = useMemo(
    () => visibleSelection(projects, selected, view, allGallery),
    [selected, view, allGallery],
  );
  const featuredCount = useMemo(() => visibleSelection(projects, []).length, [projects]);
  const matchingProjects = useMemo(() => filterProjects(projects, selected), [selected]);
  const matchingIds = useMemo(() => new Set(matchingProjects.map((p) => p.id)), [matchingProjects]);
  const visibleIds = useMemo(() => visibleProjects.map((p) => p.id), [visibleProjects]);
  const groups = useMemo(() => groupedProjects(visibleProjects), [visibleProjects]);
  const hasFilters = selected.length > 0;
  const href = (path) => selectionUrl(path, selected, location.search, allGallery);
  const navigate = (path) => history.pushState({}, '', href(path));
  const updateSelection = (next) => {
    setSelected(next);
    setAllGallery(false);
    history.pushState({}, '', selectionUrl(location.pathname, next, location.search, false));
  };
  const openProject = (p) => {
    setOverlay(null);
    setLightbox(null);
    setProject(p);
    setPhase('opening');
    navigate(`/projects/${p.slug}`);
  };
  const closeProject = () => {
    setLightbox(null);
    setView('featured');
    setPhase('closing');
    navigate('/');
  };
  const onTransitionEnd = (direction) => {
    if (direction === 'closing') {
      setProject(null);
      setPhase('settled');
      requestAnimationFrame(() => {
        const live =
          document.querySelector(`[data-gl="card"][data-id="${project?.id}"]:not([hidden])`) ||
          document.querySelector(`[data-project-id="${project?.id}"]`) ||
          document.querySelector('.brand');
        live?.focus({ preventScroll: true });
      });
    } else setPhase('settled');
  };
  const changeView = (next, tags = selected, all = allGallery) => {
    setOverlay(null);
    setProject(null);
    setPhase('settled');
    setView(next);
    history.pushState(
      {},
      '',
      selectionUrl(next === 'full' ? '/full' : '/', tags, location.search, all),
    );
  };
  const moveProject = (direction) => {
    if (!project) return;
    const list = visibleProjects.some((p) => p.id === project.id) ? visibleProjects : projects;
    const i = list.findIndex((p) => p.id === project.id);
    if (list.length > 1) openProject(list[(i + direction + list.length) % list.length]);
  };
  const clearFilters = () => updateSelection([]);
  const toggleCategory = (id) =>
    updateSelection(
      selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id],
    );
  const showAllCases = () => {
    setSelected([]);
    setAllGallery(true);
    changeView('featured', [], true);
    filterTrigger.current?.focus();
  };
  const showFeaturedCases = () => {
    setSelected([]);
    setAllGallery(false);
    changeView('featured', [], false);
    filterTrigger.current?.focus();
  };
  const toggleOverlay = (next) => {
    if (next === 'filters' && !filtersSeen) {
      setFiltersSeen(true);
      rememberFiltersSeen();
    }
    setOverlay((current) => (current === next ? null : next));
  };
  useEffect(() => {
    const pop = () => {
      const r = route();
      setSelected(readTags(location.search));
      setAllGallery(readAllGallery(location.search));
      if (!r.project && project) {
        setPhase('closing');
        setView(r.view);
      } else {
        setProject(r.project);
        setView(r.view);
        setPhase(r.project ? 'opening' : 'settled');
      }
      setOverlay(null);
      setLightbox(null);
    };
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, [project]);
  useEffect(() => {
    if (!lightbox) return;
    const prior = document.activeElement;
    document.querySelector('.lightbox-close')?.focus();
    return () => {
      if (prior?.isConnected) {
        prior.dataset.restoreFocus = 'true';
        prior.focus({ preventScroll: true });
        delete prior.dataset.restoreFocus;
      }
    };
  }, [lightbox]);
  useEffect(() => {
    document.title = project
      ? `${project.title} | Oleksii Tyshchenko`
      : 'Oleksii Tyshchenko | Product Designer';
  }, [project]);
  useEffect(() => {
    const key = (e) => {
      if (e.key !== 'Escape') return;
      if (lightbox) {
        e.preventDefault();
        setLightbox(null);
      } else if (overlay) {
        setOverlay(null);
        if (filtersOpen) filterTrigger.current?.focus();
        if (overlay === 'cv') cvTrigger.current?.focus({ preventScroll: true });
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [overlay, lightbox, filtersOpen]);
  return (
    <>
      <BootLoader />
      <main
        inert={lightbox ? true : undefined}
        className={`portfolio ${project ? 'has-project' : ''} ${overlay ? `is-${overlay}` : ''} ${view === 'full' ? 'is-index' : ''}`}
      >
        <Gallery
          onDismissOverlay={closeOverlay}
          projects={projects}
          visibleIds={visibleIds}
          filtersOpen={filtersOpen}
          onOpen={openProject}
          overlay={overlay}
          mode={view}
          project={project}
          phase={phase}
          onTransitionEnd={onTransitionEnd}
          hovered={hovered}
        />
        <header className="site-header" inert={project ? true : undefined} aria-hidden={!!project}>
          <div className="header-blur" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <div className="header-inner">
            <a
              className="brand"
              href={href('/')}
              onClick={(e) => {
                e.preventDefault();
                changeView('featured');
              }}
            >
              Oleksii Tyshchenko
            </a>
            <nav className="header-nav" aria-label="Project views">
              <a
                href={href('/')}
                aria-current={view === 'featured' ? 'page' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  changeView('featured');
                }}
              >
                <StarFourIcon
                  weight={view === 'featured' ? 'fill' : 'regular'}
                  aria-hidden="true"
                />
                Featured
              </a>
              <a
                href={href('/full')}
                aria-current={view === 'full' ? 'page' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  changeView('full');
                }}
              >
                <SquaresFourIcon weight={view === 'full' ? 'fill' : 'regular'} aria-hidden="true" />
                All cases
              </a>
              <button
                ref={filterTrigger}
                className={`icon-button filter-trigger ${hasFilters ? 'is-active' : ''}`}
                aria-label={
                  hasFilters
                    ? `Filter projects, ${matchingProjects.length} ${matchingProjects.length === 1 ? 'match' : 'matches'}`
                    : 'Filter projects'
                }
                aria-expanded={filtersOpen}
                aria-controls="filters-panel"
                onClick={() => toggleOverlay('filters')}
                title="Filter projects"
              >
                <FunnelSimpleIcon aria-hidden="true" />
                {hasFilters && <span className="filter-badge">{selected.length || 1}</span>}
                {!hasFilters && !filtersSeen && (
                  <span className="filter-attention-dot" aria-hidden="true" />
                )}
              </button>
            </nav>
            <div className="header-actions">
              <a
                className="header-link"
                href="#profile"
                aria-expanded={overlay === 'profile'}
                aria-controls="profile-panel"
                onClick={(e) => {
                  e.preventDefault();
                  toggleOverlay('profile');
                }}
              >
                About
              </a>
              <a
                className="header-link"
                href="#contact"
                aria-expanded={overlay === 'contact'}
                aria-controls="contact-panel"
                onClick={(e) => {
                  e.preventDefault();
                  toggleOverlay('contact');
                }}
              >
                Contact
              </a>
              <button
                ref={cvTrigger}
                className="action-button primary-action"
                aria-label="Choose a CV"
                aria-expanded={overlay === 'cv'}
                aria-controls="cv-panel"
                onClick={() => toggleOverlay('cv')}
              >
                <DownloadSimpleIcon aria-hidden="true" />
                <span>
                  <span className="download-word">Download </span>CV
                </span>
              </button>
            </div>
          </div>
          {hasFilters && !overlay && (
            <div className="filter-summary">
              <span>
                {view === 'full'
                  ? `${matchingProjects.length} ${matchingProjects.length === 1 ? 'match' : 'matches'} highlighted`
                  : `${visibleProjects.length} of ${projects.length} cases`}
              </span>
              <button onClick={clearFilters}>
                Clear filters <XIcon size={12} aria-hidden="true" />
              </button>
            </div>
          )}
        </header>
        {filtersOpen && !project && (
          <section
            className="center-panel filters-panel"
            id="filters-panel"
            role="dialog"
            aria-label="Project filters"
            data-gl-shield
          >
            <div className="filters-heading">
              <h2>Explore by category</h2>
              <button
                className="icon-button"
                aria-label="Close filters"
                onClick={() => {
                  setOverlay(null);
                  filterTrigger.current?.focus();
                }}
              >
                <XIcon aria-hidden="true" />
              </button>
            </div>
            <div className="filters-status">
              <p className="filters-caption" role="status">
                {hasFilters
                  ? `${matchingProjects.length} of ${projects.length} cases match`
                  : `Showing ${visibleProjects.length} of ${projects.length} cases`}
              </p>
              <button
                className="text-button"
                onClick={clearFilters}
                disabled={!hasFilters && !allGallery}
              >
                Reset
              </button>
            </div>
            <div className="category-options">
              {categories.map((category) => (
                <button
                  key={category.id}
                  className="category-option"
                  aria-pressed={selected.includes(category.id)}
                  onClick={() => toggleCategory(category.id)}
                >
                  <CategoryIcon id={category.id} />
                  <span>{category.label}</span>
                  <span className="category-count">
                    {filterProjects(projects, [category.id]).length}
                  </span>
                  <span className="category-check">
                    {selected.includes(category.id) && (
                      <CheckIcon size={12} weight="bold" aria-hidden="true" />
                    )}
                  </span>
                </button>
              ))}
            </div>
            <div className="filters-bottom">
              <button
                className="action-button secondary-action"
                onClick={allGallery ? showFeaturedCases : showAllCases}
                aria-label={
                  allGallery
                    ? `Show ${featuredCount} featured cases in the gallery`
                    : `Show all ${projects.length} cases in the gallery`
                }
              >
                {allGallery
                  ? `Show ${featuredCount} featured`
                  : `Show all ${projects.length} ${projects.length === 1 ? 'case' : 'cases'}`}{' '}
                <ArrowRightIcon aria-hidden="true" />
              </button>
              <button
                className="action-button primary-action"
                onClick={() => {
                  setOverlay(null);
                  filterTrigger.current?.focus();
                }}
              >
                {allGallery
                  ? `Keep all ${projects.length} ${projects.length === 1 ? 'case' : 'cases'}`
                  : view === 'full'
                    ? hasFilters
                      ? `Highlight ${matchingProjects.length} ${matchingProjects.length === 1 ? 'case' : 'cases'}`
                      : `Back to all ${projects.length} ${projects.length === 1 ? 'case' : 'cases'}`
                    : !hasFilters
                      ? `Keep ${featuredCount} featured`
                      : `Show ${visibleProjects.length} featured`}{' '}
                <ArrowRightIcon aria-hidden="true" />
              </button>
            </div>
          </section>
        )}
        {!visibleProjects.length && !project && !overlay && (
          <section className="empty-projects">
            <FunnelSimpleIcon size={30} weight="light" aria-hidden="true" />
            <h1>No matching cases</h1>
            <p>Try another category.</p>
            <button className="action-button primary-action" onClick={clearFilters}>
              Clear filters
            </button>
          </section>
        )}
        {view === 'full' && !project && visibleProjects.length > 0 && (
          <section
            className="full-index"
            inert={overlay || filtersOpen ? true : undefined}
            aria-hidden={!!overlay}
            aria-label="All cases by category"
          >
            <div className="index-heading">
              <h1>All cases</h1>
            </div>
            <div className="index-groups">
              {groups.map((group) => (
                <section
                  className="case-group"
                  key={group.id}
                  aria-labelledby={`category-${group.id}`}
                >
                  <h2 id={`category-${group.id}`}>
                    <CategoryIcon id={group.id} />
                    {group.label}
                    <span>{group.projects.length.toString().padStart(2, '0')}</span>
                  </h2>
                  <div className="case-group-projects">
                    {group.projects.map((p) => {
                      const i = projects.findIndex((item) => item.id === p.id);
                      return (
                        <button
                          className="case-link"
                          key={p.id}
                          data-project-id={p.id}
                          data-title={projectLabel(p)}
                          data-filter-match={hasFilters ? matchingIds.has(p.id) : undefined}
                          style={{ '--order': i }}
                          onPointerEnter={() => setHovered(i)}
                          onFocus={() => setHovered(i)}
                          onClick={() => openProject(p)}
                        >
                          <span className="case-link-label">{projectLabel(p)}</span>
                          <ArrowUpRightIcon aria-hidden="true" />
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </section>
        )}
        {overlay && overlay !== 'filters' && !project && (
          <section
            className={`center-panel ${overlay}-panel`}
            key={overlay}
            id={`${overlay}-panel`}
            aria-label={
              overlay === 'profile'
                ? 'About Oleksii'
                : overlay === 'cv'
                  ? 'Choose a CV'
                  : 'Get in touch'
            }
            role={overlay === 'cv' ? 'dialog' : undefined}
            data-gl-shield
          >
            <button
              className="icon-button panel-close"
              aria-label={
                overlay === 'profile'
                  ? 'Close about'
                  : overlay === 'cv'
                    ? 'Close CV selection'
                    : 'Close contact'
              }
              onClick={closeOverlay}
            >
              <XIcon aria-hidden="true" />
            </button>
            {overlay === 'profile' ? (
              <>
                <h1 className="sr-only">Oleksii Tyshchenko, Senior Product Designer</h1>
                <p>
                  I'm Oleksii, a senior product designer with 5+ years of experience working across
                  iGaming, FinTech, Web3 and AI. I design mobile apps, chat experiences and complex
                  platforms, bringing clear flows, thoughtful interfaces and reusable design systems
                  together.
                </p>
                <SocialLinks />
                <button
                  className="cv-download label"
                  aria-label="Choose a CV"
                  aria-controls="cv-panel"
                  onClick={() => setOverlay('cv')}
                >
                  Download CV <DownloadSimpleIcon aria-hidden="true" />
                </button>
                <p className="profile-build-note">
                  Designed and built by me, from visual direction to the final experience, using AI
                  to turn design ideas into working code.
                </p>
              </>
            ) : overlay === 'cv' ? (
              <CVPicker />
            ) : (
              <>
                <h1>Let's talk.</h1>
                <p>
                  Have a role or a product in mind?
                  <br />
                  Find me on LinkedIn or Telegram.
                </p>
                <SocialLinks />
              </>
            )}
          </section>
        )}
        <footer className="site-footer" inert={project ? true : undefined} aria-hidden={!!project}>
          <span>
            <img
              className="footer-portrait"
              src="/assets/oleksii-portrait-96.webp"
              alt=""
              width="20"
              height="20"
            />
            <span>
              Designed and built by{' '}
              <a href={links.linkedin} target="_blank" rel="noreferrer">
                Oleksii Tyshchenko <ArrowUpRightIcon aria-hidden="true" />
              </a>
            </span>
          </span>
        </footer>
      </main>
      {project && (
        <div inert={lightbox ? true : undefined}>
          <CaseView
            project={project}
            projects={visibleProjects.some((p) => p.id === project.id) ? visibleProjects : projects}
            onClose={closeProject}
            onMove={moveProject}
            onLightbox={setLightbox}
            transitionState={phase}
          />
        </div>
      )}
      {lightbox && (
        <div
          className="lightbox"
          onKeyDown={(e) => {
            if (e.key === 'Tab') {
              e.preventDefault();
              e.currentTarget.querySelector('button')?.focus();
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Enlarged project image"
          onClick={() => setLightbox(null)}
        >
          <button
            className="round-button lightbox-close"
            aria-label="Close enlarged image"
            onClick={() => setLightbox(null)}
          >
            <XIcon size={18} />
          </button>
          <img
            src={lightbox.src}
            alt={lightbox.alt || project.title}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
