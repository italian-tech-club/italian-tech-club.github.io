import React, { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import About from './components/About';
import Activities from './components/Activities';
import Events from './components/Events';
import Team from './components/Team';
import Contact from './components/Contact';
import Footer from './components/Footer';
import CoFounderMatching from './components/CoFounderMatching';
import CoFounderProfiles from './components/CoFounderProfiles';

// Homepage component with all sections
const HomePage = () => {
  useEffect(() => {
    // Handle hash navigation on load
    if (window.location.hash) {
      const id = window.location.hash.substring(1);
      setTimeout(() => {
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100); // Small delay to ensure DOM is ready
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 selection:bg-itc-green selection:text-white">
      <Navbar />
      <main>
        <Hero />
        <About />
        <Activities />
        <Events />
        <Team />
        <Contact />
      </main>
      <Footer />
    </div>
  );
};

function App() {
  const location = useLocation();

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/cofounder-matching" element={<CoFounderMatching />} />
      <Route path="/cofounders" element={<CoFounderProfiles />} />
    </Routes>
  );
}

export default App;
