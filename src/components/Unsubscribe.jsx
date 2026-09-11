import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2, MailX, Undo2, Check, AlertCircle } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import { fadeRise } from '../lib/motion';

const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * /unsubscribe?u=<token> — the opt-out at the foot of every marketing email.
 *
 * Opening the page unsubscribes immediately rather than asking first: someone
 * who clicked "non voglio più ricevere queste email" has already answered the
 * question, and a confirm step is one more thing between them and the outcome
 * they asked for. The undo is right there for a misclick.
 *
 * Doing it from JS on mount (a POST, not a GET) is also what keeps the inbox
 * link-scanners that prefetch every URL in an email from silently unsubscribing
 * people who never clicked.
 */
const Unsubscribe = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('u') || '';
  const deliveryId = searchParams.get('d') || '';

  const [state, setState] = useState('working'); // working | done | resubscribed | invalid | error
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const ran = useRef(false);

  const call = async (resubscribe) => {
    const response = await fetch(`${API_URL}/api/community/unsubscribe?u=${encodeURIComponent(token)}&d=${encodeURIComponent(deliveryId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resubscribe }),
    });
    const data = await response.json();
    if (!data.success || !data.found) {
      setState('invalid');
      return;
    }
    setEmail(data.email || '');
    setState(resubscribe ? 'resubscribed' : 'done');
  };

  useEffect(() => {
    // React 18 StrictMode mounts twice in dev; the opt-out is idempotent, but
    // the flicker isn't, so only the first pass runs.
    if (ran.current) return;
    ran.current = true;

    if (!token) {
      setState('invalid');
      return;
    }
    call(false).catch(() => setState('error'));
  }, [token]);

  const toggle = async (resubscribe) => {
    setBusy(true);
    try {
      await call(resubscribe);
    } catch {
      setState('error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-20 transition-colors duration-300 dark:bg-slate-950">
      <div className="absolute right-6 top-6">
        <ThemeToggle className="shadow-sm" />
      </div>

      <motion.div variants={fadeRise} initial="hidden" animate="show" className="mx-auto max-w-md text-center">
        <div className="mx-auto mb-6 flex h-5 w-8 overflow-hidden rounded-sm ring-1 ring-inset ring-slate-900/10 dark:ring-white/10">
          <span className="w-1/3 bg-itc-green" />
          <span className="w-1/3 bg-white" />
          <span className="w-1/3 bg-itc-red" />
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {state === 'working' && (
            <div className="flex flex-col items-center gap-3 py-6 text-slate-500 dark:text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Un attimo...</p>
            </div>
          )}

          {state === 'done' && (
            <>
              <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                <MailX className="h-6 w-6 text-slate-500 dark:text-slate-400" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Fatto, ti abbiamo tolto dalla lista
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                {email ? <><span className="font-medium text-slate-700 dark:text-slate-300">{email}</span> non riceverà</> : 'Non riceverai'}{' '}
                più email su eventi e novità dell'Italian Tech Club.
                Resti membro a tutti gli effetti: continuerai a ricevere solo le email di servizio,
                come i link di accesso al tuo profilo.
              </p>
              <button
                onClick={() => toggle(true)}
                disabled={busy}
                className="mt-7 inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-itc-green disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-itc-green dark:hover:text-white"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
                Ho cambiato idea, rimettimi in lista
              </button>
            </>
          )}

          {state === 'resubscribed' && (
            <>
              <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-itc-green/10">
                <Check className="h-6 w-6 text-itc-green" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Bentornato/a! 🇮🇹
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                {email ? <><span className="font-medium text-slate-700 dark:text-slate-300">{email}</span> tornerà</> : 'Tornerai'}{' '}
                a ricevere gli inviti ai nostri eventi. Puoi disiscriverti quando vuoi dal link in fondo a ogni email.
              </p>
              <button
                onClick={() => toggle(false)}
                disabled={busy}
                className="mt-7 inline-flex items-center gap-2 rounded-full border border-slate-300 px-5 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailX className="h-4 w-4" />}
                Disiscrivimi di nuovo
              </button>
            </>
          )}

          {(state === 'invalid' || state === 'error') && (
            <>
              <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {state === 'invalid' ? 'Link non valido' : 'Qualcosa è andato storto'}
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                {state === 'invalid'
                  ? 'Questo link di disiscrizione non è più valido. Scrivici e ti togliamo dalla lista a mano.'
                  : 'Non siamo riusciti a completare l\'operazione. Riprova tra poco, oppure scrivici.'}
              </p>
              <a
                href="mailto:ciao@italiantechclubnyc.com?subject=Unsubscribe"
                className="mt-7 inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-itc-green dark:bg-white dark:text-slate-900 dark:hover:bg-itc-green dark:hover:text-white"
              >
                Scrivici
              </a>
            </>
          )}
        </div>

        <Link
          to="/"
          className="mt-8 inline-block text-xs font-medium uppercase tracking-wider text-slate-400 transition-colors hover:text-itc-green dark:text-slate-500"
        >
          Italian Tech Club · New York
        </Link>
      </motion.div>
    </div>
  );
};

export default Unsubscribe;
