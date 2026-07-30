/**
 * Canvas renderer for the member card's link-preview image.
 *
 * The page at /m/<slug> is a DOM object in CSS 3D — it tilts, the foil travels,
 * the edge shows. None of that reaches LinkedIn, which shows one static image
 * and never runs JavaScript. So this draws the same credential and then
 * projects it in perspective, to hand over a still frame of the real thing
 * rather than a flat substitute for it.
 *
 * Rendered in the browser and stored on the profile, because a crawler asking
 * for the image will not wait for anything to be generated.
 */

export const OG_WIDTH = 2400;
export const OG_HEIGHT = 1260;

// The DOM card sets one font-size from its own width and lays everything out in
// em. Mirroring that here means the two renders share a single set of numbers:
// every measurement below is px at a 640px-wide card, scaled by `u`.
const FACE_BASIS = 640;
const FACE_RATIO = 1.586;

export const PALETTE = {
  ink: '#0A0C0F',
  panel: '#15181E',
  brass: '#C8A55B',
  brassHi: '#F0DFAE',
  bone: '#F1F2F1',
  mute: '#AEB6C1',
  green: '#009246',
  red: '#CE2B37',
};

export const CHAPTER = 'NEW YORK CHAPTER';

export const memberNumberLabel = (memberNumber) =>
  memberNumber == null ? '—' : String(memberNumber).padStart(3, '0');

export const initialsOf = ({ firstName = '', lastName = '' }) =>
  `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || '·';

export const roleLine = ({ profession = '', company = '' }) =>
  [profession, company].filter(Boolean).join(' · ');

/**
 * Identity of a rendered image, so a stored preview can be recognised as stale
 * without re-rendering it to compare. Photos are compared by length and a short
 * sample rather than in full — they are megabytes of base64 and any edit moves
 * both.
 */
export const cardImageKey = (card) => [
  card.firstName,
  card.lastName,
  card.profession,
  card.company,
  card.memberNumber,
  card.memberSince,
  card.isFounder ? 'f' : '',
  card.profilePic ? `${card.profilePic.length}:${card.profilePic.slice(-24)}` : 'nopic',
].join('|');

const REQUIRED_FONTS = [
  '600 12px Archivo',
  '400 11px Archivo',
  '800 31px Archivo',
  '500 13px Archivo',
  '700 37px Archivo',
  '700 72px "JetBrains Mono"',
  '500 10px "JetBrains Mono"',
];

// Canvas silently substitutes a system face for a font that has not loaded, so
// the whole set has to be ready before the first stroke.
export async function ensureCardFonts() {
  if (typeof document === 'undefined' || !document.fonts) return;
  await Promise.all(REQUIRED_FONTS.map((font) => document.fonts.load(font).catch(() => {})));
  await document.fonts.ready;
}

function roundedRectPath(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

// Shrink until it fits rather than clipping — a member's own name is the last
// thing that should get cut off.
function fitText(ctx, text, maxWidth, buildFont, startSize, minSize) {
  let size = startSize;
  ctx.font = buildFont(size);
  while (ctx.measureText(text).width > maxWidth && size > minSize) {
    size -= 1;
    ctx.font = buildFont(size);
  }
  return size;
}

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

/* -------------------------------------------------------------------------- */
/*  The card face                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Draw the credential flat onto a transparent canvas of the given width. Same
 * composition as the DOM card: masthead and serial across the top, portrait and
 * name through the middle, spec line under a hairline at the foot.
 */
function renderFace(card, portrait, faceWidth) {
  const u = faceWidth / FACE_BASIS;
  const W = faceWidth;
  const H = Math.round(faceWidth / FACE_RATIO);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const radius = 22 * u;
  ctx.save();
  roundedRectPath(ctx, 0, 0, W, H, radius);
  ctx.clip();

  // Panel
  const base = ctx.createLinearGradient(0, 0, W, H);
  base.addColorStop(0, PALETTE.panel);
  base.addColorStop(1, PALETTE.ink);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  // Brushed grain, at the same 102deg as the DOM card. Deliberately not scaled
  // with `u`: grain is a property of the surface, not of how large the card is
  // drawn, and scaling it turns a texture into stripes.
  ctx.save();
  ctx.globalAlpha = 0.03;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  const grainStep = 5;
  const slope = Math.tan((102 - 90) * Math.PI / 180);
  for (let x = -H * Math.abs(slope); x < W + H * Math.abs(slope); x += grainStep) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + H * slope, H);
    ctx.stroke();
  }
  ctx.restore();

  // Foil: a brass sheen with a fainter tricolore spectrum trailing it, frozen
  // near the middle of its travel.
  const foilAngle = 104 * Math.PI / 180;
  const fx = Math.cos(foilAngle) * W;
  const fy = Math.sin(foilAngle) * H;
  const sheen = ctx.createLinearGradient(W / 2 - fx / 2, H / 2 - fy / 2, W / 2 + fx / 2, H / 2 + fy / 2);
  sheen.addColorStop(0, 'rgba(200,165,91,0)');
  sheen.addColorStop(0.3, 'rgba(0,146,70,0.08)');
  sheen.addColorStop(0.44, 'rgba(200,165,91,0.12)');
  sheen.addColorStop(0.5, 'rgba(255,243,214,0.15)');
  sheen.addColorStop(0.56, 'rgba(200,165,91,0.11)');
  sheen.addColorStop(0.7, 'rgba(206,43,55,0.10)');
  sheen.addColorStop(1, 'rgba(200,165,91,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, W, H);

  // Specular highlight, at the resting position of the live card's. Offset
  // toward the top-left so it does not sit on the name.
  const spec = ctx.createRadialGradient(W * 0.34, H * 0.3, 0, W * 0.34, H * 0.3, W * 0.55);
  spec.addColorStop(0, 'rgba(255,255,255,0.07)');
  spec.addColorStop(0.4, 'rgba(255,255,255,0.015)');
  spec.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = spec;
  ctx.fillRect(0, 0, W, H);

  // Vignette — keeps the type's contrast wherever the sheen falls.
  const vignette = ctx.createRadialGradient(W / 2, H / 2, W * 0.2, W / 2, H / 2, W * 0.62);
  vignette.addColorStop(0, 'rgba(6,8,11,0)');
  vignette.addColorStop(1, 'rgba(6,8,11,0.5)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);

  // Tricolore edge
  const edgeW = 12 * u;
  [PALETTE.green, PALETTE.bone, PALETTE.red].forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, (i * H) / 3, edgeW, H / 3 + 1);
  });

  /* ---- Content ---------------------------------------------------------- */

  const padL = 46 * u;
  const padR = 34 * u;
  const padY = 32 * u;
  const left = padL;
  const right = W - padR;

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  // Row heights, so the three blocks distribute exactly as the DOM card's
  // justify-between does.
  const mastheadH = 12 * u * 1.2 + 5 * u + 11 * u * 1.2;
  const serialH = 72 * u * 0.82 + 7 * u + 10 * u * 1.2;
  const headH = Math.max(mastheadH, serialH);
  const photoSize = 104 * u;
  const footH = 1 + 15 * u + 10 * u * 1.2;
  const free = H - padY * 2 - headH - photoSize - footH;
  const gap = free / 2;

  const headTop = padY;
  const midTop = headTop + headH + gap;
  const footTop = midTop + photoSize + gap;

  // Masthead
  ctx.fillStyle = PALETTE.bone;
  ctx.font = `600 ${12 * u}px Archivo`;
  ctx.letterSpacing = `${3.4 * u}px`;
  ctx.fillText('ITALIAN TECH CLUB', left, headTop + 12 * u);
  ctx.fillStyle = PALETTE.mute;
  ctx.font = `400 ${11 * u}px Archivo`;
  ctx.letterSpacing = `${3.1 * u}px`;
  ctx.fillText(CHAPTER, left, headTop + 12 * u + 5 * u + 11 * u);
  ctx.letterSpacing = '0px';

  // Serial — the one element allowed to shout.
  ctx.textAlign = 'right';
  const numberSize = 72 * u;
  const numberBaseline = headTop + numberSize * 0.78;
  const numberGradient = ctx.createLinearGradient(0, numberBaseline - numberSize * 0.78, 0, numberBaseline);
  numberGradient.addColorStop(0, PALETTE.brassHi);
  numberGradient.addColorStop(0.52, PALETTE.brass);
  numberGradient.addColorStop(1, '#8E6F32');
  ctx.fillStyle = numberGradient;
  ctx.font = `700 ${numberSize}px "JetBrains Mono"`;
  ctx.letterSpacing = `${1.4 * u}px`;
  ctx.fillText(memberNumberLabel(card.memberNumber), right, numberBaseline);

  ctx.fillStyle = PALETTE.mute;
  ctx.font = `500 ${10 * u}px "JetBrains Mono"`;
  ctx.letterSpacing = `${4.2 * u}px`;
  ctx.fillText('MEMBER', right, numberBaseline + 7 * u + 10 * u);
  ctx.letterSpacing = '0px';
  ctx.textAlign = 'left';

  // Portrait
  const photoR = 13 * u;
  ctx.save();
  roundedRectPath(ctx, left, midTop, photoSize, photoSize, photoR);
  ctx.clip();
  if (portrait) {
    const scale = Math.max(photoSize / portrait.width, photoSize / portrait.height);
    const dw = portrait.width * scale;
    const dh = portrait.height * scale;
    ctx.drawImage(portrait, left + (photoSize - dw) / 2, midTop + (photoSize - dh) / 2, dw, dh);
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(left, midTop, photoSize, photoSize);
    ctx.fillStyle = PALETTE.brass;
    ctx.font = `700 ${36 * u}px Archivo`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initialsOf(card), left + photoSize / 2, midTop + photoSize / 2 + 2 * u);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();
  ctx.save();
  roundedRectPath(ctx, left + 0.5, midTop + 0.5, photoSize - 1, photoSize - 1, photoR);
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  // Name and role
  const textLeft = left + photoSize + 24 * u;
  const textWidth = right - textLeft;
  const first = (card.firstName || '').toUpperCase();
  const last = (card.lastName || '').toUpperCase();
  const nameSize = Math.min(
    fitText(ctx, first, textWidth, (s) => `800 ${s}px Archivo`, 31 * u, 16 * u),
    fitText(ctx, last, textWidth, (s) => `800 ${s}px Archivo`, 31 * u, 16 * u),
  );
  const lineHeight = nameSize * 1.02;
  const role = roleLine(card);
  const roleSize = 13 * u;
  const blockH = lineHeight * 2 + (role ? 6 * u + roleSize : 0);
  let cursor = midTop + (photoSize - blockH) / 2 + nameSize * 0.82;

  ctx.font = `800 ${nameSize}px Archivo`;
  ctx.fillStyle = PALETTE.bone;
  ctx.letterSpacing = `${-nameSize * 0.015}px`;
  ctx.fillText(first, textLeft, cursor);
  cursor += lineHeight;
  ctx.fillText(last, textLeft, cursor);
  ctx.letterSpacing = '0px';

  if (role) {
    ctx.fillStyle = PALETTE.mute;
    fitText(ctx, role, textWidth, (s) => `500 ${s}px Archivo`, roleSize, 9 * u);
    ctx.fillText(role, textLeft, cursor + 6 * u + roleSize * 0.82);
  }

  // Spec line
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(left, footTop + 0.5);
  ctx.lineTo(right, footTop + 0.5);
  ctx.stroke();

  const footBaseline = footTop + 15 * u + 10 * u;
  ctx.fillStyle = PALETTE.mute;
  ctx.font = `500 ${10 * u}px "JetBrains Mono"`;
  ctx.letterSpacing = `${3.4 * u}px`;
  ctx.fillText(card.memberSince ? `ADMITTED ${card.memberSince}` : 'ADMITTED', left, footBaseline);
  if (card.isFounder) {
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.brass;
    ctx.fillText('FOUNDING TEAM', right, footBaseline);
    ctx.textAlign = 'left';
  }
  ctx.letterSpacing = '0px';

  ctx.restore();

  // Bevel
  ctx.save();
  roundedRectPath(ctx, 0.5 * u, 0.5 * u, W - u, H - u, radius);
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1.5 * u;
  ctx.stroke();
  ctx.restore();

  return canvas;
}

/* -------------------------------------------------------------------------- */
/*  The preview                                                               */
/* -------------------------------------------------------------------------- */

// The frame is wider than the card is, so height is what constrains it.
const CARD_HEIGHT_FRACTION = 0.84;

/**
 * Draw the preview and return it as a JPEG data URL: the credential head-on,
 * over the same ink and key light the page sits on.
 *
 * The face is drawn at exactly the size it appears — no scaling on the way in
 * — so nothing is resampled and the type is as sharp as the canvas can make it.
 * `card` is the public card payload from GET /api/community/card.
 */
export async function renderCardImage(card) {
  await ensureCardFonts();
  const portrait = await loadImage(card.profilePic);

  const canvas = document.createElement('canvas');
  canvas.width = OG_WIDTH;
  canvas.height = OG_HEIGHT;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(0, 0, OG_WIDTH, OG_HEIGHT);
  const key = ctx.createRadialGradient(OG_WIDTH / 2, -OG_HEIGHT * 0.1, 0, OG_WIDTH / 2, -OG_HEIGHT * 0.1, OG_WIDTH * 0.72);
  key.addColorStop(0, 'rgba(200,165,91,0.20)');
  key.addColorStop(0.55, 'rgba(200,165,91,0.05)');
  key.addColorStop(1, 'rgba(200,165,91,0)');
  ctx.fillStyle = key;
  ctx.fillRect(0, 0, OG_WIDTH, OG_HEIGHT);

  const cardHeight = Math.round(OG_HEIGHT * CARD_HEIGHT_FRACTION);
  const cardWidth = Math.round(cardHeight * FACE_RATIO);
  const x = Math.round((OG_WIDTH - cardWidth) / 2);
  const y = Math.round((OG_HEIGHT - cardHeight) / 2);

  // Contact shadow, sitting under the card and spread a little wider than it.
  ctx.save();
  ctx.filter = 'blur(46px)';
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.beginPath();
  ctx.ellipse(OG_WIDTH / 2, y + cardHeight * 0.99, cardWidth * 0.44, cardHeight * 0.075, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.drawImage(renderFace(card, portrait, cardWidth), x, y);

  // JPEG, not PNG. The render is 2400px of photographic gradient, which PNG
  // stores at ~2.7MB — past Vercel's 4.5MB request body once base64 encoding
  // adds a third, and heavy to keep on the profile document. At this quality
  // the difference is invisible and the file is an order of magnitude smaller.
  return canvas.toDataURL('image/jpeg', 0.9);
}
