import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Linkedin, ImagePlus, Check } from 'lucide-react';
import { fileToResizedDataUrl } from '../utils/image';

/**
 * Get a member's real photo off their LinkedIn page in one gesture.
 *
 * The photo can't be fetched for them: LinkedIn answers a server with HTTP 999,
 * and its og:image is a small link-preview crop we don't use. So a human has to
 * be the one looking at the page — which is what
 * `scripts/collect-linkedin-pics.js` does with a scripted Chrome window. This is
 * that same job without leaving the admin panel: open the profile in a tab, then
 * hand the photo over by whichever route is nearest to hand.
 *
 *   drag the photo out of the LinkedIn tab  → its media.licdn.com URL, fetched
 *                                             and upscaled to the 800px render
 *   right-click → Copy Image, then ⌘V       → the bytes, straight from the clipboard
 *   Copy Image Address, then ⌘V             → the URL again
 *   the "file" link                         → an ordinary file picker (screenshots)
 *
 * Clipboard images and picked files are downscaled here rather than server-side:
 * the originals run to several megabytes and the serverless request body caps at
 * 4.5MB, so a 900px JPEG goes over the wire instead.
 *
 * `onPhoto` receives exactly one of `{ profilePic }` (a data URL) or
 * `{ profilePicUrl }` (for the server to fetch), which is the same pair the
 * admin endpoints accept. Errors are reported through `onError` rather than
 * rendered here, so a card can show one message for the photo and the decision
 * alike.
 */

const MAX_DIM = 900;
const JPEG_QUALITY = 0.85;

const looksLikeUrl = (text) => /^https:\/\/\S+$/i.test((text || '').trim());

const PhotoGrabber = ({
  linkedIn = '',
  initials = '·',
  preview = null,
  hasPhoto = false,
  busy = false,
  hint = '',
  onPhoto,
  onError,
}) => {
  // "Armed" means the next ⌘V anywhere on the page belongs to this frame. A
  // window listener rather than an onPaste prop because a paste over a plain
  // div lands on <body> as often as on the div itself, depending on what the
  // browser considers focused.
  const [armed, setArmed] = useState(false);
  const [working, setWorking] = useState(false);
  const [dragging, setDragging] = useState(false);
  // A dragged-in URL is previewed by pointing <img> straight at it, which the
  // host may refuse. Falling back to the initials keeps a broken frame off the
  // card — the server fetches the same URL regardless.
  const [previewBroken, setPreviewBroken] = useState(false);
  const fileInput = useRef(null);

  useEffect(() => { setPreviewBroken(false); }, [preview]);

  const fail = useCallback((message) => {
    setArmed(false);
    if (onError) onError(message);
  }, [onError]);

  const sendFile = useCallback(async (file) => {
    if (!file || !file.type.startsWith('image/')) return fail('That is not an image.');
    setWorking(true);
    try {
      onPhoto({ profilePic: await fileToResizedDataUrl(file, MAX_DIM, JPEG_QUALITY) });
      setArmed(false);
    } catch {
      fail('Could not read that image.');
    } finally {
      setWorking(false);
    }
  }, [fail, onPhoto]);

  useEffect(() => {
    if (!armed) return undefined;

    const onPaste = (event) => {
      const image = [...(event.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
      if (image) {
        event.preventDefault();
        return sendFile(image.getAsFile());
      }
      const text = event.clipboardData?.getData('text') || '';
      if (looksLikeUrl(text)) {
        event.preventDefault();
        setArmed(false);
        return onPhoto({ profilePicUrl: text.trim() });
      }
      return fail('The clipboard has no image — right-click the photo on LinkedIn and choose Copy Image.');
    };
    const onKey = (event) => { if (event.key === 'Escape') setArmed(false); };

    window.addEventListener('paste', onPaste);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('paste', onPaste);
      window.removeEventListener('keydown', onKey);
    };
  }, [armed, fail, onPhoto, sendFile]);

  const onDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) return sendFile(file);
    // Dragging an image out of another tab hands over its address, not its bytes.
    const url = event.dataTransfer.getData('text/uri-list') || event.dataTransfer.getData('text/plain');
    if (looksLikeUrl(url)) return onPhoto({ profilePicUrl: url.trim().split('\n')[0] });
    return fail('Nothing usable was dropped — try dragging the photo itself.');
  };

  const spinning = busy || working;

  return (
    <div className="flex flex-col items-center gap-1.5 w-[76px] flex-shrink-0">
      {/* onBlur disarms only on a click elsewhere in the page. Switching to the
          LinkedIn tab to copy the photo also fires blur, but with no
          relatedTarget — disarming there would undo the arming right before
          the paste it was set up for. */}
      <button
        type="button"
        onClick={() => setArmed((on) => !on)}
        onBlur={(e) => { if (e.relatedTarget) setArmed(false); }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        title="Click, then ⌘V to paste the photo — or drag it here from LinkedIn"
        className={`relative w-[76px] h-[76px] rounded-xl overflow-hidden flex items-center justify-center transition-all ${
          dragging || armed
            ? 'ring-2 ring-itc-green ring-offset-2 ring-offset-white dark:ring-offset-slate-900'
            : 'ring-1 ring-slate-200 dark:ring-slate-700 hover:ring-slate-400 dark:hover:ring-slate-500'
        }`}
      >
        {preview && !previewBroken ? (
          <img src={preview} alt="" onError={() => setPreviewBroken(true)} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-itc-green to-emerald-700 flex items-center justify-center">
            <span className="text-white font-bold text-lg">{initials}</span>
          </div>
        )}

        {(spinning || armed) && (
          <div className="absolute inset-0 bg-slate-900/70 flex flex-col items-center justify-center text-white gap-0.5">
            {spinning
              ? <Loader2 className="w-5 h-5 animate-spin" />
              : <><ImagePlus className="w-4 h-4" /><span className="text-[9px] font-bold leading-none">press ⌘V</span></>}
          </div>
        )}

        {preview && !previewBroken && !spinning && !armed && (
          <span className="absolute bottom-0 inset-x-0 bg-itc-green/90 text-white text-[9px] font-bold py-0.5 flex items-center justify-center gap-0.5">
            <Check className="w-2.5 h-2.5" /> {hasPhoto ? 'photo' : 'new'}
          </span>
        )}
      </button>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) sendFile(f); }}
      />

      <div className="flex items-center gap-2">
        {linkedIn ? (
          <a
            href={linkedIn}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-itc-green transition-colors"
          >
            <Linkedin className="w-3 h-3" /> open
          </a>
        ) : (
          <span className="text-[10px] text-slate-400">no URL</span>
        )}
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-itc-green transition-colors"
        >
          file
        </button>
      </div>

      {hint && <span className="text-[9px] text-center leading-tight text-slate-400 dark:text-slate-500">{hint}</span>}
    </div>
  );
};

export default PhotoGrabber;
