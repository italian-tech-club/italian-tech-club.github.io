import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Home,
  ArrowRight,
  Users,
  Handshake,
  Mic,
  DoorOpen,
  CalendarDays,
  ShieldCheck,
  Layers,
  Target,
  Check,
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import SectionEyebrow from './SectionEyebrow';
import I4Logo from './I4Logo';
import { fadeRise, staggerContainer, VIEWPORT } from '../lib/motion';

// /i4 — the collaboration proposal we send to I³/NYC. Unlisted on purpose:
// reachable by URL, absent from nav, homepage and sitemap. The only place in
// the site where I³'s purple sits next to the tricolour.

const WHAT_EACH_BRINGS = [
  {
    org: 'I³/NYC brings',
    accent: 'purple',
    points: [
      'Institutional weight — the Consulate, ITA, CDP, SMAU, AIFI, and corporate innovation labs that answer the phone.',
      'Italian Innovation Week as a stage, and a direct line to startups looking at the US market.',
      'Investors and market-entry expertise: the people who can tell a founder what New York will actually cost them.',
    ],
  },
  {
    org: 'Italian Tech Club NYC brings',
    accent: 'tricolour',
    points: [
      'The Italians already here — the first US chapter of the ITC network, launched September 2025, eight gatherings in its first year.',
      '500+ Italian tech professionals on our lists, a verified member directory, and a monthly rhythm people already show up to.',
      'A platform we build and run ourselves: co-founder matching, member perks, and the ecosystem map of Italian New York.',
    ],
  },
];

const PROGRAMS = [
  {
    icon: Users,
    name: 'Mentorship',
    line: 'A cycle, not a coffee.',
    body:
      'Founders and operators matched to a mentor for a fixed cycle of three sessions, with the scope agreed up front — fundraising, US market entry, hiring, product. Mentors come from both sides: ITC operators inside NYC tech, I³ advisors and corporate contacts.',
  },
  {
    icon: Handshake,
    name: 'Co-founder matching',
    line: 'Open our matching to your pipeline.',
    body:
      'ITC already runs co-founder matching inside its community. I⁴ opens it to the founders and near-founders coming through I³ — curated profiles, in-person matching sessions, and a follow-through window so pairs actually build something before the energy fades.',
  },
  {
    icon: Mic,
    name: 'Pitch your idea',
    line: 'Small rooms, real investors.',
    body:
      'Five or six companies, working investors in the room, feedback before introductions. The strongest teams graduate to a bigger I³ moment — an Innovation Corner slot during Innovation Week, or a joint demo day.',
  },
];

const OPERATING = [
  {
    icon: Layers,
    title: 'One brand, two hosts',
    body: 'Every I⁴ event is co-billed. Venues alternate between our two worlds; both lists get the invite.',
  },
  {
    icon: DoorOpen,
    title: 'One door in',
    body: 'A single intake for all three programs, so a person gets routed to the right one instead of onto another mailing list.',
  },
  {
    icon: CalendarDays,
    title: 'Two co-leads, quarterly cadence',
    body: 'One lead from each side owns the calendar and the follow-through. One flagship joint event per quarter; the programs run continuously in between.',
  },
  {
    icon: ShieldCheck,
    title: 'Both communities stay their own',
    body: 'No merged entity, no merged database. Participants remain members of whoever brought them, and each side keeps its own voice.',
  },
];

const PHASES = [
  {
    tag: 'Phase 1 · Q4 2026',
    title: 'Pilot',
    body:
      'One joint evening in New York: a mentorship kickoff and a first pitch round, on one shared page with one intake form. It works if the room fills from both sides and the pairs meet again without us pushing.',
  },
  {
    tag: 'Phase 2 · H1 2027',
    title: 'Series',
    body:
      'The three programs go on a calendar — a standing mentor pool, quarterly co-founder sessions, pitch nights every other month — with a public I⁴ page carrying cohorts, mentors and alumni.',
  },
  {
    tag: 'Phase 3 · H2 2027',
    title: 'Platform',
    body:
      'The tracks become one funnel: apply, get matched, get mentored, get in front of capital. Cohort demo day inside Italian Innovation Week, with institutions and corporates in the room.',
  },
];

const TARGETS = [
  { figure: '4', label: 'joint events in year one' },
  { figure: '20+', label: 'mentors across both networks' },
  { figure: '30', label: 'mentor cycles and co-founder pairings' },
  { figure: '15', label: 'companies pitched, tracked to follow-on meetings' },
];

const I4Page = () => {
  useEffect(() => {
    document.title = 'I⁴ — Italian Tech Club × I³/NYC';
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 transition-colors duration-300 dark:bg-slate-950">
      <div className="absolute left-6 right-6 top-6 z-20 flex items-center justify-between">
        <Link
          to="/"
          className="rounded-full border border-slate-200 bg-white/80 p-3 text-slate-600 shadow-sm backdrop-blur-sm transition-all hover:text-itc-green hover:shadow-md dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-400 dark:hover:text-itc-green"
          aria-label="Italian Tech Club homepage"
        >
          <Home className="h-5 w-5" />
        </Link>
        <ThemeToggle className="shadow-sm hover:shadow-md" />
      </div>

      {/* Green, red, purple — the two identities in the background wash */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute -left-40 -top-40 h-[40rem] w-[40rem] rounded-full bg-itc-green/8 blur-3xl dark:bg-itc-green/10" />
        <div className="absolute -right-40 top-1/4 h-[40rem] w-[40rem] rounded-full bg-i3-purple/10 blur-3xl dark:bg-i3-purpleLit/10" />
        <div className="absolute -left-32 top-2/3 h-[36rem] w-[36rem] rounded-full bg-itc-red/8 blur-3xl dark:bg-itc-red/10" />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-4 pb-20 pt-24 sm:px-6">
        {/* Hero */}
        <motion.header variants={fadeRise} initial="hidden" animate="show">
          <SectionEyebrow className="mb-6">Collaboration proposal</SectionEyebrow>

          {/* Each wordmark on its own ground — neither brand gets restyled */}
          <div className="mb-10 flex flex-wrap items-center gap-4">
            <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm dark:border-slate-700">
              <img src="/logo.png" alt="Italian Tech Club" className="h-8 w-auto object-contain sm:h-9" />
            </div>
            <span className="font-display text-2xl font-bold text-slate-300 dark:text-slate-600">×</span>
            <div className="flex items-center justify-center rounded-2xl bg-slate-900 px-6 py-4 shadow-sm dark:bg-black">
              <img
                src="/images/i4/i3nyc.svg"
                alt="I³/NYC — Italian Innovators Initiative"
                className="h-8 w-auto object-contain sm:h-9"
              />
            </div>
          </div>

          <h1 className="text-slate-900 dark:text-white">
            <I4Logo showNyc className="h-16 w-auto text-slate-900 dark:text-white sm:h-20" />
            <span className="mt-5 block font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
              Italian Tech Club × I³/NYC
            </span>
          </h1>

          {/* The name, derived: I³ × ITC = I⁴TC. The TC stays in the product. */}
          <p className="mt-5 font-serial text-sm font-medium text-slate-400 dark:text-slate-500">
            I³ × ITC = <span className="font-bold text-slate-500 dark:text-slate-400">I⁴TC</span>
          </p>

          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-300">
            A joint New York initiative for Italian founders and innovators. I³ opens the doors —
            institutions, corporates, capital. ITC has the room full of people who want to walk through
            them. I⁴ is the program that puts the two together and stays with a
            founder past the handshake.
          </p>

          <div className="mt-8 flex flex-wrap gap-2">
            {['New York City', 'Pilot proposed for Q4 2026', 'I⁴ is a working name'].map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              >
                {chip}
              </span>
            ))}
          </div>
        </motion.header>

        {/* What each side brings */}
        <section className="mt-20">
          <motion.div variants={fadeRise} initial="hidden" whileInView="show" viewport={VIEWPORT}>
            <h2 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              Why the two of us
            </h2>
            <p className="mt-3 max-w-2xl text-base text-slate-600 dark:text-slate-400">
              We have already shared a stage: the December 2025 Tech Talk at 417 Fifth Avenue with I³&apos;s
              executive chair, co-billed with NIAF YPN. That evening worked because the two organizations are
              built differently. I⁴ turns that difference into a program instead
              of a one-off.
            </p>
          </motion.div>

          <motion.div
            variants={staggerContainer(0.1)}
            initial="hidden"
            whileInView="show"
            viewport={VIEWPORT}
            className="mt-8 grid gap-6 lg:grid-cols-2"
          >
            {WHAT_EACH_BRINGS.map((side) => (
              <motion.div
                key={side.org}
                variants={fadeRise}
                className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 sm:p-8"
              >
                <div className="flex items-center gap-3">
                  {side.accent === 'purple' ? (
                    <span className="h-[5px] w-6 rounded-full bg-i3-purple dark:bg-i3-purpleLit" aria-hidden="true" />
                  ) : (
                    <span className="flex h-[5px] w-6 overflow-hidden rounded-full" aria-hidden="true">
                      <span className="w-1/3 bg-itc-green" />
                      <span className="w-1/3 bg-itc-white" />
                      <span className="w-1/3 bg-itc-red" />
                    </span>
                  )}
                  <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">{side.org}</h3>
                </div>
                <ul className="mt-5 space-y-3.5">
                  {side.points.map((point) => (
                    <li key={point} className="flex items-start gap-3">
                      <Check
                        className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
                          side.accent === 'purple' ? 'text-i3-purple dark:text-i3-purpleLit' : 'text-itc-green'
                        }`}
                      />
                      <span className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{point}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            variants={fadeRise}
            initial="hidden"
            whileInView="show"
            viewport={VIEWPORT}
            className="mt-6 rounded-3xl bg-slate-900 p-6 text-white dark:bg-black sm:p-8"
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">The gap we would close</p>
            <p className="mt-3 max-w-3xl text-base leading-relaxed text-slate-300">
              Italian innovation in New York does not lack visibility. What it lacks is the morning after — the
              founder who met the right investor at a panel and has no way to keep the conversation going, the
              engineer with an idea and no co-founder, the first-timer who needs an operator to tell them
              plainly what to fix. I⁴ is that layer, and neither of us can build
              it as well alone.
            </p>
          </motion.div>
        </section>

        {/* The three programs */}
        <section className="mt-20">
          <motion.div variants={fadeRise} initial="hidden" whileInView="show" viewport={VIEWPORT}>
            <h2 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              Three programs, one initiative
            </h2>
            <p className="mt-3 max-w-2xl text-base text-slate-600 dark:text-slate-400">
              Events are how it shows up in public. These are what it actually does.
            </p>
          </motion.div>

          <motion.div
            variants={staggerContainer(0.1)}
            initial="hidden"
            whileInView="show"
            viewport={VIEWPORT}
            className="mt-8 grid gap-6 md:grid-cols-3"
          >
            {PROGRAMS.map(({ icon: Icon, name, line, body }) => (
              <motion.div
                key={name}
                variants={fadeRise}
                className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 transition-[border-color,transform] duration-300 ease-out-quint hover:-translate-y-1 hover:border-i3-purple/40 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-i3-purpleLit/40"
              >
                <div className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-gradient-to-r from-itc-green via-i3-purple to-itc-red transition-transform duration-500 ease-out-quint group-hover:scale-x-100" />
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white transition-colors duration-300 group-hover:bg-i3-purple dark:bg-white dark:text-slate-900 dark:group-hover:bg-i3-purpleLit dark:group-hover:text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 font-display text-lg font-bold text-slate-900 dark:text-white">{name}</h3>
                <p className="mt-1 text-sm font-semibold text-i3-purple dark:text-i3-purpleLit">{line}</p>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{body}</p>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* How it runs */}
        <section className="mt-20">
          <motion.div variants={fadeRise} initial="hidden" whileInView="show" viewport={VIEWPORT}>
            <h2 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              How we would run it
            </h2>
            <p className="mt-3 max-w-2xl text-base text-slate-600 dark:text-slate-400">
              Light structure on purpose. Nothing here needs a new organization or a lawyer.
            </p>
          </motion.div>

          <motion.div
            variants={staggerContainer(0.08)}
            initial="hidden"
            whileInView="show"
            viewport={VIEWPORT}
            className="mt-8 grid gap-4 sm:grid-cols-2"
          >
            {OPERATING.map(({ icon: Icon, title, body }) => (
              <motion.div
                key={title}
                variants={fadeRise}
                className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
              >
                <Icon className="mt-0.5 h-5 w-5 flex-shrink-0 text-i3-purple dark:text-i3-purpleLit" />
                <div>
                  <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{body}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* Roadmap */}
        <section className="mt-20">
          <motion.div variants={fadeRise} initial="hidden" whileInView="show" viewport={VIEWPORT}>
            <h2 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              Year one, in three moves
            </h2>
            <p className="mt-3 max-w-2xl text-base text-slate-600 dark:text-slate-400">
              Start with one evening. Earn the rest.
            </p>
          </motion.div>

          <motion.ol
            variants={staggerContainer(0.1)}
            initial="hidden"
            whileInView="show"
            viewport={VIEWPORT}
            className="relative mt-8 space-y-4 border-l border-slate-200 pl-6 dark:border-slate-800 sm:pl-8"
          >
            {PHASES.map(({ tag, title, body }) => (
              <motion.li key={title} variants={fadeRise} className="relative">
                <span
                  className="absolute -left-[1.9rem] top-6 h-2.5 w-2.5 rounded-full bg-i3-purple ring-4 ring-slate-50 dark:bg-i3-purpleLit dark:ring-slate-950 sm:-left-[2.4rem]"
                  aria-hidden="true"
                />
                <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
                  <p className="font-serial text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                    {tag}
                  </p>
                  <h3 className="mt-1.5 font-display text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{body}</p>
                </div>
              </motion.li>
            ))}
          </motion.ol>
        </section>

        {/* Targets */}
        <section className="mt-20">
          <motion.div variants={fadeRise} initial="hidden" whileInView="show" viewport={VIEWPORT}>
            <div className="flex items-center gap-2.5">
              <Target className="h-4 w-4 text-i3-purple dark:text-i3-purpleLit" />
              <h2 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                What good looks like
              </h2>
            </div>
            <p className="mt-3 max-w-2xl text-base text-slate-600 dark:text-slate-400">
              Numbers we would hold ourselves to in the first twelve months, and report to each other every
              quarter.
            </p>
          </motion.div>

          <motion.div
            variants={staggerContainer(0.08)}
            initial="hidden"
            whileInView="show"
            viewport={VIEWPORT}
            className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            {TARGETS.map(({ figure, label }) => (
              <motion.div
                key={label}
                variants={fadeRise}
                className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
              >
                <p className="font-display text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  {figure}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{label}</p>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* Closing line — the map is the only thing left to click */}
        <motion.div
          variants={fadeRise}
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT}
          className="mt-20 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-slate-200 pt-8 dark:border-slate-800"
        >
          <a
            href="https://italiantechclubnyc.com/ecosystem"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition-colors hover:text-i3-purple dark:text-slate-300 dark:hover:text-i3-purpleLit"
          >
            See the ecosystem map
            <ArrowRight className="h-4 w-4 transition-transform duration-300 ease-out-quint group-hover:translate-x-1" />
          </a>
          <span className="font-serial text-xs text-slate-400 dark:text-slate-500">
            Italian Tech Club · New York Chapter
          </span>
        </motion.div>
      </div>
    </div>
  );
};

export default I4Page;
