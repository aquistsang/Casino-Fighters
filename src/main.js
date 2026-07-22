/**
 * Coin Fighters — entry point
 */

import { Game } from './game.js';
import { startStageVideo } from './assets.js';
import { startFightMusic, unlockAudio } from './audio.js';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('gameCanvas'));
const btnHi = /** @type {HTMLButtonElement} */ (document.getElementById('btnHi'));
const btnLo = /** @type {HTMLButtonElement} */ (document.getElementById('btnLo'));
const btnRestart = /** @type {HTMLButtonElement} */ (document.getElementById('btnRestart'));
const btnCashOut = /** @type {HTMLButtonElement} */ (document.getElementById('btnCashOut'));
const overlay = /** @type {HTMLElement} */ (document.getElementById('gameOverlay'));
const overlayTitle = /** @type {HTMLElement} */ (document.getElementById('overlayTitle'));
const overlaySub = /** @type {HTMLElement} */ (document.getElementById('overlaySub'));
const victoryOverlay = /** @type {HTMLElement} */ (document.getElementById('victoryOverlay'));
const victoryVideoEl = /** @type {HTMLVideoElement} */ (document.getElementById('victoryVideo'));
const victoryPrezzVideoEl = /** @type {HTMLVideoElement} */ (document.getElementById('victoryPrezzVideo'));
const defeatVideoEl = /** @type {HTMLVideoElement} */ (document.getElementById('defeatVideo'));
const defeatPrezzVideoEl = /** @type {HTMLVideoElement} */ (document.getElementById('defeatPrezzVideo'));
const streakEl = /** @type {HTMLElement} */ (document.getElementById('streakValue'));
const roundHistoryEl = /** @type {HTMLElement} */ (document.getElementById('roundHistory'));
const balanceEl = /** @type {HTMLElement} */ (document.getElementById('balanceValue'));
const betInput = /** @type {HTMLInputElement} */ (document.getElementById('betInput'));
const winValueEl = /** @type {HTMLElement} */ (document.getElementById('winValue'));
const btnBetHalf = /** @type {HTMLButtonElement} */ (document.getElementById('btnBetHalf'));
const btnBetDouble = /** @type {HTMLButtonElement} */ (document.getElementById('btnBetDouble'));
const btnBetMax = /** @type {HTMLButtonElement} */ (document.getElementById('btnBetMax'));
const btnHowToPlay = /** @type {HTMLButtonElement} */ (document.getElementById('btnHowToPlay'));
const btnHowToPlayHelp = /** @type {HTMLButtonElement} */ (document.getElementById('btnHowToPlayHelp'));
const howToPlayModal = /** @type {HTMLElement} */ (document.getElementById('howToPlayModal'));
const btnCloseHowToPlay = /** @type {HTMLButtonElement} */ (document.getElementById('btnCloseHowToPlay'));
const rtpPercentEl = /** @type {HTMLElement} */ (document.getElementById('rtpPercent'));
const rtpEdgeEl = /** @type {HTMLElement} */ (document.getElementById('rtpEdge'));
const rtpHashEl = /** @type {HTMLElement} */ (document.getElementById('rtpHash'));
const rtpClientEl = /** @type {HTMLElement} */ (document.getElementById('rtpClient'));
const rtpNonceEl = /** @type {HTMLElement} */ (document.getElementById('rtpNonce'));
const rtpLastEl = /** @type {HTMLElement} */ (document.getElementById('rtpLast'));
const btnCopyHash = /** @type {HTMLButtonElement} */ (document.getElementById('btnCopyHash'));
const btnCopyClient = /** @type {HTMLButtonElement} */ (document.getElementById('btnCopyClient'));
const skipVideosToggle = /** @type {HTMLInputElement} */ (document.getElementById('skipVideosToggle'));
const btnCheat2pDamage = /** @type {HTMLButtonElement} */ (document.getElementById('btnCheat2pDamage'));
const btnCheat1pDamage = /** @type {HTMLButtonElement} */ (document.getElementById('btnCheat1pDamage'));
const btnToggleMusic = /** @type {HTMLButtonElement} */ (document.getElementById('btnToggleMusic'));
const btnToggleSfx = /** @type {HTMLButtonElement} */ (document.getElementById('btnToggleSfx'));
const charSelect = /** @type {HTMLElement} */ (document.getElementById('charSelect'));
const portraitRookie = /** @type {HTMLImageElement} */ (document.getElementById('portraitRookie'));
const portraitTrump = /** @type {HTMLImageElement} */ (document.getElementById('portraitTrump'));
const btnFight = /** @type {HTMLButtonElement} */ (document.getElementById('btnFight'));
const coinFlipOverlay = /** @type {HTMLElement} */ (document.getElementById('coinFlipOverlay'));
const coinFlipImg = /** @type {HTMLImageElement} */ (document.getElementById('coinFlipImg'));
const btnSkipFlip = /** @type {HTMLButtonElement} */ (document.getElementById('btnSkipFlip'));
const btnSkipFight = /** @type {HTMLButtonElement} */ (document.getElementById('btnSkipFight'));
const charCards = /** @type {HTMLElement[]} */ ([
  ...document.querySelectorAll('.char-card[data-char]'),
]);

const game = new Game(canvas, {
  btnHi,
  btnLo,
  btnRestart,
  btnCashOut,
  overlay,
  overlayTitle,
  overlaySub,
  victoryOverlay,
  victoryVideoEl,
  victoryPrezzVideoEl,
  defeatVideoEl,
  defeatPrezzVideoEl,
  streakEl,
  roundHistoryEl,
  balanceEl,
  betInput,
  winValueEl,
  btnBetHalf,
  btnBetDouble,
  btnBetMax,
  btnHowToPlay,
  btnHowToPlayHelp,
  howToPlayModal,
  btnCloseHowToPlay,
  rtpPercentEl,
  rtpEdgeEl,
  rtpHashEl,
  rtpClientEl,
  rtpNonceEl,
  rtpLastEl,
  btnCopyHash,
  btnCopyClient,
  skipVideosToggle,
  btnCheat2pDamage,
  btnCheat1pDamage,
  btnToggleMusic,
  btnToggleSfx,
  charSelect,
  charCards,
  portraitRookie,
  portraitTrump,
  btnFight,
  coinFlipOverlay,
  coinFlipImg,
  btnSkipFlip,
  btnSkipFight,
});

overlay.hidden = false;
overlayTitle.textContent = 'LOADING';
overlaySub.textContent = 'Loading fight assets…';
btnRestart.hidden = true;

game.init()
  .then(() => {
    overlay.hidden = true;
    btnRestart.hidden = false;
    startStageVideo();
    startFightMusic();
    window.addEventListener(
      'pointerdown',
      () => {
        unlockAudio();
        startStageVideo();
        startFightMusic();
      },
      { once: true }
    );
  })
  .catch((err) => {
    console.error(err);
    if (charSelect) charSelect.hidden = true;
    overlay.hidden = false;
    overlayTitle.textContent = 'LOAD ERROR';
    overlaySub.textContent = String(err.message || err);
    btnRestart.hidden = false;
  });
