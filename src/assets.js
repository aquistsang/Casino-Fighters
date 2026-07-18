/**
 * Asset loading and animation definitions.
 * Replace procedural idle with sprite-sheet frames when your sheet is ready.
 */

import { TIMING } from './constants.js';

/** @typedef {{ x: number, y: number, duration?: number, offsetX?: number, offsetY?: number, scaleX?: number, scaleY?: number, rotation?: number, alpha?: number }} FrameDef */
/** @typedef {{ sx: number, sy: number, sw: number, sh: number, offsetX: number, offsetY: number, scaleX: number, scaleY: number, rotation: number, alpha?: number }} DrawFrame */
/**
 * @typedef {Object} AnimationDef
 * @property {HTMLImageElement | HTMLCanvasElement | null} [sheet]
 * @property {HTMLImageElement | HTMLCanvasElement | null} [image]
 * @property {number} frameW
 * @property {number} frameH
 * @property {number} [frameDuration]
 * @property {boolean} [loop]
 * @property {FrameDef[]} [frames]
 * @property {boolean} [procedural]
 * @property {FrameDef[]} [proceduralFrames]
 * @property {(HTMLImageElement | HTMLCanvasElement)[]} [frameImages]
 */

/** Classic SF-style idle: 10 frames of weight shift, head bob, knee bend. */
const IDLE_PROCEDURAL = [
  { offsetX: 0, offsetY: 0, scaleY: 1.0, rotation: 0 },
  { offsetX: 1, offsetY: -1, scaleY: 1.008, rotation: 0.003 },
  { offsetX: 2, offsetY: -2, scaleY: 1.012, rotation: 0.005 },
  { offsetX: 2, offsetY: -3, scaleY: 1.015, rotation: 0.006 },
  { offsetX: 1, offsetY: -2, scaleY: 1.012, rotation: 0.004 },
  { offsetX: 0, offsetY: 0, scaleY: 1.0, rotation: 0 },
  { offsetX: -1, offsetY: 1, scaleY: 0.992, rotation: -0.003 },
  { offsetX: -2, offsetY: 2, scaleY: 0.988, rotation: -0.005 },
  { offsetX: -2, offsetY: 3, scaleY: 0.985, rotation: -0.006 },
  { offsetX: -1, offsetY: 2, scaleY: 0.988, rotation: -0.004 },
];

/** Kick pose micro-motion while the body lunges via fighter.x */
const KICK_PROCEDURAL = [
  { offsetX: -10, offsetY: 4, scaleX: 0.94, scaleY: 1.05, rotation: -0.02 },
  { offsetX: -4, offsetY: 0, scaleX: 0.98, scaleY: 1.02, rotation: 0 },
  { offsetX: 6, offsetY: -6, scaleX: 1.04, scaleY: 0.97, rotation: 0.03 },
  { offsetX: 14, offsetY: -10, scaleX: 1.08, scaleY: 0.94, rotation: 0.05 },
  { offsetX: 16, offsetY: -10, scaleX: 1.1, scaleY: 0.93, rotation: 0.06 },
  { offsetX: 16, offsetY: -8, scaleX: 1.08, scaleY: 0.95, rotation: 0.04 },
  { offsetX: 6, offsetY: -2, scaleX: 1.02, scaleY: 0.98, rotation: 0.01 },
  { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1, rotation: 0 },
];

const ATTACK_PROCEDURAL = [
  { offsetX: 0, offsetY: 0, scaleX: 1, rotation: 0 },
  { offsetX: 8, offsetY: -4, scaleX: 1.05, rotation: 0.04 },
  { offsetX: 28, offsetY: -8, scaleX: 1.12, rotation: 0.08 },
  { offsetX: 42, offsetY: -6, scaleX: 1.15, rotation: 0.1 },
  { offsetX: 18, offsetY: -2, scaleX: 1.05, rotation: 0.03 },
  { offsetX: 0, offsetY: 0, scaleX: 1, rotation: 0 },
];

const HIT_PROCEDURAL = [
  { offsetX: 0, offsetY: 0, rotation: 0, alpha: 1 },
  { offsetX: -6, offsetY: -2, rotation: -0.06, alpha: 0.9 },
  { offsetX: -14, offsetY: -4, rotation: -0.1, alpha: 0.85 },
  { offsetX: -10, offsetY: -2, rotation: -0.07, alpha: 0.9 },
  { offsetX: -4, offsetY: 0, rotation: -0.03, alpha: 1 },
  { offsetX: 0, offsetY: 0, rotation: 0, alpha: 1 },
];

const SPECIAL_PROCEDURAL = [
  { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1, rotation: 0 },
  { offsetX: -10, offsetY: -12, scaleX: 0.95, scaleY: 1.05, rotation: -0.05 },
  { offsetX: 20, offsetY: -20, scaleX: 1.2, scaleY: 1.1, rotation: 0.12 },
  { offsetX: 55, offsetY: -16, scaleX: 1.35, scaleY: 1.15, rotation: 0.18 },
  { offsetX: 70, offsetY: -8, scaleX: 1.4, scaleY: 1.12, rotation: 0.2 },
  { offsetX: 30, offsetY: 0, scaleX: 1.1, scaleY: 1.05, rotation: 0.05 },
  { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1, rotation: 0 },
];

export const assets = {
  playerFighter: /** @type {HTMLImageElement | HTMLCanvasElement | null} */ (null),
  opponentFighter: /** @type {HTMLImageElement | HTMLCanvasElement | null} */ (null),
  opponentPunch: /** @type {HTMLImageElement | HTMLCanvasElement | null} */ (null),
  playerKick: /** @type {HTMLImageElement | HTMLCanvasElement | null} */ (null),
  /** @type {{ idle: HTMLCanvasElement, grab: HTMLCanvasElement, throwPose: HTMLCanvasElement, wig: HTMLCanvasElement } | null} */
  trump: null,
  /** @type {HTMLCanvasElement | null} */
  coinHeads: null,
  /** @type {HTMLCanvasElement | null} */
  coinTails: null,
  /** @type {HTMLCanvasElement | null} */
  coinMiddle: null,
  /** @type {string} */
  coinHeadsUrl: '',
  /** @type {string} */
  coinTailsUrl: '',
  /** @type {string} */
  coinMiddleUrl: '',
  stageBackground: /** @type {HTMLVideoElement | HTMLImageElement | null} */ (null),
  hudOverlay: /** @type {HTMLImageElement | HTMLCanvasElement | null} */ (null),
  loaded: false,
};

/**
 * Load images. Drop sprite sheets into /assets and wire them here.
 * @returns {Promise<void>}
 */
export async function loadAssets() {
  const [
    raw,
    kickRaw,
    opponentRaw,
    punchRaw,
    trumpIdleRaw,
    trumpGrabRaw,
    trumpThrowRaw,
    trumpWigRaw,
    coinHeadsRaw,
    coinTailsRaw,
    coinMiddleRaw,
    stageBackground,
    hudRaw,
  ] = await Promise.all([
    loadImage('assets/player-fighter.png'),
    loadImage('assets/player-kick.png'),
    loadImage('assets/opponent-fighter.png'),
    loadImage('assets/opponent-punch.png'),
    loadImage('assets/trump-idle.png'),
    loadImage('assets/trump-grab-wig.png'),
    loadImage('assets/trump-throw-wig.png'),
    loadImage('assets/trump-wig.png'),
    loadImage('assets/coin-heads.png'),
    loadImage('assets/coin-tails.png'),
    loadImage('assets/coin-middle.png'),
    loadVideo('assets/stage-background.mp4'),
    loadImage('assets/hud-overlay.png'),
  ]);

  // Green-screen idle plate → transparent, crop empty padding (feet on FLOOR_Y)
  const player = cropToOpaque(keyOutGreen(raw));
  // Kick plate already has alpha; soft-punch leftover pure black fringe, then crop
  const kick = cropToOpaque(keyOutBlack(kickRaw, 10));
  // 2P plates → key green, crop empty padding (feet on FLOOR_Y), flip to face 1P
  const opponent = flipHorizontal(cropToOpaque(keyOutGreen(opponentRaw)));
  const punch = flipHorizontal(cropToOpaque(keyOutGreen(punchRaw)));
  // Trump plates face right already (1P side) — key green + crop feet
  const trumpIdle = cropToOpaque(keyOutGreen(trumpIdleRaw));
  const trumpGrab = cropToOpaque(keyOutGreen(trumpGrabRaw));
  const trumpThrow = cropToOpaque(keyOutGreen(trumpThrowRaw));
  const trumpWig = cropToOpaque(keyOutGreen(trumpWigRaw));

  assets.playerFighter = player;
  assets.opponentFighter = opponent;
  assets.opponentPunch = punch;
  assets.playerKick = kick;
  assets.trump = {
    idle: trumpIdle,
    grab: trumpGrab,
    throwPose: trumpThrow,
    wig: trumpWig,
  };
  // Normalize all coin frames into one square. The edge plate is drawn much
  // thicker than the face rim, so squash its width to match face diameter.
  const coins = normalizeCoinFrames(
    keyOutGreen(coinHeadsRaw),
    keyOutGreen(coinTailsRaw),
    keyOutGreen(coinMiddleRaw),
  );
  assets.coinHeads = coins.heads;
  assets.coinTails = coins.tails;
  assets.coinMiddle = coins.middle;
  assets.coinHeadsUrl = coins.heads.toDataURL('image/png');
  assets.coinTailsUrl = coins.tails.toDataURL('image/png');
  assets.coinMiddleUrl = coins.middle.toDataURL('image/png');
  assets.stageBackground = stageBackground;
  assets.hudOverlay = hudRaw;
  assets.loaded = true;

  startStageVideo();
}

/**
 * Data-URL portrait for the character-select cards (keyed idle).
 * @param {'rookie' | 'trump'} id
 * @returns {string}
 */
export function portraitDataUrl(id) {
  const canvas =
    id === 'trump' ? assets.trump?.idle : /** @type {HTMLCanvasElement | null} */ (assets.playerFighter);
  if (!canvas || typeof canvas.toDataURL !== 'function') return '';
  return canvas.toDataURL('image/png');
}

/** @param {string} src @returns {Promise<HTMLImageElement>} */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load: ${src}`));
    img.src = src;
  });
}

/**
 * Looping muted stage plate (autoplay-friendly).
 * @param {string} src
 * @param {{ loop?: boolean, muted?: boolean }} [opts]
 * @returns {Promise<HTMLVideoElement>}
 */
function loadVideo(src, opts = {}) {
  const loop = opts.loop !== false;
  const muted = opts.muted !== false;
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = muted;
    video.defaultMuted = muted;
    video.loop = loop;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.preload = 'auto';
    // Absolute-ish path from site root so moves into the DOM still resolve
    video.src = new URL(src, window.location.href).href;

    let settled = false;
    const ok = () => {
      if (settled) return;
      settled = true;
      resolve(video);
    };
    const fail = () => {
      if (settled) return;
      settled = true;
      reject(new Error(`Failed to load: ${src}`));
    };
    video.addEventListener('loadeddata', ok, { once: true });
    video.addEventListener('canplay', ok, { once: true });
    video.addEventListener('error', fail, { once: true });
    // Some browsers never fire loadeddata for large muted files if not attached —
    // fall through after a short wait if readyState already advanced
    window.setTimeout(() => {
      if (!settled && video.readyState >= 2) ok();
    }, 2500);
    video.load();
  });
}

/** Resume looping stage video after load / user gesture. */
export function startStageVideo() {
  const bg = assets.stageBackground;
  if (!(bg instanceof HTMLVideoElement)) return;
  bg.muted = true;
  const play = bg.play();
  if (play && typeof play.catch === 'function') {
    play.catch(() => {
      // Browsers may block until a click — unlocked on first bet
    });
  }
}

/**
 * Chroma-key green screen (#00FF00 and nearby greens) to transparent.
 * @param {HTMLImageElement} img
 * @returns {HTMLCanvasElement}
 */
function keyOutGreen(img) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d');
  if (!ctx) return /** @type {any} */ (img);
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    // Strong green dominates red/blue — matches the studio plate (~23,180,38)
    const isGreenScreen = g > 90 && g > r * 1.35 && g > b * 1.35 && r < 140 && b < 140;
    if (isGreenScreen) {
      px[i + 3] = 0;
    }
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

/**
 * Crop transparent padding so sprite feet land on the floor anchor.
 * @param {HTMLCanvasElement} src
 * @param {number} [pad=2]
 * @returns {HTMLCanvasElement}
 */
function cropToOpaque(src, pad = 2) {
  const ctx = src.getContext('2d');
  if (!ctx) return src;
  const { width: w, height: h } = src;
  const data = ctx.getImageData(0, 0, w, h).data;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return src;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad);
  maxY = Math.min(h - 1, maxY + pad);
  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const out = document.createElement('canvas');
  out.width = cw;
  out.height = ch;
  const octx = out.getContext('2d');
  if (!octx) return src;
  octx.drawImage(src, minX, minY, cw, ch, 0, 0, cw, ch);
  return out;
}

/**
 * Opaque pixel bounds (alpha > 8).
 * @param {HTMLCanvasElement} src
 * @returns {{ minX: number, minY: number, maxX: number, maxY: number, w: number, h: number } | null}
 */
function opaqueBounds(src) {
  const ctx = src.getContext('2d');
  if (!ctx) return null;
  const { width: w, height: h } = src;
  const data = ctx.getImageData(0, 0, w, h).data;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/**
 * Draw coin content into a shared square. Edge width is forced to a fraction
 * of the face diameter so the flip doesn't balloon on the middle frame.
 * @param {HTMLCanvasElement} heads
 * @param {HTMLCanvasElement} tails
 * @param {HTMLCanvasElement} middle
 * @returns {{ heads: HTMLCanvasElement, tails: HTMLCanvasElement, middle: HTMLCanvasElement }}
 */
function normalizeCoinFrames(heads, tails, middle) {
  const hb = opaqueBounds(heads);
  const tb = opaqueBounds(tails);
  const mb = opaqueBounds(middle);
  const faceH = Math.max(hb?.h || 0, tb?.h || 0) || Math.max(heads.height, tails.height);
  const faceW = Math.max(hb?.w || 0, tb?.w || 0) || faceH;
  // Readable edge ≈ face rim (~10%) with a little extra so pixel art stays clear
  const edgeW = Math.max(8, Math.round(faceH * 0.18));
  // Tight square around the face — avoid empty padding that shrinks the coin on screen
  const box = Math.max(faceW, faceH) + 8;

  /**
   * @param {HTMLCanvasElement} src
   * @param {{ minX: number, minY: number, w: number, h: number } | null} bounds
   * @param {number} destW
   * @param {number} destH
   */
  const place = (src, bounds, destW, destH) => {
    const out = document.createElement('canvas');
    out.width = box;
    out.height = box;
    const ctx = out.getContext('2d');
    if (!ctx) return src;
    if (!bounds) {
      ctx.drawImage(src, (box - src.width) / 2, (box - src.height) / 2);
      return out;
    }
    const dx = (box - destW) / 2;
    const dy = (box - destH) / 2;
    ctx.drawImage(
      src,
      bounds.minX,
      bounds.minY,
      bounds.w,
      bounds.h,
      dx,
      dy,
      destW,
      destH,
    );
    return out;
  };

  return {
    heads: place(heads, hb, faceW, faceH),
    tails: place(tails, tb, faceW, faceH),
    middle: place(middle, mb, edgeW, faceH),
  };
}

/**
 * Horizontally flip a canvas / image for left-facing plates.
 * @param {HTMLImageElement | HTMLCanvasElement} img
 * @returns {HTMLCanvasElement}
 */
function flipHorizontal(img) {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d');
  if (!ctx) return /** @type {any} */ (img);
  ctx.translate(c.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(img, 0, 0);
  return c;
}

/**
 * Convert near-white studio backdrop to transparent.
 * @param {HTMLImageElement} img
 * @param {number} threshold
 * @returns {HTMLCanvasElement}
 */
function keyOutWhite(img, threshold = 245) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d');
  if (!ctx) return /** @type {any} */ (img);
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i] >= threshold && px[i + 1] >= threshold && px[i + 2] >= threshold) {
      px[i + 3] = 0;
    }
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

/**
 * Convert near-black pixels to transparent (for studio-black sprite plates).
 * @param {HTMLImageElement} img
 * @param {number} threshold
 * @returns {HTMLCanvasElement}
 */
function keyOutBlack(img, threshold = 24) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d');
  if (!ctx) return /** @type {any} */ (img);
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    if (
      px[i + 3] > 16 &&
      px[i] <= threshold &&
      px[i + 1] <= threshold &&
      px[i + 2] <= threshold
    ) {
      px[i + 3] = 0;
    }
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

/**
 * Build animation defs for the player fighter.
 * @param {HTMLImageElement | HTMLCanvasElement} image
 * @param {HTMLImageElement | HTMLCanvasElement | null} [kickImage]
 * @returns {Record<string, AnimationDef>}
 */
export function createPlayerAnimations(image, kickImage = null) {
  const frameW = image.width;
  const frameH = image.height;
  const kick = kickImage || image;

  return {
    idle: {
      image,
      frameW,
      frameH,
      frameDuration: 1000 / TIMING.IDLE_FPS,
      loop: true,
      procedural: true,
      proceduralFrames: IDLE_PROCEDURAL,
    },
    attack: {
      image: kick,
      frameW: kick.width,
      frameH: kick.height,
      frameDuration: TIMING.ATTACK_DURATION / KICK_PROCEDURAL.length,
      loop: false,
      procedural: true,
      proceduralFrames: KICK_PROCEDURAL,
    },
    hit: {
      image,
      frameW,
      frameH,
      frameDuration: TIMING.HIT_DURATION / HIT_PROCEDURAL.length,
      loop: false,
      procedural: true,
      proceduralFrames: HIT_PROCEDURAL,
    },
    special: {
      image,
      frameW,
      frameH,
      frameDuration: TIMING.SPECIAL_DURATION / SPECIAL_PROCEDURAL.length,
      loop: false,
      procedural: true,
      proceduralFrames: SPECIAL_PROCEDURAL,
    },
  };
}

/**
 * Trump 1P — idle + grab / throw poses for the wig special.
 * @returns {Record<string, AnimationDef>}
 */
export function createTrumpAnimations() {
  const kit = assets.trump;
  if (!kit) throw new Error('Trump assets not loaded');
  const { idle, grab, throwPose } = kit;
  const frameW = idle.width;
  const frameH = idle.height;

  return {
    idle: {
      image: idle,
      frameW,
      frameH,
      frameDuration: 1000 / TIMING.IDLE_FPS,
      loop: true,
      procedural: true,
      proceduralFrames: IDLE_PROCEDURAL,
    },
    attackGrab: {
      image: grab,
      frameW: grab.width,
      frameH: grab.height,
      frameDuration: TIMING.WIG_GRAB,
      loop: false,
      procedural: true,
      proceduralFrames: [{ offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1, rotation: 0 }],
    },
    attackThrow: {
      image: throwPose,
      frameW: throwPose.width,
      frameH: throwPose.height,
      frameDuration: TIMING.WIG_THROW + TIMING.WIG_FLIGHT,
      loop: false,
      procedural: true,
      proceduralFrames: [
        { offsetX: 4, offsetY: -2, scaleX: 1.02, scaleY: 0.98, rotation: 0.02 },
        { offsetX: 8, offsetY: -4, scaleX: 1.04, scaleY: 0.96, rotation: 0.04 },
      ],
    },
    // Unused by Trump win path — keep so hit/special share idle plate
    attack: {
      image: grab,
      frameW: grab.width,
      frameH: grab.height,
      frameDuration: TIMING.ATTACK_DURATION / KICK_PROCEDURAL.length,
      loop: false,
      procedural: true,
      proceduralFrames: KICK_PROCEDURAL,
    },
    hit: {
      image: idle,
      frameW,
      frameH,
      frameDuration: TIMING.HIT_DURATION / HIT_PROCEDURAL.length,
      loop: false,
      procedural: true,
      proceduralFrames: HIT_PROCEDURAL,
    },
    special: {
      image: idle,
      frameW,
      frameH,
      frameDuration: TIMING.SPECIAL_DURATION / SPECIAL_PROCEDURAL.length,
      loop: false,
      procedural: true,
      proceduralFrames: SPECIAL_PROCEDURAL,
    },
  };
}

/**
 * @param {'rookie' | 'trump'} characterId
 * @returns {Record<string, AnimationDef>}
 */
export function createAnimationsForCharacter(characterId) {
  if (characterId === 'trump') return createTrumpAnimations();
  if (!assets.playerFighter) throw new Error('Rookie assets not loaded');
  return createPlayerAnimations(assets.playerFighter, assets.playerKick);
}

/**
 * Opponent idle / hit + punch-pose attack (mirrors 1P kick setup).
 * @param {HTMLImageElement | HTMLCanvasElement} image
 * @param {HTMLImageElement | HTMLCanvasElement | null} [punchImage]
 * @returns {Record<string, AnimationDef>}
 */
export function createOpponentAnimations(image, punchImage = null) {
  const frameW = image.width;
  const frameH = image.height;
  const punch = punchImage || image;

  return {
    idle: {
      image,
      frameW,
      frameH,
      frameDuration: 1000 / TIMING.IDLE_FPS,
      loop: true,
      procedural: true,
      proceduralFrames: IDLE_PROCEDURAL,
    },
    attack: {
      image: punch,
      frameW: punch.width,
      frameH: punch.height,
      frameDuration: TIMING.ATTACK_DURATION / KICK_PROCEDURAL.length,
      loop: false,
      procedural: true,
      proceduralFrames: KICK_PROCEDURAL,
    },
    hit: {
      image,
      frameW,
      frameH,
      frameDuration: TIMING.HIT_DURATION / HIT_PROCEDURAL.length,
      loop: false,
      procedural: true,
      proceduralFrames: HIT_PROCEDURAL,
    },
    special: {
      image,
      frameW,
      frameH,
      frameDuration: TIMING.SPECIAL_DURATION / SPECIAL_PROCEDURAL.length,
      loop: false,
      procedural: true,
      proceduralFrames: SPECIAL_PROCEDURAL,
    },
  };
}

/**
 * Example sprite-sheet idle — uncomment and fill in when you have a sheet:
 *
 * idle: {
 *   sheet: image,
 *   frameW: 256,
 *   frameH: 400,
 *   frameDuration: 80,
 *   loop: true,
 *   frames: [
 *     { x: 0, y: 0 }, { x: 256, y: 0 }, ...
 *   ],
 * },
 */
