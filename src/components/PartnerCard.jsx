import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, ExternalLink, MapPin, Sparkles, Ticket } from 'lucide-react';
import PartnerLogo from './PartnerLogo';
import { activeBenefits } from '../data/partners';
import { fadeRise } from '../lib/motion';

// One partner, one shape — on the homepage and on /partners alike. Uniform tile
// regardless of what they carry: the wall has to read as a set, not a ranking.
// Perks and open access both surface as highlights, so a code-based partner and
// an events partner sit side by side without either looking half-empty.
const PartnerCard = ({ partner }) => {
  const perks = activeBenefits(partner);
  const highlights = [
    ...perks.map((benefit) => ({ key: benefit.id, icon: Ticket, text: `${benefit.discount} · ${benefit.title}` })),
    ...(partner.access || []).map((item) => ({ key: item.title, icon: Sparkles, text: item.title })),
  ];
  const detailPath = `/partners/${partner.slug}`;
  // One outbound action per card: the partner's signup when they have one,
  // otherwise their site.
  const action = partner.signup
    ? { label: partner.signup.shortLabel || partner.signup.label, href: partner.signup.url }
    : { label: 'Website', href: partner.url };

  return (
    <motion.div
      variants={fadeRise}
      className="w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.75rem)]"
    >
      <div className="group flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white transition-[border-color,box-shadow,transform] duration-300 ease-out-quint hover:-translate-y-1 hover:border-itc-green/50 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900">
        <Link to={detailPath} tabIndex={-1} aria-hidden="true">
          <PartnerLogo partner={partner} className="rounded-none py-8" imageClassName="max-h-11" />
        </Link>
        <div className="flex flex-1 flex-col p-5">
          <h3 className="font-bold leading-tight text-slate-900 dark:text-white">
            <Link to={detailPath} className="hover:text-itc-green">
              {partner.name}
            </Link>
          </h3>
          {partner.location && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <MapPin className="h-3.5 w-3.5" /> {partner.location}
            </p>
          )}

          <ul className="mt-4 flex-1 space-y-2">
            {highlights.map(({ key, icon: Icon, text }) => (
              <li key={key} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-itc-green" />
                {text}
              </li>
            ))}
          </ul>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <Link
              to={detailPath}
              className="flex min-h-7 items-center gap-1.5 text-xs font-semibold text-itc-green hover:underline"
            >
              {perks.length > 0
                ? `${perks.length} member perk${perks.length === 1 ? '' : 's'}`
                : 'Events & access'}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <a
              href={action.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-7 items-center gap-1.5 rounded-full bg-slate-900 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-itc-green dark:bg-white dark:text-slate-900 dark:hover:bg-itc-green dark:hover:text-white"
            >
              {action.label} <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default PartnerCard;
