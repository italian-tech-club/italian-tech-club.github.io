/**
 * Copy text to the clipboard, including on origins the async Clipboard API
 * refuses.
 *
 * The fallback is not belt-and-braces: vite binds 0.0.0.0 in dev so the panel
 * can be opened from another device on the LAN, and `http://192.168.x.x` is not
 * a secure context — `navigator.clipboard` is plainly undefined there. The
 * deprecated execCommand path is the only thing that copies on such an origin.
 *
 * Returns whether the text actually made it, so a caller can show a confirmation
 * only when there is something to confirm.
 */
export async function copyText(text) {
  const value = String(text ?? '');
  if (!value) return false;

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // A denied permission and an insecure origin both land here; fall through.
    }
  }

  const area = document.createElement('textarea');
  area.value = value;
  area.setAttribute('readonly', '');
  // Parked off-screen rather than hidden: execCommand copies the selection, and
  // a display:none element cannot hold one.
  area.style.position = 'fixed';
  area.style.top = '-1000px';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();

  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    area.remove();
  }
}

/**
 * A phone number reduced to what a phone field expects — Gomry stores the
 * form's own spacing ("+39 331 226 3313"), which pastes badly into WhatsApp.
 */
export const toE164 = (phone) => String(phone || '').replace(/[^\d+]/g, '');
