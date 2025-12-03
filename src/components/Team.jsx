import React from 'react';
import { motion } from 'framer-motion';
import { Linkedin, ArrowUpRight } from 'lucide-react';

const teamMembers = [
  { name: 'Giuseppe Concialdi', linkedin: 'https://www.linkedin.com/in/giuseppe-concialdi/' },
  { name: 'Enrico Fontana', linkedin: 'https://www.linkedin.com/in/enrico-fontana/' },
  { name: 'Giuseppe Di Cera', linkedin: 'https://www.linkedin.com/in/giuseppe-di-cera-0144ab1a7/' },
  { name: 'Nicole Bizzini', linkedin: 'https://www.linkedin.com/in/nicolebizzini/' },
  { name: 'Noemi Gozzi', linkedin: 'https://www.linkedin.com/in/noemi-gozzi-a87a2215a/' },
  { name: 'Michela Tarantino', linkedin: 'https://www.linkedin.com/in/michela-tarantino/' },
];

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.3,
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.5,
      ease: "easeOut"
    }
  }
};

const TeamCard = ({ name, linkedin }) => {
    const initials = name.split(' ').map(n => n[0]).join('');
    
    return (
        <motion.a 
            href={linkedin}
            target="_blank"
            rel="noopener noreferrer"
            variants={itemVariants}
            className="group bg-white p-6 rounded-2xl border border-slate-200 hover:border-itc-green/50 hover:shadow-lg transition-all duration-300 flex items-center gap-4"
        >
            <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-900 font-bold text-lg group-hover:bg-itc-green group-hover:text-white transition-colors duration-300">
                {initials}
            </div>
            <div className="flex-grow">
                <h3 className="font-bold text-slate-900 group-hover:text-itc-green transition-colors">{name}</h3>
                <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5 group-hover:text-slate-600">
                    <Linkedin className="w-3 h-3" />
                    <span>View Profile</span>
                </div>
            </div>
            <ArrowUpRight className="w-5 h-5 text-slate-300 group-hover:text-itc-green group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all duration-300" />
        </motion.a>
    );
}

const Team = () => {
  return (
    <section id="team" className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-3xl md:text-4xl font-bold text-slate-900 mb-4"
          >
            Meet the Team
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="text-lg text-slate-600"
          >
            The people behind the New York Chapter working to connect the Italian tech community.
          </motion.p>
        </div>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-50px" }}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
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
