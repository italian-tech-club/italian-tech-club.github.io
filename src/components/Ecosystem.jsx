import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Home, Search, X, SlidersHorizontal, BookOpen } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import EcosystemGraph from './EcosystemGraph';
import EcosystemOrgCard, { TieDot, EDGE_KINDS } from './EcosystemOrgCard';
import { useTheme } from '../context/ThemeContext';
import { ORGS, EDGES, CLUSTERS, TIES, TIE_ORDER, ITC_ID, findOrg } from '../data/ecosystem';

// /ecosystem is the map and almost nothing else: full-bleed canvas, floating
// chrome, no scrolling. Everything that wants a paragraph lives on
// /ecosystem/about, which is linked from the corner.
//
// Unlisted on purpose — reachable by URL, absent from the nav and the homepage.

const matches = (org, query) => {
  if (!query) return true;
  const haystack = [org.name, org.short, org.blurb, org.city, org.tieNote, ...(org.tags || [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
};

const panelClasses =
  'rounded-2xl border border-slate-200 bg-white/90 shadow-lg shadow-slate-900/5 backdrop-blur-md dark:border-slate-700/70 dark:bg-slate-900/85';

const Chip = ({ active, onClick, children, title }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
      active
        ? 'border-itc-green bg-itc-green/10 text-itc-green'
        : 'border-slate-200 bg-white/80 text-slate-600 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:text-white'
    }`}
  >
    {children}
  </button>
);

const Ecosystem = () => {
  const { theme } = useTheme();
  const [query, setQuery] = useState('');
  const [activeClusters, setActiveClusters] = useState([]);
  const [activeTies, setActiveTies] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showLegend, setShowLegend] = useState(false);

  useEffect(() => {
    document.title = 'Ecosystem Map — Italian Tech Club NYC';
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setSelectedId(null);
        setShowLegend(false);
        setShowFilters(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggle = (list, value) =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

  // ITC always stays on the map: every radius is measured from it.
  const visibleOrgs = useMemo(
    () =>
      ORGS.filter(
        (org) =>
          org.id === ITC_ID ||
          (matches(org, query) &&
            (activeClusters.length === 0 || activeClusters.includes(org.cluster)) &&
            (activeTies.length === 0 || activeTies.includes(org.tie))),
      ),
    [query, activeClusters, activeTies],
  );

  const linkedCount = useMemo(
    () => ORGS.filter((org) => org.id !== ITC_ID && org.tie !== 'none').length,
    [],
  );

  const selected = selectedId ? findOrg(selectedId) : null;
  const filtersOn = query || activeClusters.length > 0 || activeTies.length > 0;

  const clearFilters = () => {
    setQuery('');
    setActiveClusters([]);
    setActiveTies([]);
  };

  return (
    <div className="fixed inset-0 overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Canvas */}
      <div className="absolute inset-0">
        <EcosystemGraph
          orgs={visibleOrgs}
          edges={EDGES}
          theme={theme}
          selectedId={selectedId}
          hoveredId={hoveredId}
          cardOpen={Boolean(selectedId)}
          filtered={Boolean(filtersOn)}
          focusClusterId={activeClusters.length === 1 ? activeClusters[0] : null}
          onSelect={setSelectedId}
          onHover={setHoveredId}
        />
      </div>

      {/* Top-left: identity */}
      <div className="pointer-events-none absolute left-4 top-4 flex items-start gap-2">
        <Link
          to="/"
          className="pointer-events-auto rounded-xl border border-slate-200 bg-white/85 p-2.5 text-slate-600 shadow-sm backdrop-blur transition-colors hover:text-itc-green dark:border-slate-700 dark:bg-slate-900/85 dark:text-slate-300"
          title="Italian Tech Club NYC"
        >
          <Home className="h-4 w-4" />
        </Link>
        <div className={`pointer-events-auto max-w-[calc(100vw-13.5rem)] px-3.5 py-2.5 sm:max-w-none sm:px-4 ${panelClasses}`}>
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-5 shrink-0 overflow-hidden rounded-sm" aria-hidden="true">
              <span className="w-1/3 bg-itc-green" />
              <span className="w-1/3 bg-itc-white" />
              <span className="w-1/3 bg-itc-red" />
            </span>
            <h1 className="truncate font-display text-sm font-extrabold tracking-tight text-slate-900 dark:text-white">
              <span className="sm:hidden">Italian ecosystem</span>
              <span className="hidden sm:inline">Italian ecosystem of New York</span>
            </h1>
          </div>
          <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {ORGS.length} organizations · {linkedCount} linked to ITC
            <span className="hidden text-slate-400 dark:text-slate-500 sm:inline">
              {' '}
              · {visibleOrgs.length === ORGS.length ? 'all shown' : `${visibleOrgs.length} shown`}
            </span>
          </p>
        </div>
      </div>

      {/* Top-right: tools */}
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setShowFilters((open) => !open);
            setShowLegend(false);
          }}
          className={`rounded-xl border p-2.5 shadow-sm backdrop-blur transition-colors ${
            showFilters || filtersOn
              ? 'border-itc-green bg-itc-green/10 text-itc-green'
              : 'border-slate-200 bg-white/85 text-slate-600 hover:text-itc-green dark:border-slate-700 dark:bg-slate-900/85 dark:text-slate-300'
          }`}
          title="Search and filter"
          aria-label="Search and filter"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            setShowLegend((open) => !open);
            setShowFilters(false);
          }}
          className={`rounded-xl border p-2.5 shadow-sm backdrop-blur transition-colors ${
            showLegend
              ? 'border-itc-green bg-itc-green/10 text-itc-green'
              : 'border-slate-200 bg-white/85 text-slate-600 hover:text-itc-green dark:border-slate-700 dark:bg-slate-900/85 dark:text-slate-300'
          }`}
          title="How to read the map"
          aria-label="How to read the map"
        >
          <BookOpen className="h-4 w-4" />
        </button>
        <ThemeToggle className="shadow-sm backdrop-blur" />
      </div>

      {/* Filter drawer */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className={`absolute right-4 top-[4.5rem] z-20 w-[min(22rem,calc(100vw-2rem))] p-4 ${panelClasses}`}
          >
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${ORGS.length} organizations`}
                className="w-full rounded-full border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-itc-green focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              Clusters
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {CLUSTERS.filter((cluster) => cluster.id !== 'itc').map((cluster) => (
                <Chip
                  key={cluster.id}
                  active={activeClusters.includes(cluster.id)}
                  onClick={() => setActiveClusters((list) => toggle(list, cluster.id))}
                  title={cluster.blurb}
                >
                  {cluster.mapLabel}
                </Chip>
              ))}
            </div>

            <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              Our tie
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {TIE_ORDER.map((tie) => (
                <Chip
                  key={tie}
                  active={activeTies.includes(tie)}
                  onClick={() => setActiveTies((list) => toggle(list, tie))}
                  title={TIES[tie].blurb}
                >
                  <TieDot tie={tie} theme={theme} />
                  {TIES[tie].label}
                </Chip>
              ))}
            </div>

            {filtersOn && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-itc-red dark:text-slate-400"
              >
                <X className="h-3.5 w-3.5" /> Clear filters
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend drawer */}
      <AnimatePresence>
        {showLegend && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className={`absolute right-4 top-[4.5rem] z-20 w-[min(22rem,calc(100vw-2rem))] p-4 ${panelClasses}`}
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              Colour — our tie to them
            </p>
            <ul className="mt-2 space-y-1.5">
              {TIE_ORDER.map((tie) => (
                <li key={tie} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <TieDot tie={tie} theme={theme} />
                  <span className="font-semibold text-slate-900 dark:text-white">{TIES[tie].label}</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {ORGS.filter((org) => org.tie === tie).length}
                  </span>
                </li>
              ))}
            </ul>

            <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              Lines — kind of link
            </p>
            <ul className="mt-2 space-y-1.5">
              {EDGE_KINDS.map((entry) => (
                <li key={entry.kind} className="flex items-center gap-3">
                  <svg viewBox="0 0 40 8" className="h-2 w-10 shrink-0" aria-hidden="true">
                    <line
                      x1="0"
                      y1="4"
                      x2="40"
                      y2="4"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeDasharray={entry.dash || undefined}
                      className="text-slate-400 dark:text-slate-500"
                    />
                  </svg>
                  <span className="text-xs text-slate-600 dark:text-slate-300">{entry.label}</span>
                </li>
              ))}
            </ul>

            <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              Reading the map
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              ITC sits at the centre. The named ring around it is everyone we have actually worked with. The
              eight discs hold the rest of the city, one per cluster — click a disc, or zoom into it, and it
              opens into its organizations. Click a node for its card.
            </p>
            <Link
              to="/ecosystem/about"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-itc-green hover:underline"
            >
              How this map was built <span aria-hidden="true">→</span>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selection card */}
      <AnimatePresence>
        {selected && (
          <motion.aside
            key={selected.id}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className={`absolute z-30 overflow-y-auto p-5 ${panelClasses} inset-x-3 bottom-3 max-h-[62vh] sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-20 sm:w-[23rem] sm:max-h-none`}
          >
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="absolute right-3 top-3 rounded-full p-1.5 text-slate-400 transition-colors hover:text-itc-red"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
            <EcosystemOrgCard org={selected} theme={theme} onSelect={setSelectedId} />
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Bottom-left: the only copy the map carries. On a phone the screen is
          the scarce resource, so it collapses to the legend button instead. */}
      <div className={`absolute bottom-4 left-4 hidden max-w-[19rem] px-3.5 py-2.5 sm:block ${panelClasses}`}>
        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          ITC at the centre, the {linkedCount} organizations we have worked with named around it. The eight
          discs are the rest of the city — click one to open it.{' '}
          <Link to="/ecosystem/about" className="font-semibold text-itc-green hover:underline">
            Read the map →
          </Link>
        </p>
        <p className="mt-2 text-[11px] font-medium text-slate-400 dark:text-slate-500">
          Scroll to zoom · drag to pan · double-click to move in
        </p>
      </div>
    </div>
  );
};

export default Ecosystem;
