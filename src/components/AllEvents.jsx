import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Navbar from './Navbar';
import Footer from './Footer';
import Events from './Events';

const AllEvents = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 selection:bg-itc-green selection:text-white transition-colors duration-300">
      <Navbar />
      <main className="pt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-itc-green transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>
        </div>
        <Events showAll={true} />
      </main>
      <Footer />
    </div>
  );
};

export default AllEvents;
