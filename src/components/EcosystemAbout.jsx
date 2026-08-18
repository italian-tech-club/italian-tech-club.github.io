import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Home, ArrowLeft, Compass } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import SectionEyebrow from './SectionEyebrow';
import EcosystemLogo from './EcosystemLogo';
import EcosystemOrgCard, { TieDot, EDGE_KINDS } from './EcosystemOrgCard';
import { useTheme } from '../context/ThemeContext';
import { ORGS, EDGES, CLUSTERS, TIES, TIE_ORDER, ITC_ID, findOrg } from '../data/ecosystem';
import { fadeRise, VIEWPORT } from '../lib/motion';

// The written half of /ecosystem: legend, method, and the whole directory in a
// form you can read without a mouse. The map is the front door; this is the
// footnotes, and it keeps the map itself free of paragraphs.

const EcosystemAbout = () => {
  const { theme } = useTheme();
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    document.title = 'Reading the ecosystem map — Italian Tech Club NYC';
  }, []);

  const counts = useMemo(() => {
    const byTie = ORGS.reduce((map, org) => {
      map[org.tie] = (map[org.tie] || 0) + 1;
      return map;
    }, {});
    return {
      total: ORGS.length,
      byTie,
      linked: ORGS.filter((org) => org.id !== ITC_ID && org.tie !== 'none').length,
      clusters: CLUSTERS.length - 1,
      edges: EDGES.length,
    };
  }, []);

  const open = openId ? findOrg(openId) : null;

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 transition-colors duration-300 dark:bg-slate-950">
      <div className="absolute left-6 right-6 top-6 z-20 flex items-center justify-between">
        <Link
          to="/"
          className="rounded-full border border-slate-200 bg-white/80 p-3 text-slate-600 shadow-sm backdrop-blur-sm transition-all hover:text-itc-green hover:shadow-md dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-400 dark:hover:text-itc-green"
        >
          <Home className="h-5 w-5" />
        </Link>
        <ThemeToggle className="shadow-sm hover:shadow-md" />
      </div>

      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute -left-40 -top-40 h-[40rem] w-[40rem] rounded-full bg-itc-green/8 blur-3xl dark:bg-itc-green/10" />
        <div className="absolute -right-40 top-1/3 h-[40rem] w-[40rem] rounded-full bg-itc-red/8 blur-3xl dark:bg-itc-red/10" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 pb-20 pt-24">
        <motion.div variants={fadeRise} initial="hidden" animate="show" className="mb-12">
          <SectionEyebrow className="mb-5">Ecosystem map</SectionEyebrow>
          <h1 className="max-w-3xl font-display text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
            Reading the map
          </h1>
          <p className="mt-4 max-w-2xl text-base text-slate-600 dark:text-slate-400">
            {counts.total} organizations that connect Italians in and around New York, {counts.edges}{' '}
            documented links between them, and an honest count of the {counts.linked} we have actually worked
            with.
          </p>
          <Link
            to="/ecosystem"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-itc-green dark:bg-white dark:text-slate-900 dark:hover:bg-itc-green dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Back to the map
          </Link>
        </motion.div>

        {/* Legend */}
        <motion.div
          variants={fadeRise}
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT}
          className="grid gap-8 rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 sm:p-8 lg:grid-cols-3"
        >
          <div>
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              <Compass className="h-3.5 w-3.5" /> Colour — our tie
            </p>
            <ul className="mt-3 space-y-3">
              {TIE_ORDER.map((tie) => (
                <li key={tie} className="flex items-start gap-2.5">
                  <TieDot tie={tie} theme={theme} className="mt-0.5" />
                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    <span className="font-semibold text-slate-900 dark:text-white">{TIES[tie].label}</span>
                    <span className="text-slate-400 dark:text-slate-500"> — {counts.byTie[tie] || 0}</span>
                    <span className="block text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                      {TIES[tie].blurb}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              Position — three tiers
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              ITC is the centre. The named ring around it is every organization we have actually worked with.
              Everyone else is held in eight cluster discs, one per cluster, each carrying its own count — one
              disc per direction, so a cluster always sits in the same place.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              On the map: click a disc, or move into it, and it opens into its organizations on one named ring.
              Scroll or pinch to zoom, drag to pan, click a node for its card, and search to open every disc at
              once. All {counts.total} are reachable; none of them are on screen at the same time.
            </p>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              Lines — kind of link
            </p>
            <ul className="mt-3 space-y-2">
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
                  <span className="text-sm text-slate-600 dark:text-slate-300">{entry.label}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              A line is drawn only where there is a public trace of the two doing something together. Sitting
              in the same cluster is not a link.
            </p>
          </div>
        </motion.div>

        {/* Directory */}
        <div className="mt-16">
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            The whole directory
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            Cluster by cluster. Click any organization to read its card.
          </p>

          <div className="mt-8 space-y-10">
            {CLUSTERS.map((cluster) => {
              const rows = ORGS.filter((org) => org.cluster === cluster.id);
              if (rows.length === 0) return null;
              return (
                <div key={cluster.id}>
                  <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                      {cluster.name}
                    </h3>
                    <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                      {rows.length}
                    </span>
                    <p className="w-full text-sm text-slate-500 dark:text-slate-400 sm:w-auto sm:flex-1">
                      {cluster.blurb}
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {rows.map((org) => (
                      <button
                        key={org.id}
                        type="button"
                        onClick={() => setOpenId(org.id === openId ? null : org.id)}
                        className={`group flex items-start gap-3 rounded-2xl border p-4 text-left transition-[border-color,transform] duration-300 ease-out-quint hover:-translate-y-0.5 hover:border-itc-green/50 ${
                          openId === org.id
                            ? 'border-itc-green bg-white dark:bg-slate-900'
                            : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                        }`}
                      >
                        <EcosystemLogo org={org} theme={theme} size="h-10 w-10" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-slate-900 group-hover:text-itc-green dark:text-white">
                            {org.short}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
                            {org.city}
                          </span>
                          <span className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            <TieDot tie={org.tie} theme={theme} />
                            {TIES[org.tie].label}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Provenance */}
        <div className="mt-16 rounded-3xl bg-slate-900 p-6 text-white sm:p-10 dark:bg-black">
          <h2 className="font-display text-xl font-bold sm:text-2xl">How it was built</h2>
          <div className="mt-4 grid gap-6 text-sm leading-relaxed text-slate-400 sm:grid-cols-2">
            <p>
              Public sources only: each organization&apos;s own site, its published events and partner lists,
              press coverage, and the Consulate&apos;s register of Italian associations in New York. ITC ties
              come from our own event history and partner agreements — nothing is promoted to
              &quot;partner&quot; on the strength of an introduction.
            </p>
            <p>
              It is a snapshot, and it will go stale. Missing an organization, or is a link wrong or out of
              date? Tell us and we&apos;ll fix the map:{' '}
              <a href="mailto:ciao@italiantechclubnyc.com" className="font-medium text-white hover:underline">
                ciao@italiantechclubnyc.com
              </a>
              .
            </p>
          </div>
        </div>
      </div>

      {/* Card for the row being read */}
      {open && (
        <motion.aside
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-x-3 bottom-3 z-40 max-h-[70vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-2xl backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/95 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:max-h-[80vh] sm:w-[23rem]"
        >
          <button
            type="button"
            onClick={() => setOpenId(null)}
            className="absolute right-3 top-3 text-xs font-semibold text-slate-400 hover:text-itc-red"
          >
            Close
          </button>
          <EcosystemOrgCard org={open} theme={theme} onSelect={setOpenId} />
        </motion.aside>
      )}
    </div>
  );
};

export default EcosystemAbout;
