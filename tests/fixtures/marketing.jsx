import React from 'react';
import { createRoot } from 'react-dom/client';
import AdminMarketing from '../../src/components/AdminMarketing';
import '../../src/index.css';

const headers = () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer local-test-only' });
const unauthorized = () => { document.body.dataset.unauthorized = 'true'; };
createRoot(document.getElementById('root')).render(
  <main className="min-h-screen bg-slate-50 p-4 dark:bg-slate-950"><div className="mx-auto max-w-6xl"><AdminMarketing authHeaders={headers} onUnauthorized={unauthorized} /></div></main>,
);
