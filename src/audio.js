/**
 * Lightweight SFX + background music for Hi-Lo Fighters.
 */

const MUSIC_VOL = 0.35;
const SFX_VOL = 0.85;
const RESULT_VOL = 0.9;
/** Win clip is quieter in the source file — nudge up to sit with you-lose. */
const YOU_WIN_VOL = 1;
const MUSIC_MUTE_KEY = 'hi-lo-fighters-music-muted';
const SFX_MUTE_KEY = 'hi-lo-fighters-sfx-muted';

/** @type {HTMLAudioElement | null} */
let kickSound = null;
/** @type {HTMLAudioElement | null} */
let punchSound = null;
/** @type {HTMLAudioElement | null} */
let youWinSound = null;
/** @type {HTMLAudioElement | null} */
let youLoseSound = null;
/** @type {HTMLAudioElement | null} */
let coinsCollectSound = null;
/** @type {HTMLAudioElement | null} */
let fightMusic = null;
let unlocked = false;
let musicStarted = false;
let musicMuted = loadPref(MUSIC_MUTE_KEY);
let sfxMuted = loadPref(SFX_MUTE_KEY);

/**
 * Preload combat, result, and BGM clips.
 * @returns {Promise<void>}
 */
export async function loadAudio() {
  const loadOne = (src, volume = SFX_VOL) =>
    new Promise((resolve, reject) => {
      const audio = new Audio(src);
      audio.preload = 'auto';
      audio.volume = volume;
      audio.addEventListener('canplaythrough', () => resolve(audio), { once: true });
      audio.addEventListener('error', () => reject(new Error(`Failed to load: ${src}`)), {
        once: true,
      });
      audio.load();
    });

  try {
    [kickSound, punchSound, youWinSound, youLoseSound, coinsCollectSound, fightMusic] =
      await Promise.all([
        loadOne('assets/kick-sound.mp3'),
        loadOne('assets/punch-sound.mp3'),
        loadOne('assets/you-win.mp3', YOU_WIN_VOL),
        loadOne('assets/you-lose.mp3', RESULT_VOL),
        loadOne('assets/coins-collect.mp3', RESULT_VOL),
        loadOne('assets/retro-fight-music.mp3', MUSIC_VOL),
      ]);
    if (fightMusic) {
      fightMusic.loop = true;
      applyMusicMute();
    }
  } catch (err) {
    console.warn('[Hi-Lo Fighters] Audio unavailable:', err);
    kickSound = kickSound ?? null;
    punchSound = punchSound ?? null;
    youWinSound = youWinSound ?? null;
    youLoseSound = youLoseSound ?? null;
    coinsCollectSound = coinsCollectSound ?? null;
    fightMusic = fightMusic ?? null;
  }
}

/** Unlock audio after first user gesture (browser autoplay policy). */
export function unlockAudio() {
  if (unlocked) {
    startFightMusic();
    return;
  }
  const clip = kickSound || punchSound || fightMusic || youWinSound || youLoseSound;
  if (!clip) return;
  unlocked = true;
  clip
    .play()
    .then(() => {
      if (clip !== fightMusic) {
        clip.pause();
        clip.currentTime = 0;
      }
      startFightMusic();
    })
    .catch(() => {
      unlocked = false;
    });
}

/** Start looping retro fight BGM (no-ops if already playing). */
export function startFightMusic() {
  if (!fightMusic || musicStarted) {
    if (fightMusic && musicStarted) applyMusicMute();
    return;
  }
  try {
    fightMusic.loop = true;
    applyMusicMute();
    if (musicMuted) {
      musicStarted = true;
      return;
    }
    const play = fightMusic.play();
    if (play && typeof play.then === 'function') {
      play
        .then(() => {
          musicStarted = true;
          unlocked = true;
        })
        .catch(() => {
          // Blocked until a user gesture — retry via unlockAudio / pointerdown
        });
    } else {
      musicStarted = true;
    }
  } catch {
    // no-op
  }
}

function applyMusicMute() {
  if (!fightMusic) return;
  fightMusic.volume = musicMuted ? 0 : MUSIC_VOL;
  fightMusic.muted = musicMuted;
  if (musicMuted) {
    fightMusic.pause();
  } else if (musicStarted || unlocked) {
    fightMusic.play().catch(() => {
      /* blocked until gesture */
    });
  }
}

/** @returns {boolean} */
export function isMusicMuted() {
  return musicMuted;
}

/** @returns {boolean} */
export function isSfxMuted() {
  return sfxMuted;
}

/** @param {boolean} muted */
export function setMusicMuted(muted) {
  musicMuted = !!muted;
  savePref(MUSIC_MUTE_KEY, musicMuted);
  applyMusicMute();
  return musicMuted;
}

/** @param {boolean} muted */
export function setSfxMuted(muted) {
  sfxMuted = !!muted;
  savePref(SFX_MUTE_KEY, sfxMuted);
  return sfxMuted;
}

/** Toggle BGM mute. @returns {boolean} new muted state */
export function toggleMusicMuted() {
  return setMusicMuted(!musicMuted);
}

/** Toggle SFX mute. @returns {boolean} new muted state */
export function toggleSfxMuted() {
  return setSfxMuted(!sfxMuted);
}

/** @param {HTMLAudioElement | null} sound */
function playSound(sound) {
  if (!sound || sfxMuted) return;
  try {
    sound.currentTime = 0;
    sound.play().catch(() => {
      // Ignore if browser blocks until next gesture
    });
  } catch {
    // no-op
  }
}

/** Play kick SFX when the player connects a winning kick. */
export function playKickSound() {
  playSound(kickSound);
}

/** Play punch SFX when 2P connects a losing-round punch. */
export function playPunchSound() {
  playSound(punchSound);
}

/** Play when the YOU WIN overlay appears. */
export function playYouWinSound() {
  playSound(youWinSound);
}

/** Play when the YOU LOSE overlay / banner appears. */
export function playYouLoseSound() {
  playSound(youLoseSound);
}

/** Play when the player cashes out a climb. */
export function playCoinsCollectSound() {
  playSound(coinsCollectSound);
}

/** @param {string} key */
function loadPref(key) {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

/** @param {string} key @param {boolean} value */
function savePref(key, value) {
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    /* ignore */
  }
}
