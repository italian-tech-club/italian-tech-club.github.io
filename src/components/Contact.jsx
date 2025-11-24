import React from 'react';
import { motion } from 'framer-motion';
import { Mail, Linkedin, ArrowRight, ExternalLink } from 'lucide-react';

const Contact = () => {
  return (
    <section id="contact" className="py-24 bg-slate-900 text-white relative overflow-hidden">
        {/* Background Accent */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-itc-green/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-itc-red/10 rounded-full blur-3xl" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Get in Touch</h2>
            <p className="text-lg text-slate-300 mb-8 leading-relaxed">
              Whether you're looking to partner with us, organize an event, or just say ciao, we'd love to hear from you.
            </p>
            
            <div className="space-y-6">
              <a href="mailto:ciao@italiantechclubnyc.com" className="flex items-center gap-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/10">
                <div className="w-12 h-12 rounded-lg bg-itc-green flex items-center justify-center">
                  <Mail className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Email us at</p>
                  <p className="text-lg font-medium">ciao@italiantechclubnyc.com</p>
                </div>
              </a>

              <div className="flex gap-4">
                <a href="https://www.linkedin.com/company/italian-tech-club" className="w-12 h-12 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-itc-green transition-all group">
                  <Linkedin className="w-5 h-5 text-slate-400 group-hover:text-white" />
                </a>
              </div>
            </div>
          </motion.div>

          <motion.div
             initial={{ opacity: 0, y: 20 }}
             whileInView={{ opacity: 1, y: 0 }}
             viewport={{ once: true }}
             transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
             className="bg-gradient-to-br from-white to-slate-100 rounded-3xl p-10 text-slate-900 shadow-2xl relative overflow-hidden group"
          >
             <div className="absolute top-0 right-0 w-64 h-64 bg-itc-green/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-itc-green/20 transition-colors duration-500"></div>

            <h3 className="text-3xl font-bold mb-4 relative z-10">Join the Club</h3>
            <p className="text-slate-600 mb-8 relative z-10 leading-relaxed">
              Apply to become a member of the Italian Tech Club NYC. Access exclusive events, networking opportunities, and our digital community.
            </p>
            
            <a 
              href="https://www.gomry.com/form/Italian-Tech-Club-General-application-form-68uJSn7PbLmevuO2T0c5"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-4 rounded-xl bg-slate-900 text-white font-bold hover:bg-itc-red transition-all flex items-center justify-center gap-3 shadow-lg hover:shadow-xl relative z-10 hover:-translate-y-1"
            >
              Become a Member <ExternalLink className="w-5 h-5" />
            </a>

            <p className="mt-6 text-xs text-slate-500 text-center relative z-10">
              *Applications are reviewed on a rolling basis.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Contact;
