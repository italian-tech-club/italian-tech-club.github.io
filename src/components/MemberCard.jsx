import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import { ArrowUpRight, Check, Copy, Download, Link2, Linkedin, Share2, X } from 'lucide-react';
import { CHAPTER, memberNumberLabel, initialsOf, roleLine, renderCardImage } from '../lib/cardArt';

const API_URL = import.meta.env.VITE_API_URL || '';

// How far the card leans at the edges of its container. Past roughly 16deg the
// text on the far edge starts to smear, which breaks the illusion of a real
// object rather than selling it.
const MAX_TILT_Y = 15;
const MAX_TILT_X = 11;

const TILT_SPRING = { stiffness: 150, damping: 18, mass: 0.6 };

/* -------------------------------------------------------------------------- */
/*  The card                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * A membership credential rendered as a physical object: a dark metal panel
 * with a tricolore edge, brass foil that catches a fixed light source, and real
 * thickness you can see at an angle.
 *
 * Everything is DOM and CSS 3D rather than WebGL. The type stays selectable and
 * crisp at any pixel density, it costs no extra bundle, and the same markup
 * reflows for the small screens most of these links get opened on.
 */
export const Credential = ({ card }) => {
  const reduceMotion = useReducedMotion();
  const stageRef = useRef(null);

  // -0.5 to 0.5 across the card in each axis.
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const tiltX = useSpring(pointerX, TILT_SPRING);
  const tiltY = useSpring(pointerY, TILT_SPRING);

  const rotateY = useTransform(tiltX, [-0.5, 0.5], [-MAX_TILT_Y, MAX_TILT_Y]);
  const rotateX = useTransform(tiltY, [-0.5, 0.5], [MAX_TILT_X, -MAX_TILT_X]);

  // The foil is a fixed-angle gradient far wider than the card; tilting slides
  // the card across it, so the sheen travels the way a real reflection would.
  const foilPosition = useTransform(tiltX, [-0.5, 0.5], ['12% 50%', '88% 50%']);
  const glareX = useTransform(tiltX, [-0.5, 0.5], ['12%', '88%']);
  const glareY = useTransform(tiltY, [-0.5, 0.5], ['8%', '92%']);
  const glare = useTransform(
    [glareX, glareY],
    ([x, y]) => `radial-gradient(circle at ${x} ${y}, rgba(255,255,255,0.24), rgba(255,255,255,0.04) 32%, transparent 58%)`,
  );

  // The shadow falls away from the lean, which is what tells the eye the card
  // is lifting off the page rather than just rotating in place.
  const shadowX = useTransform(tiltX, [-0.5, 0.5], [26, -26]);
  const shadowScale = useTransform(tiltY, [-0.5, 0.5], [0.88, 1.06]);

  const track = useCallback((clientX, clientY) => {
    const stage = stageRef.current;
    if (!stage) return;
    const bounds = stage.getBoundingClientRect();
    pointerX.set((clientX - bounds.left) / bounds.width - 0.5);
    pointerY.set((clientY - bounds.top) / bounds.height - 0.5);
  }, [pointerX, pointerY]);

  const release = useCallback(() => {
    pointerX.set(0);
    pointerY.set(0);
  }, [pointerX, pointerY]);

  // Touch devices have no hover, so the card follows a drag instead. iOS also
  // gates the motion sensors behind an explicit gesture, so gyro tilt is opt-in
  // on tap rather than something the page asks for on arrival.
  const [gyroOn, setGyroOn] = useState(false);
  const enableGyro = useCallback(async () => {
    if (reduceMotion || gyroOn) return;
    const DeviceOrientation = window.DeviceOrientationEvent;
    if (!DeviceOrientation) return;
    try {
      if (typeof DeviceOrientation.requestPermission === 'function') {
        const state = await DeviceOrientation.requestPermission();
        if (state !== 'granted') return;
      }
      setGyroOn(true);
    } catch {
      /* Sensor unavailable — drag still works. */
    }
  }, [gyroOn, reduceMotion]);

  useEffect(() => {
    if (!gyroOn) return undefined;
    const onOrient = (event) => {
      const { beta, gamma } = event;
      if (beta == null || gamma == null) return;
      pointerX.set(Math.max(-0.5, Math.min(0.5, gamma / 45)));
      pointerY.set(Math.max(-0.5, Math.min(0.5, (beta - 45) / 45)));
    };
    window.addEventListener('deviceorientation', onOrient);
    return () => window.removeEventListener('deviceorientation', onOrient);
  }, [gyroOn, pointerX, pointerY]);

  const number = memberNumberLabel(card.memberNumber);
  const role = roleLine(card);

  return (
    <div className="w-full max-w-[40rem]" style={{ containerType: 'inline-size' }}>
      <div
        ref={stageRef}
        onPointerMove={(e) => { if (!reduceMotion && e.pointerType !== 'touch') track(e.clientX, e.clientY); }}
        onPointerLeave={release}
        onTouchStart={enableGyro}
        onTouchMove={(e) => { if (!reduceMotion && e.touches[0]) track(e.touches[0].clientX, e.touches[0].clientY); }}
        onTouchEnd={release}
        style={{ perspective: '1400px' }}
        className="relative w-full touch-pan-y"
      >
        {/* Contact shadow, under the card and independent of its rotation. */}
        <motion.div
          aria-hidden
          style={{ x: shadowX, scaleX: shadowScale }}
          className="absolute inset-x-[8%] bottom-[-6%] h-[12%] rounded-[50%] bg-black/70 blur-2xl"
        />

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 44, rotateX: -26, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 60, damping: 15, mass: 1.1 }}
          style={{
            rotateX,
            rotateY,
            transformStyle: 'preserve-3d',
            aspectRatio: '1.586 / 1',
            // One type scale for the whole card, driven by its own width, so
            // the composition holds together from a phone to a desktop.
            fontSize: 'clamp(5.5px, 1.5625cqw, 10px)',
          }}
          className="relative w-full select-none"
        >
          {/* Thickness: a second panel sitting behind the face. */}
          <div
            aria-hidden
            style={{ transform: 'translateZ(-1.4em)' }}
            className="absolute inset-0 rounded-[2.2em] bg-[#040507] shadow-[0_2.4em_5em_-1em_rgba(0,0,0,0.9)]"
          />

          <div className="absolute inset-0 overflow-hidden rounded-[2.2em] bg-gradient-to-br from-card-panel to-card-ink ring-1 ring-white/10">
            {/* Brushed grain */}
            <div
              aria-hidden
              className="absolute inset-0 opacity-[0.05]"
              style={{
                backgroundImage: 'repeating-linear-gradient(102deg, #fff 0 1px, transparent 1px 3px)',
              }}
            />

            {/* Foil. Two passes: a narrow brass sheen doing most of the work,
                and a wider, fainter tricolore spectrum trailing it. Both screen
                rather than overlay — over a near-black panel, overlay behaves
                like multiply and the sheen disappears instead of lighting up. */}
            <motion.div
              aria-hidden
              initial={reduceMotion ? false : { backgroundPosition: '0% 50%', opacity: 0 }}
              animate={{ backgroundPosition: '50% 50%', opacity: 1 }}
              transition={{ duration: 1.5, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
              style={{
                backgroundPosition: reduceMotion ? '50% 50%' : foilPosition,
                backgroundSize: '300% 300%',
                backgroundImage:
                  'linear-gradient(104deg, transparent 30%, rgba(200,165,91,0.13) 42%, rgba(255,243,214,0.20) 50%, rgba(200,165,91,0.12) 58%, transparent 70%)',
                mixBlendMode: 'screen',
              }}
              className="absolute inset-0"
            />
            <motion.div
              aria-hidden
              initial={reduceMotion ? false : { backgroundPosition: '0% 50%', opacity: 0 }}
              animate={{ backgroundPosition: '50% 50%', opacity: 1 }}
              transition={{ duration: 1.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              style={{
                backgroundPosition: reduceMotion ? '50% 50%' : foilPosition,
                backgroundSize: '300% 300%',
                backgroundImage:
                  'linear-gradient(104deg, transparent 26%, rgba(0,146,70,0.09) 40%, rgba(241,242,241,0.05) 50%, rgba(206,43,55,0.09) 60%, transparent 74%)',
                mixBlendMode: 'screen',
              }}
              className="absolute inset-0"
            />

            {/* Specular highlight */}
            <motion.div
              aria-hidden
              style={{ backgroundImage: reduceMotion ? 'none' : glare, mixBlendMode: 'overlay' }}
              className="absolute inset-0 opacity-70"
            />

            {/* Vignette. Pulls the lit edges back down so the type in the
                middle of the panel keeps its contrast wherever the sheen is. */}
            <div
              aria-hidden
              className="absolute inset-0"
              style={{ background: 'radial-gradient(ellipse 80% 92% at 50% 50%, transparent 32%, rgba(6,8,11,0.6) 100%)' }}
            />

            {/* Tricolore edge */}
            <div aria-hidden className="absolute inset-y-0 left-0 w-[1.2em] flex flex-col">
              <span className="flex-1 bg-itc-green" />
              <span className="flex-1 bg-itc-white" />
              <span className="flex-1 bg-itc-red" />
            </div>

            {/* Bevel */}
            <div
              aria-hidden
              className="absolute inset-0 rounded-[2.2em]"
              style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(0,0,0,0.6)' }}
            />

            {/* Content, lifted off the panel so it parallaxes as the card leans */}
            <div
              style={{ transform: 'translateZ(2.2em)', transformStyle: 'preserve-3d' }}
              className="relative flex h-full flex-col justify-between pl-[4.6em] pr-[3.4em] py-[3.2em]"
            >
              <div className="flex items-start justify-between gap-[2em]">
                <div className="font-display">
                  <p className="text-[1.15em] font-semibold uppercase tracking-[0.28em] text-itc-white">
                    Italian Tech Club
                  </p>
                  <p className="mt-[0.5em] text-[1.05em] uppercase tracking-[0.28em] text-card-mute">
                    {CHAPTER}
                  </p>
                </div>

                <div className="text-right">
                  <p
                    className="font-serial text-[7.2em] font-bold leading-[0.82] tracking-[0.02em]"
                    style={{
                      backgroundImage: 'linear-gradient(168deg, #F0DFAE 4%, #C8A55B 52%, #8E6F32 96%)',
                      WebkitBackgroundClip: 'text',
                      backgroundClip: 'text',
                      color: 'transparent',
                    }}
                  >
                    {number}
                  </p>
                  <p className="mt-[0.7em] font-serial text-[0.95em] uppercase tracking-[0.42em] text-card-mute">
                    Member
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-[2.4em]">
                <div className="h-[10.4em] w-[10.4em] flex-shrink-0 overflow-hidden rounded-[1.3em] bg-black/40 ring-1 ring-white/20">
                  {card.profilePic ? (
                    <img
                      src={card.profilePic}
                      alt=""
                      className="h-full w-full object-cover"
                      draggable={false}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center font-display text-[3.6em] font-bold text-card-brass">
                      {initialsOf(card)}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h1 className="font-display text-[3.05em] font-extrabold uppercase leading-[1.02] tracking-[-0.015em] text-itc-white">
                    {card.firstName}
                    <br />
                    {card.lastName}
                  </h1>
                  {role && (
                    <p className="mt-[0.6em] truncate font-display text-[1.3em] text-card-mute">{role}</p>
                  )}
                </div>
              </div>

              <div>
                <div aria-hidden className="mb-[1.5em] h-px w-full bg-white/15" />
                <div className="flex items-center justify-between font-serial text-[0.95em] uppercase tracking-[0.34em] text-card-mute">
                  <span>{card.memberSince ? `Admitted ${card.memberSince}` : 'Admitted'}</span>
                  {card.isFounder && <span className="text-card-brass">Founding team</span>}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Actions                                                                   */
/* -------------------------------------------------------------------------- */

const ActionButton = ({ icon: Icon, label, done, onClick, href, primary }) => {
  const className = primary
    ? 'flex items-center justify-center gap-2 rounded-full bg-itc-white px-6 py-3 font-display text-sm font-semibold text-card-ink transition-colors hover:bg-card-brassHi'
    : 'flex items-center justify-center gap-2 rounded-full border border-white/15 px-6 py-3 font-display text-sm font-medium text-card-smoke transition-colors hover:border-white/35 hover:text-itc-white';

  const content = (
    <>
      {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
      {done || label}
    </>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={className}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
};

/**
 * Default post text.
 *
 * Written the way the member would say it out loud, not the way the club would
 * describe itself. The first line carries the hook, the club's name and the
 * number, because LinkedIn cuts the post off after roughly two lines and
 * everything below that is only read by people who already decided to care.
 * The link goes last, where readers look for the thing to click.
 */
const buildCaption = (card, url) => [
  `I have a number now. Member ${memberNumberLabel(card.memberNumber)}, Italian Tech Club.`,
  '',
  'A room in New York full of Italians who left home, built something here, and never quite lost the accent. Founders, engineers, investors — all of us starting over in the same city.',
  '',
  'You apply and they decide. Mine came through.',
  '',
  url,
].join('\n');

const dataUrlToFile = async (dataUrl, filename) => {
  const blob = await (await fetch(dataUrl)).blob();
  return new File([blob], filename, { type: blob.type });
};

/**
 * Share sheet.
 *
 * LinkedIn's share-offsite endpoint accepts a URL and nothing else — the title,
 * summary and image parameters it used to take were removed, and there is no
 * supported way to hand it post text or an attachment from a link. So the image
 * and the words have to travel by other means: the system share sheet where it
 * exists (which does attach both), and otherwise the clipboard plus a download,
 * with the composer opened after.
 */
const ShareSheet = ({ card, url, onClose }) => {
  const [caption, setCaption] = useState(() => buildCaption(card, url));
  const [flash, setFlash] = useState('');
  const [busy, setBusy] = useState('');
  const [preview, setPreview] = useState(null);
  const imageRef = useRef(null);
  const filename = `itc-member-${memberNumberLabel(card.memberNumber)}.jpg`;

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  // Rendering takes a beat, so do it once up front and reuse it for the
  // preview, the download and the native share.
  useEffect(() => {
    let cancelled = false;
    renderCardImage(card)
      .then((dataUrl) => {
        if (cancelled) return;
        imageRef.current = dataUrl;
        setPreview(dataUrl);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [card]);

  const ensureImage = async () => {
    if (!imageRef.current) imageRef.current = await renderCardImage(card);
    return imageRef.current;
  };

  const note = (message) => {
    setFlash(message);
    setTimeout(() => setFlash(''), 2600);
  };

  // navigator.canShare exists on desktop Chrome but refuses files there, so the
  // only honest test is to ask it about an actual file.
  const [canShareFiles] = useState(() => {
    try {
      const probe = new File([new Uint8Array(1)], 'probe.jpg', { type: 'image/jpeg' });
      return typeof navigator.share === 'function' && navigator.canShare?.({ files: [probe] }) === true;
    } catch {
      return false;
    }
  });

  const shareNatively = async () => {
    setBusy('share');
    try {
      const file = await dataUrlToFile(await ensureImage(), filename);
      if (!navigator.canShare({ files: [file] })) throw new Error('unsupported');
      await navigator.share({ files: [file], text: caption });
    } catch (error) {
      if (error?.name !== 'AbortError') note('Sharing was not available — copy the caption instead.');
    } finally {
      setBusy('');
    }
  };

  const download = async () => {
    setBusy('download');
    try {
      const link = document.createElement('a');
      link.href = await ensureImage();
      link.download = filename;
      link.click();
      note('Image saved. Attach it to your post.');
    } finally {
      setBusy('');
    }
  };

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      note('Caption copied.');
    } catch {
      note('Select the text above and copy it.');
    }
  };

  const openLinkedIn = async () => {
    await copyCaption();
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank', 'noopener');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-6"
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Share your member card"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-card-ink p-6 sm:rounded-3xl sm:p-8"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-itc-white">Share your card</h2>
            <p className="mt-1 font-display text-sm text-card-smoke">
              LinkedIn can't carry your words across. They'll be on your clipboard — paste them in.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-card-smoke transition-colors hover:bg-white/10 hover:text-itc-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-5 overflow-hidden rounded-2xl border border-white/10 bg-black/40">
          {preview ? (
            <img src={preview} alt="" className="block w-full" />
          ) : (
            <div className="flex aspect-[1200/630] items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/15 border-t-card-brass" />
            </div>
          )}
        </div>

        <label className="mb-2 block font-serial text-[10px] uppercase tracking-[0.28em] text-card-smoke">
          Caption
        </label>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={7}
          className="w-full resize-none rounded-2xl border border-white/15 bg-black/40 p-4 font-display text-sm leading-relaxed text-itc-white outline-none transition-colors focus:border-card-brass"
        />

        <div className="mt-5 space-y-3">
          {canShareFiles && (
            <button
              type="button"
              onClick={shareNatively}
              disabled={busy === 'share'}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-itc-white px-6 py-3 font-display text-sm font-semibold text-card-ink transition-colors hover:bg-card-brassHi disabled:opacity-60"
            >
              <Share2 className="h-4 w-4" />
              {busy === 'share' ? 'Preparing…' : 'Share with image'}
            </button>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={download}
              disabled={busy === 'download'}
              className="flex items-center justify-center gap-2 rounded-full border border-white/15 px-5 py-3 font-display text-sm font-medium text-card-smoke transition-colors hover:border-white/35 hover:text-itc-white disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              {busy === 'download' ? 'Rendering…' : 'Download image'}
            </button>
            <button
              type="button"
              onClick={copyCaption}
              className="flex items-center justify-center gap-2 rounded-full border border-white/15 px-5 py-3 font-display text-sm font-medium text-card-smoke transition-colors hover:border-white/35 hover:text-itc-white"
            >
              <Copy className="h-4 w-4" /> Copy caption
            </button>
          </div>

          <button
            type="button"
            onClick={openLinkedIn}
            className={`flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 font-display text-sm font-semibold transition-colors ${
              canShareFiles
                ? 'border border-white/15 text-card-smoke hover:border-white/35 hover:text-itc-white'
                : 'bg-itc-white text-card-ink hover:bg-card-brassHi'
            }`}
          >
            <Linkedin className="h-4 w-4" /> Copy and open LinkedIn
          </button>
        </div>

        <p role="status" className="mt-4 min-h-[1.25rem] text-center font-display text-xs text-card-brass">
          {flash}
        </p>

        <p className="mt-1 text-center font-display text-xs leading-relaxed text-card-smoke">
          Posts with the image attached travel further than links. Either way, your card shows up.
        </p>
      </motion.div>
    </motion.div>
  );
};

export const CardActions = ({ card }) => {
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  // The link people should share is the one they are looking at, so a card
  // opened on a preview deployment shares that deployment and not production.
  const url = `${window.location.origin}/m/${card.slug}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      /* Clipboard blocked — the URL is in the address bar either way. */
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <ActionButton primary icon={Share2} label="Share your card" onClick={() => setSharing(true)} />
        <ActionButton
          icon={Link2}
          label="Copy link"
          done={copied ? 'Copied' : ''}
          onClick={copyLink}
        />
      </div>
      <AnimatePresence>
        {sharing && <ShareSheet card={card} url={url} onClose={() => setSharing(false)} />}
      </AnimatePresence>
    </>
  );
};

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

const Shell = ({ children }) => (
  <main className="relative min-h-screen overflow-hidden bg-card-ink">
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-[70vh]"
      style={{ background: 'radial-gradient(ellipse 60% 100% at 50% -10%, rgba(200,165,91,0.16), transparent 70%)' }}
    />
    <div aria-hidden className="pointer-events-none absolute inset-0 bg-dot-grid text-white/5 mask-fade-edges" />

    <div className="relative mx-auto flex min-h-screen w-full max-w-4xl flex-col px-5 py-8 sm:px-8">
      <header className="flex items-center justify-between font-serial text-[10px] uppercase tracking-[0.34em] text-card-smoke">
        <Link to="/" className="transition-colors hover:text-itc-white">Italian Tech Club</Link>
        <span>Member record</span>
      </header>
      {children}
    </div>
  </main>
);

const MemberCard = () => {
  const { slug } = useParams();
  const [state, setState] = useState({ status: 'loading', card: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`${API_URL}/api/community/card?slug=${encodeURIComponent(slug)}`);
        const data = await response.json();
        if (cancelled) return;
        setState(response.ok && data.success
          ? { status: 'ready', card: data.card }
          : { status: 'missing', card: null });
      } catch {
        if (!cancelled) setState({ status: 'missing', card: null });
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  if (state.status === 'loading') {
    return (
      <Shell>
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-card-brass" />
        </div>
      </Shell>
    );
  }

  if (state.status === 'missing') {
    return (
      <Shell>
        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <p className="font-display text-2xl font-semibold text-itc-white">No member record at this address.</p>
          <p className="max-w-sm font-display text-sm text-card-smoke">
            Check the link, or find the member in the community directory.
          </p>
          <Link
            to="/community"
            className="flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 font-display text-sm text-card-smoke transition-colors hover:border-white/35 hover:text-itc-white"
          >
            See the community <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </Shell>
    );
  }

  const { card } = state;

  return (
    <Shell>
      <div className="flex flex-1 flex-col items-center justify-center gap-10 py-12 sm:gap-12">
        <Credential card={card} />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[40rem]"
        >
          <CardActions card={card} />
        </motion.div>
      </div>

      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.6 }}
        className="mt-auto border-t border-white/10 pt-6"
      >
        <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="font-display text-sm text-card-smoke">
            New members are reviewed one name at a time.
          </p>
          <Link
            to="/community"
            className="flex items-center gap-1.5 font-display text-sm font-medium text-card-brass transition-colors hover:text-card-brassHi"
          >
            Apply for membership <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </motion.footer>
    </Shell>
  );
};

export default MemberCard;
