import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, ArrowRight, CalendarCheck, Clock } from 'lucide-react';

const EventCard = ({ date, month, title, subtitle, location, time, type, link, isPast, delay }) => (
  <motion.a
    href={link}
    target="_blank"
    rel="noopener noreferrer"
    initial={{ opacity: 0, x: -20 }}
    whileInView={{ opacity: 1, x: 0 }}
    viewport={{ once: true }}
    transition={{ delay, duration: 0.5 }}
    className={`flex flex-col md:flex-row gap-6 items-start md:items-center p-6 rounded-2xl border transition-all group relative overflow-hidden ${
      isPast 
        ? 'bg-slate-50 border-slate-100 opacity-80 hover:opacity-100' 
        : 'bg-white border-slate-200 shadow-sm hover:shadow-xl hover:border-itc-green/30 hover:-translate-y-1'
    }`}
  >
    <div className={`flex-shrink-0 w-20 h-20 rounded-xl flex flex-col items-center justify-center border ${
        isPast ? 'bg-slate-100 border-slate-200' : 'bg-white border-slate-100 shadow-inner'
    }`}>
      <span className={`text-xs font-bold uppercase tracking-wider ${isPast ? 'text-slate-500' : 'text-itc-red'}`}>{month}</span>
      <span className={`text-3xl font-bold ${isPast ? 'text-slate-400' : 'text-slate-900'}`}>{date}</span>
    </div>
    
    <div className="flex-grow space-y-2">
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

    <div className="flex-shrink-0 mt-4 md:mt-0">
        <div className={`px-6 py-2.5 rounded-full text-sm font-bold transition-colors flex items-center gap-2 ${
            isPast 
                ? 'bg-slate-200 text-slate-500 cursor-not-allowed' 
                : 'bg-itc-green text-white group-hover:bg-itc-red'
        }`}>
            {isPast ? 'View Past Event' : 'Register Now'} 
            {!isPast && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
        </div>
    </div>
  </motion.a>
);

const Events = () => {
  return (
    <section id="events" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-4">
          <div>
            <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-3xl md:text-4xl font-bold text-slate-900 mb-4"
            >
                Events
            </motion.h2>
            <motion.p 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="text-lg text-slate-600 max-w-2xl"
            >
              Join our exclusive gatherings in the heart of New York City. 
              Connect with fellow Italian innovators over tech talks, aperitivos, and dinners.
            </motion.p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Upcoming Event */}
          <div className="mb-12">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-6">Upcoming</h3>
              <EventCard 
                date="02" 
                month="DEC" 
                title="Tech Talk & Networking" 
                subtitle="Interview with Gianluca Galletto (I³/NYC Chairman)"
                location="Impact Hub, 417 5th Ave, New York" 
                time="6:30 PM - 9:00 PM"
                type="Networking"
                link="https://www.gomry.com/event/ITC-Tech-Talk-with-Gianluca-Galletto-jeudT5z4fNweUMXG1TNs"
                isPast={false}
                delay={0.2}
              />
          </div>

          {/* Past Events */}
          <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-6">Past Events</h3>
              <EventCard 
                date="18" 
                month="SEP" 
                title="NYC Chapter Launch" 
                subtitle="First Italian Tech Club gathering in New York"
                location="New York, NY" 
                type="Launch Party"
                link="https://www.gomry.com/event/Italian-Tech-Club-NYC-Launch-Event-OqmdwP5JnVu5VnXjupdY"
                isPast={true}
                delay={0.3}
              />
          </div>
        </div>
      </div>
    </section>
  );
};

export default Events;
