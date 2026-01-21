import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, ArrowRight, CalendarCheck, Clock, Image as ImageIcon, X, ChevronLeft, ChevronRight } from 'lucide-react';
import eventsData from '../data/events.json';

const GalleryModal = ({ event, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const images = event.gallery || [];

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prevImage();
      if (e.key === 'ArrowRight') nextImage();
    };
    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, []);

  const nextImage = (e) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = (e) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm p-4"
    >
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 p-2 text-white/50 hover:text-white transition-colors z-50"
      >
        <X className="w-8 h-8" />
      </button>

      <div className="relative w-full max-w-5xl aspect-video flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.img
            key={currentIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            src={images[currentIndex]}
            alt={`Gallery image ${currentIndex + 1}`}
            className="max-h-[85vh] max-w-full object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </AnimatePresence>

        {images.length > 1 && (
          <>
            <button
              onClick={prevImage}
              className="absolute left-4 p-3 rounded-full bg-black/50 text-white hover:bg-white/20 transition-colors backdrop-blur-sm"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={nextImage}
              className="absolute right-4 p-3 rounded-full bg-black/50 text-white hover:bg-white/20 transition-colors backdrop-blur-sm"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
            
            <div className="absolute -bottom-12 left-0 right-0 flex justify-center gap-2">
              {images.map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentIndex(idx);
                  }}
                  className={`w-2 h-2 rounded-full transition-all ${
                    idx === currentIndex ? 'bg-white w-4' : 'bg-white/30 hover:bg-white/50'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>
      
      <div className="absolute top-4 left-4 text-white">
        <h3 className="text-xl font-bold">{event.title}</h3>
        <p className="text-white/60 text-sm">{currentIndex + 1} / {images.length}</p>
      </div>
    </motion.div>
  );
};

const EventCard = ({ date, month, title, subtitle, location, time, type, link, isPast, delay, poster, gallery, onOpenGallery }) => {
  const hasGallery = isPast && gallery && gallery.length > 0;
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.5, ease: "easeOut" }}
      className={`flex flex-col md:flex-row gap-6 items-start md:items-center p-6 rounded-2xl border transition-all duration-300 group relative overflow-hidden ${
        isPast 
          ? 'bg-slate-50 border-slate-100' 
          : 'bg-white border-slate-200 shadow-sm hover:shadow-xl hover:border-itc-green/30'
      }`}
    >
      {/* Poster */}
      {poster && (
        <div 
          onClick={() => hasGallery && onOpenGallery({ title, gallery })}
          className={`flex-shrink-0 w-32 h-auto rounded-xl overflow-hidden shadow-sm border border-slate-100 ${hasGallery ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
        >
          <img 
            src={poster} 
            alt={`${title} poster`} 
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Date Box (Only shown if no poster) */}
      {!poster && (
        <div className={`flex-shrink-0 w-20 h-20 rounded-xl flex flex-col items-center justify-center border ${
          isPast ? 'bg-slate-100 border-slate-200' : 'bg-white border-slate-100 shadow-inner'
        }`}>
          <span className={`text-xs font-bold uppercase tracking-wider ${isPast ? 'text-slate-500' : 'text-itc-red'}`}>{month}</span>
          <span className={`text-3xl font-bold ${isPast ? 'text-slate-400' : 'text-slate-900'}`}>{date}</span>
        </div>
      )}
      
      <div className="flex-grow space-y-2 py-1">
        {/* Date Row (Only shown if poster exists) */}
        {poster && (
          <div className={`text-sm font-bold uppercase tracking-wider mb-1 ${isPast ? 'text-slate-500' : 'text-itc-red'}`}>
            {month} {date}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              isPast ? 'bg-slate-200 text-slate-600' : 'bg-slate-900 text-white'
          }`}>
            {type}
          </span>
          {isPast && (
              <span className="flex items-center gap-1 text-xs font-medium text-slate-500">
                  <CalendarCheck className="w-3 h-3" /> Past Event
              </span>
          )}
          {!isPast && time && (
               <span className="flex items-center gap-1 text-xs font-medium text-slate-500">
                  <Clock className="w-3 h-3" /> {time}
              </span>
          )}
        </div>
        
        <div>
          <h3 className={`text-xl font-bold mb-1 transition-colors ${
              isPast ? 'text-slate-600' : 'text-slate-900 group-hover:text-itc-green'
          }`}>
              {title}
          </h3>
          {subtitle && <p className="text-slate-600 text-sm">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <MapPin className="w-4 h-4" />
          {location}
        </div>
      </div>

      <div className="flex-shrink-0 mt-4 md:mt-0 w-full md:w-auto">
        {hasGallery ? (
          <button 
            onClick={() => onOpenGallery({ title, gallery })}
            className="w-full md:w-auto px-6 py-2.5 rounded-full text-sm font-bold bg-slate-900 text-white hover:bg-itc-green transition-colors flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
          >
            <ImageIcon className="w-4 h-4" />
            View Photos
          </button>
        ) : (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className={`w-full md:w-auto px-6 py-2.5 rounded-full text-sm font-bold transition-colors flex items-center justify-center gap-2 ${
              isPast 
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                  : 'bg-itc-green text-white group-hover:bg-itc-red shadow-lg shadow-itc-green/20'
            }`}
            onClick={isPast ? (e) => e.preventDefault() : undefined}
          >
            {isPast ? 'Event Ended' : 'Register Now'} 
            {!isPast && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
          </a>
        )}
      </div>
    </motion.div>
  );
};

const Events = () => {
  const [selectedGalleryEvent, setSelectedGalleryEvent] = useState(null);

  // Helper function to parse date string as local date (not UTC)
  const parseLocalDate = (dateString) => {
    const [year, month, day] = dateString.split('-').map(Number);
    // month is 0-indexed in JavaScript Date, so subtract 1
    return new Date(year, month - 1, day);
  };

  // Parse events and categorize them based on current date
  const { upcomingEvents, pastEvents } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day for accurate comparison

    const upcoming = [];
    const past = [];

    eventsData.forEach((event) => {
      const eventDate = parseLocalDate(event.date);
      eventDate.setHours(0, 0, 0, 0);
      
      if (eventDate >= today) {
        upcoming.push(event);
      } else {
        past.push(event);
      }
    });

    // Sort upcoming events by date (ascending)
    upcoming.sort((a, b) => parseLocalDate(a.date) - parseLocalDate(b.date));
    // Sort past events by date (descending - most recent first)
    past.sort((a, b) => parseLocalDate(b.date) - parseLocalDate(a.date));

    return { upcomingEvents: upcoming, pastEvents: past };
  }, []);

  // Helper function to format date for display
  const formatEventDate = (dateString) => {
    const date = parseLocalDate(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const month = monthNames[date.getMonth()];
    return { date: day, month };
  };

  return (
    <section id="events" className="py-24 bg-white relative">
      <AnimatePresence>
        {selectedGalleryEvent && (
          <GalleryModal 
            event={selectedGalleryEvent} 
            onClose={() => setSelectedGalleryEvent(null)} 
          />
        )}
      </AnimatePresence>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-4">
          <div>
            <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="text-3xl md:text-4xl font-bold text-slate-900 mb-4"
            >
                Events
            </motion.h2>
            <motion.p 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1, duration: 0.5, ease: "easeOut" }}
                className="text-lg text-slate-600 max-w-2xl"
            >
              Join our exclusive gatherings in the heart of New York City. 
              Connect with fellow Italian innovators over tech talks, aperitivos, and dinners.
            </motion.p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Upcoming Events */}
          <div className="mb-12">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-6">Upcoming</h3>
              {upcomingEvents.length > 0 ? (
                <div className="space-y-6">
                  {upcomingEvents.map((event, index) => {
                    const { date, month } = formatEventDate(event.date);
                    return (
                      <EventCard 
                          key={event.date + event.title}
                          date={date}
                          month={month}
                          title={event.title}
                          subtitle={event.subtitle || null}
                          location={event.location}
                          time={event.time || null}
                          type={event.type}
                          link={event.link}
                          isPast={false}
                          delay={0.1 + (index * 0.1)}
                          poster={event.poster}
                          gallery={event.gallery}
                          onOpenGallery={setSelectedGalleryEvent}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                    <h4 className="text-xl font-bold text-slate-900 mb-2">No upcoming events at the moment</h4>
                    <p className="text-slate-600 mb-6">
                        We are working on the next gathering. Follow us to get notified when new events are announced.
                    </p>
                    <a 
                        href="https://www.gomry.com/form/Italian-Tech-Club-General-application-form-68uJSn7PbLmevuO2T0c5"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-slate-900 text-white font-bold hover:bg-itc-green transition-colors"
                    >
                        Join the Club
                    </a>
                </div>
              )}
          </div>

          {/* Past Events */}
          {pastEvents.length > 0 && (
            <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-6">Past Events</h3>
                <div className="space-y-6">
                  {pastEvents.map((event, index) => {
                    const { date, month } = formatEventDate(event.date);
                    return (
                      <EventCard 
                          key={event.date + event.title}
                          date={date}
                          month={month}
                          title={event.title}
                          subtitle={event.subtitle || null}
                          location={event.location}
                          time={event.time || null}
                          type={event.type}
                          link={event.link}
                          isPast={true}
                          delay={0.2 + (index * 0.1)}
                          poster={event.poster}
                          gallery={event.gallery}
                          onOpenGallery={setSelectedGalleryEvent}
                      />
                    );
                  })}
                </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default Events;
