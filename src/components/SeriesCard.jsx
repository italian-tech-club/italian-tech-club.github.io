import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Lock, CalendarPlus, Repeat, Images } from 'lucide-react';
import { describeRecurrence, formatShortDate, formatWeekdayDate } from '../lib/eventSchedule';
import { buildEventIcs, downloadIcs } from '../lib/ics';
import { EASE, hoverSpring } from '../lib/motion';

/**
 * The standing-series card. One per recurring event, and the only inverted card in
 * the list — a fixed appointment outranks a one-off.
 *
 * One poster covers the whole series. Photos belong to the nights, not to the
 * artwork: they live behind a single entry point and stay grouped by date inside
 * the carousel.
 */
const SeriesCard = ({ event, editions = [], following = [], onOpenPhotos }) => {
  const [posterFailed, setPosterFailed] = useState(false);
  const showPoster = event.poster && !posterFailed;

  const nightsWithPhotos = editions.filter(
    (edition) => (edition.galleryCount ?? edition.gallery?.length ?? 0) > 0
  );
  const photoCount = nightsWithPhotos.reduce(
    (total, edition) => total + (edition.galleryCount ?? edition.gallery?.length ?? 0),
    0
  );

  const addToCalendar = () =>
    downloadIcs(
      event.title,
      buildEventIcs({
        title: event.title,
        subtitle: event.subtitle,
        location: event.location,
        date: event.date,
        time: event.time,
        url: event.link,
        recurrence: event.recurrence,
      })
    );

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, ease: EASE }}
      className="relative overflow-hidden rounded-2xl bg-slate-950 dark:bg-slate-900 ring-1 ring-slate-800 dark:ring-itc-green/25 shadow-xl shadow-slate-900/20"
    >
      {/* Same dot texture as the hero, so the slab reads as part of the site */}
      <div className="absolute inset-0 bg-dot-grid text-white/[0.07] pointer-events-none" aria-hidden />
      <div
        className="absolute -top-32 -right-24 w-96 h-96 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(0,146,70,0.22) 0%, rgba(0,146,70,0) 70%)' }}
        aria-hidden
      />

      <div className="relative p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          {/* The cadence leads — it's the whole premise of the series */}
          <span className="flex items-center gap-2.5 text-sm md:text-base font-bold text-white">
            <Repeat className="w-4 h-4 text-itc-green flex-shrink-0" />
            {describeRecurrence(event.recurrence)}
          </span>
          <span className="flex items-center gap-1.5 text-xs font-medium text-white/50">
            <Lock className="w-3.5 h-3.5" /> Members only
          </span>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-6 md:gap-8">
          {/* One poster for the whole series — the same artwork every occurrence.
              self-start keeps the row height from stretching the slot and cropping
              it: every poster is square and has to stay that way. */}
          {showPoster && (
            <div className="flex-shrink-0 self-start w-full sm:w-40 md:w-44 aspect-square rounded-xl overflow-hidden ring-1 ring-white/15 bg-slate-900">
              <img
                src={event.poster}
                alt={`${event.title} poster`}
                className="w-full h-full object-cover"
                onError={() => setPosterFailed(true)}
              />
            </div>
          )}

          <div className="min-w-0">
            <h3 className="text-2xl md:text-4xl font-extrabold tracking-tight text-white">
              {event.title}
            </h3>
            {event.subtitle && (
              <p className="mt-2.5 text-white/60 max-w-xl leading-relaxed">{event.subtitle}</p>
            )}

            {/* The next date, set large enough to be the second thing you read */}
            <div className="mt-5 pt-5 border-t border-white/10 flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
              <span className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-itc-green">
                Next
              </span>
              <span className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                {formatWeekdayDate(event.date)}
              </span>
              {event.time && (
                <span className="text-base font-medium text-white/60">{event.time}</span>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/70">
              <span className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-white/40 flex-shrink-0" />
                {event.location}
              </span>
            </div>

            {event.note && (
              <p className="mt-4 inline-block px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-itc-red/20 ring-1 ring-itc-red/40">
                {event.note}
              </p>
            )}

            {photoCount > 0 && (
              <motion.button
                type="button"
                onClick={onOpenPhotos}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                transition={hoverSpring}
                className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold bg-white text-slate-900 hover:bg-itc-green hover:text-white transition-colors"
              >
                <Images className="w-4 h-4" />
                {photoCount} photos from {nightsWithPhotos.length} {nightsWithPhotos.length === 1 ? 'night' : 'nights'}
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* The cadence ahead: evenly spaced cells, so the rhythm is visible */}
      <div className="relative flex flex-col md:flex-row md:items-stretch border-t border-white/10 bg-white/[0.03]">
        {following.length > 0 && (
          <ul className="flex flex-grow divide-x divide-dashed divide-white/15 overflow-x-auto">
            <li className="flex items-center pl-6 md:pl-8 pr-5 py-4 font-mono text-[11px] uppercase tracking-[0.2em] text-white/35 whitespace-nowrap">
              Then
            </li>
            {following.map((occurrence, index) => (
              <motion.li
                key={occurrence.occurrence}
                initial={{ opacity: 0, x: -8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.12 + index * 0.08, duration: 0.45, ease: EASE }}
                className="flex-1 flex flex-col justify-center items-center px-5 py-4"
              >
                <span className="font-mono text-sm uppercase tracking-widest text-white/60 whitespace-nowrap">
                  {formatShortDate(occurrence.date)}
                </span>
                {occurrence.isMoved && (
                  <span className="mt-0.5 text-[10px] uppercase tracking-wider text-itc-red">Moved</span>
                )}
              </motion.li>
            ))}
          </ul>
        )}

        <div className="flex items-center px-6 md:px-8 py-4 md:border-l md:border-white/10">
          <motion.button
            type="button"
            onClick={addToCalendar}
            whileHover={{ y: -1 }}
            transition={hoverSpring}
            className="flex items-center gap-2 text-sm font-medium text-white/60 hover:text-white transition-colors whitespace-nowrap"
          >
            <CalendarPlus className="w-4 h-4" />
            Add the series to your calendar
          </motion.button>
        </div>
      </div>
    </motion.article>
  );
};

export default SeriesCard;
