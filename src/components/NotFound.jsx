import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const NotFound = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center overflow-hidden relative">
      {/* Background Blobs */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[40rem] h-[40rem] bg-itc-green/10 rounded-full blur-3xl mix-blend-multiply animate-blob opacity-70" />
        <div className="absolute top-0 -right-40 w-[35rem] h-[35rem] bg-itc-red/10 rounded-full blur-3xl mix-blend-multiply animate-blob animation-delay-2000 opacity-70" />
        <div className="absolute -bottom-40 left-20 w-[30rem] h-[30rem] bg-slate-200/50 rounded-full blur-3xl mix-blend-multiply animate-blob animation-delay-4000 opacity-70" />
      </div>

      {/* Floating Emojis */}
      <div className="absolute top-[15%] left-[10%] text-3xl animate-float opacity-70">🍕</div>
      <div className="absolute top-[25%] right-[15%] text-3xl animate-float animation-delay-1000 opacity-70">🚀</div>
      <div className="absolute bottom-[20%] left-[15%] text-3xl animate-float animation-delay-2000 opacity-70">💻</div>
      <div className="absolute bottom-[30%] right-[10%] text-3xl animate-float animation-delay-3000 opacity-70">🇮🇹</div>
      <div className="absolute top-[40%] left-[5%] text-3xl animate-float animation-delay-4000 opacity-70">☕</div>

      {/* Main Content */}
      <div className="relative z-10 text-center px-6 max-w-xl">
        {/* Animated 404 */}
        <div className="text-[8rem] md:text-[12rem] font-bold leading-none mb-4">
          <span className="inline-block bg-clip-text text-transparent bg-gradient-to-r from-itc-green via-slate-900 to-itc-red bg-300% animate-gradient animate-bounce-slow" style={{ animationDelay: '0s' }}>4</span>
          <span className="inline-block bg-clip-text text-transparent bg-gradient-to-r from-itc-green via-slate-900 to-itc-red bg-300% animate-gradient animate-bounce-slow" style={{ animationDelay: '0.2s' }}>0</span>
          <span className="inline-block bg-clip-text text-transparent bg-gradient-to-r from-itc-green via-slate-900 to-itc-red bg-300% animate-gradient animate-bounce-slow" style={{ animationDelay: '0.4s' }}>4</span>
        </div>

        {/* Pasta Animation */}
        <div className="flex justify-center items-end gap-2 h-20 mb-6">
          {[55, 60, 50, 58, 52, 62, 48].map((height, i) => (
            <div
              key={i}
              className="w-1 rounded-full bg-gradient-to-b from-yellow-400 to-yellow-500 origin-top animate-wiggle"
              style={{ 
                height: `${height}px`,
                animationDelay: `${i * 0.1}s`
              }}
            />
          ))}
          <span className="text-3xl animate-twirl ml-2">🍴</span>
        </div>

        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-3">
          Oops! This page is <em>al dente</em>
        </h1>
        
        <p className="text-lg text-slate-600 mb-8 leading-relaxed">
          Looks like this page got lost somewhere between Rome and NYC.<br />
          <span className="italic text-itc-green font-semibold">"Chi cerca, trova!"</span> — Let's get you back on track.
        </p>

        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link
            to="/"
            className="group px-8 py-4 rounded-full bg-slate-900 text-white font-semibold hover:bg-itc-red transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-900/20 hover:shadow-itc-red/30 hover:-translate-y-1"
          >
            Back to Home
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            to="/#contact"
            className="px-8 py-4 rounded-full bg-white text-slate-700 font-semibold border border-slate-200 hover:border-itc-green hover:text-itc-green transition-all shadow-sm hover:shadow-md flex items-center justify-center hover:-translate-y-1"
          >
            Contact Us
          </Link>
        </div>
      </div>

      {/* Italian Flag Stripe */}
      <div className="fixed bottom-0 left-0 right-0 h-1.5 flex">
        <div className="flex-1 bg-itc-green" />
        <div className="flex-1 bg-white" />
        <div className="flex-1 bg-itc-red" />
      </div>
    </div>
  );
};

export default NotFound;
