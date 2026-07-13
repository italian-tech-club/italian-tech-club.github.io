import React from 'react';
import { motion } from 'framer-motion';
import { Linkedin, ArrowUpRight } from 'lucide-react';
import { fadeRise, staggerContainer, hoverSpring, VIEWPORT } from '../lib/motion';
import SectionEyebrow from './SectionEyebrow';

const teamMembers = [
  { name: 'Giuseppe Concialdi', linkedin: 'https://www.linkedin.com/in/giuseppe-concialdi/' },
  { name: 'Enrico Fontana', linkedin: 'https://www.linkedin.com/in/enrico-fontana/' },
  { name: 'Noemi Gozzi', linkedin: 'https://www.linkedin.com/in/noemi-gozzi-a87a2215a/' },
  { name: 'Michela Tarantino', linkedin: 'https://www.linkedin.com/in/michela-tarantino/' },
  { name: 'Nicole Bizzini', linkedin: 'https://www.linkedin.com/in/nicolebizzini/' },
];

const TeamCard = ({ name, linkedin }) => {
    const initials = name.split(' ').map(n => n[0]).join('');

    return (
        <motion.a
            href={linkedin}
            target="_blank"
            rel="noopener noreferrer"
            variants={fadeRise}
            whileHover={{ y: -4, transition: hoverSpring }}
            className="group bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-itc-green/50 dark:hover:border-itc-green/50 hover:shadow-lg transition-[border-color,box-shadow] duration-300 ease-out-quint flex items-center gap-4 w-full md:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)]"
        >
            <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center text-slate-900 dark:text-white font-bold text-lg group-hover:bg-itc-green group-hover:border-itc-green group-hover:text-white transition-colors duration-300 ease-out-quint">
                {initials}
            </div>
            <div className="flex-grow">
                <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-itc-green transition-colors duration-300">{name}</h3>
                <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mt-0.5 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors duration-300">
                    <Linkedin className="w-3 h-3" />
                    <span>View Profile</span>
                </div>
            </div>
            <ArrowUpRight className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-itc-green group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all duration-300 ease-out-quint" />
        </motion.a>
    );
}

const Team = () => {
  return (
    <section id="team" className="py-24 bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={fadeRise}
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <SectionEyebrow className="mb-4">New York Chapter</SectionEyebrow>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">
            Meet the Team
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            The people behind the New York Chapter working to connect the Italian tech community.
          </p>
        </motion.div>

        <motion.div
          variants={staggerContainer(0.08)}
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT}
          className="flex flex-wrap justify-center gap-6"
        >
          {teamMembers.map((member) => (
            <TeamCard key={member.name} {...member} />
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default Team;
