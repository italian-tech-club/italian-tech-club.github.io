import React from 'react';
import { ArrowUpRight, MapPin, Calendar, Link2 } from 'lucide-react';
import EcosystemLogo from './EcosystemLogo';
import { TIES, CLUSTER_BY_ID, findOrg, connectionsFor } from '../data/ecosystem';

// Shared vocabulary between the map and the written page: the tie mark, the tie
// badge, and the card for one organization. Kept in one file so the legend on
// either page can never drift from the marks in the drawing.

export const EDGE_KINDS = [
  { kind: 'partner', label: 'Formal partnership', dash: null },
  { kind: 'cohost', label: 'Built something together', dash: null },
  { kind: 'institutional', label: 'Endorsement, oversight or funding', dash: '7 6' },
  { kind: 'network', label: 'Same family or umbrella', dash: '2 6' },
  { kind: 'venue', label: 'Hosted at', dash: '12 5 2 5' },
];

const EDGE_KIND_LABEL = EDGE_KINDS.reduce((map, entry) => {
  map[entry.kind] = entry.label;
  return map;
}, {});

export const TieDot = ({ tie, theme, className = '' }) => {
  const color = theme === 'dark' ? TIES[tie].dark : TIES[tie].light;
  return (
    <svg viewBox="0 0 24 24" className={`h-4 w-4 shrink-0 ${className}`} aria-hidden="true">
      <circle cx="12" cy="12" r="6" fill={color} opacity={tie === 'none' ? 0.85 : 1} />
      {tie === 'network' && <circle cx="12" cy="12" r="9.5" fill="none" stroke={color} strokeWidth="1.6" />}
      {tie === 'partner' && (
        <>
          <circle cx="12" cy="12" r="8.4" fill="none" stroke={color} strokeWidth="1.1" />
          <circle cx="12" cy="12" r="11" fill="none" stroke={color} strokeWidth="1.1" />
        </>
      )}
      {tie === 'collaborator' && (
        <circle cx="12" cy="12" r="9.5" fill="none" stroke={color} strokeWidth="1.6" strokeDasharray="3 2.4" />
      )}
    </svg>
  );
};

export const TieBadge = ({ tie, theme }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
    <TieDot tie={tie} theme={theme} />
    {TIES[tie].label}
  </span>
);

// One organization, in full: who they are, how (or whether) we are linked, and
// every documented edge out of them — each one clickable, so the map can be
// walked hop by hop from the card as well as from the drawing.
const EcosystemOrgCard = ({ org, theme, onSelect }) => {
  const connections = connectionsFor(org.id);

  return (
    <div>
      <div className="flex items-start gap-4">
        <EcosystemLogo org={org} theme={theme} size="h-14 w-14" />
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            {CLUSTER_BY_ID[org.cluster]?.name}
          </p>
          <h2 className="mt-1 font-display text-lg font-extrabold leading-tight text-slate-900 dark:text-white">
            {org.name}
          </h2>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <TieBadge tie={org.tie} theme={theme} />
        {org.city && (
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <MapPin className="h-3.5 w-3.5" /> {org.city}
          </span>
        )}
        {org.since && (
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Calendar className="h-3.5 w-3.5" /> since {org.since}
          </span>
        )}
      </div>

      <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{org.blurb}</p>

      {org.tieNote && (
        <div className="mt-4 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            {org.tie === 'none' ? 'Why it is on the map' : 'How we are linked'}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{org.tieNote}</p>
        </div>
      )}

      {org.url && (
        <a
          href={org.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-itc-green hover:underline"
        >
          {org.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
          <ArrowUpRight className="h-4 w-4" />
        </a>
      )}

      <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
          <Link2 className="h-3.5 w-3.5" />
          {connections.length} documented link{connections.length === 1 ? '' : 's'}
        </p>
        {connections.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Nothing on the record yet — an isolated node in this map, not necessarily in the city.
          </p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {connections.map((connection) => {
              const other = findOrg(connection.other);
              if (!other) return null;
              return (
                <li key={`${connection.a}-${connection.b}-${connection.kind}`}>
                  <button
                    type="button"
                    onClick={() => onSelect(other.id)}
                    className="group w-full rounded-2xl border border-slate-100 p-3 text-left transition-colors hover:border-itc-green/50 dark:border-slate-800"
                  >
                    <span className="flex items-center gap-2">
                      <TieDot tie={other.tie} theme={theme} />
                      <span className="text-sm font-semibold text-slate-900 group-hover:text-itc-green dark:text-white">
                        {other.short}
                      </span>
                      <span className="ml-auto shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        {EDGE_KIND_LABEL[connection.kind]}
                      </span>
                    </span>
                    {connection.note && (
                      <span className="mt-1 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                        {connection.note}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default EcosystemOrgCard;
