import React from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import About from './components/About';
import Activities from './components/Activities';
import Events from './components/Events';
import Team from './components/Team';
import Contact from './components/Contact';
import Footer from './components/Footer';

function App() {
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
}

export default App;

