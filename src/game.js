/**
 * Hi-Lo Fighters — core game loop & Hi/Lo resolution.
 *
 * Flow: BETTING → (HI or LO) → RESOLVING (animations) → BETTING | GAME_OVER
 */

import { GAME_PHASE, HEALTH, MULTIPLIER, STAGE, TIMING, WALLET } from './constants.js';
import { Fighter } from './fighter.js';
import { EffectsSystem } from './effects.js';
import { InputHandler } from './input.js';
import { Renderer } from './render.js';
import {
  assets,
  loadAssets,
  createPlayerAnimations,
  createOpponentAnimations,
  startStageVideo,
} from './assets.js';
import {
  loadAudio,
  playKickSound,
  playPunchSound,
  playYouWinSound,
  playYouLoseSound,
  playCoinsCollectSound,
  unlockAudio,
  isMusicMuted,
  isSfxMuted,
  toggleMusicMuted,
  toggleSfxMuted,
} from './audio.js';
import { Fairness } from './fairness.js';

const ROUND_HISTORY_MAX = 16;
const SKIP_VIDEOS_KEY = 'hi-lo-fighters-skip-videos';

export class Game {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{
   *   btnHi: HTMLButtonElement,
   *   btnLo: HTMLButtonElement,
   *   btnRestart: HTMLButtonElement,
   *   overlay: HTMLElement,
   *   overlayTitle: HTMLElement,
   *   overlaySub: HTMLElement,
   *   streakEl: HTMLElement,
   *   roundHistoryEl?: HTMLElement,
   *   rtpPercentEl?: HTMLElement,
   *   rtpHashEl?: HTMLElement,
   *   rtpClientEl?: HTMLElement,
   *   rtpNonceEl?: HTMLElement,
   *   rtpLastEl?: HTMLElement,
   *   victoryOverlay?: HTMLElement,
   *   victoryVideoEl?: HTMLVideoElement,
   *   defeatVideoEl?: HTMLVideoElement,
   *   balanceEl?: HTMLElement,
   *   betInput?: HTMLInputElement,
   *   winValueEl?: HTMLElement,
   *   btnCashOut?: HTMLButtonElement,
   *   btnBetHalf?: HTMLButtonElement,
   *   btnBetDouble?: HTMLButtonElement,
   *   btnBetMax?: HTMLButtonElement,
   *   btnHowToPlay?: HTMLButtonElement,
   *   btnHowToPlayHelp?: HTMLButtonElement,
   *   howToPlayModal?: HTMLElement,
   *   btnCloseHowToPlay?: HTMLButtonElement,
   *   btnCopyHash?: HTMLButtonElement,
   *   btnCopyClient?: HTMLButtonElement,
   *   skipVideosToggle?: HTMLInputElement,
   *   btnCheat2pDamage?: HTMLButtonElement,
   *   btnToggleMusic?: HTMLButtonElement,
   *   btnToggleSfx?: HTMLButtonElement,
   * }} ui
   */
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.ui = ui;
    this.renderer = new Renderer(canvas);
    this.effects = new EffectsSystem();
    this.fairness = new Fairness();
    this.phase = GAME_PHASE.BETTING;
    this.streak = 0;
    this.round = 1;
    this.multiplier = MULTIPLIER.START;
    this.balance = WALLET.START_BALANCE;
    this.bet = WALLET.DEFAULT_BET;
    /** Stake locked for the current climb (0 when idle). */
    this.activeStake = 0;
    this.skipVideos = this._loadSkipVideosPref();
    /** @type {Array<{ value: number, won: boolean }>} */
    this.multiplierHistory = [];
    /** @type {Array<'W' | 'L'>} */
    this.roundHistory = [];
    this.lastTime = 0;
    this.running = false;
    this._opponentDepleted = false;
    /** Hide stage / fighters / HUD while winner video plays */
    this.cutsceneActive = false;
    /** @type {'none' | 'roundClear' | 'gameOver'} */
    this.overlayMode = 'none';

    // Feet planted on the stone floor tiles
    this.player = new Fighter({
      name: 'YOU',
      x: STAGE.PLAYER_X,
      y: STAGE.FLOOR_Y,
      facing: 1,
      drawScale: STAGE.FIGHTER_SCALE,
      isPlayer: true,
    });

    this.opponent = new Fighter({
      name: 'CPU',
      x: STAGE.OPPONENT_X,
      y: STAGE.FLOOR_Y,
      facing: -1,
      drawScale: STAGE.OPPONENT_SCALE,
      isPlayer: false,
    });

    this.input = new InputHandler({
      onHi: () => this.placeBet('HI'),
      onLo: () => this.placeBet('LO'),
      onRestart: () => this._onOverlayPrimary(),
    });
    this.input.bindUI(ui);
    this._bindWalletUi();
    this._bindRulesAndFairnessUi();
    this._bindSkipVideosUi();
    this._bindCheatUi();
    this._bindAudioTogglesUi();

    window.addEventListener('resize', () => this.renderer.resize());
  }

  async init() {
    await Promise.all([loadAssets(), loadAudio(), this.fairness.initSession()]);
    if (!assets.playerFighter || !assets.opponentFighter) {
      throw new Error('Fighter sprites failed to load');
    }
    this.player.registerAnimations(
      createPlayerAnimations(assets.playerFighter, assets.playerKick)
    );
    this.opponent.registerAnimations(
      createOpponentAnimations(assets.opponentFighter, assets.opponentPunch)
    );
    // SOUND: start ambient / idle music loop here
    this._syncHud();
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this._frame(t));
  }

  /** @param {number} time */
  _frame(time) {
    if (!this.running) return;
    const dt = Math.min(50, time - this.lastTime);
    this.lastTime = time;

    this.player.update(dt);
    this.opponent.update(dt);
    this.effects.update(dt);

    this.renderer.draw({
      player: this.player,
      opponent: this.opponent,
      effects: this.effects,
      streak: this.streak,
      round: this.round,
      multiplier: this.multiplier,
      multiplierHistory: this.multiplierHistory,
      cutsceneActive: this.cutsceneActive,
    });

    requestAnimationFrame((t) => this._frame(t));
  }

  /**
   * @param {'HI' | 'LO'} choice
   */
  async placeBet(choice) {
    if (this.phase !== GAME_PHASE.BETTING) return;
    if (this.player.isBusy || this.opponent.isBusy) return;
    if (this.cutsceneActive) return;

    // Lock stake from balance on the first flip of a climb
    if (this.activeStake <= 0) {
      const amount = this._clampBet(this._readBetInput());
      if (amount > this.balance || amount < WALLET.MIN_BET) {
        this._syncWalletUi();
        return;
      }
      this.bet = amount;
      this.balance -= amount;
      this.activeStake = amount;
      this._syncWalletUi();
    }

    unlockAudio();
    startStageVideo();
    this.phase = GAME_PHASE.RESOLVING;
    this.input.setEnabled(false);
    this._setButtonsDisabled(true);

    const { cardIsHigh } = await this.fairness.nextCard();
    const playerWon =
      (choice === 'HI' && cardIsHigh) || (choice === 'LO' && !cardIsHigh);

    this._lastCard = cardIsHigh ? 'HI' : 'LO';
    this._syncRtpUi();

    setTimeout(() => {
      if (playerWon) {
        this._resolveWin(choice);
      } else {
        this._resolveLoss();
      }
    }, TIMING.RESOLVE_DELAY);
  }

  /** Bank bet × multiplier and reset the climb. */
  cashOut() {
    if (this.phase !== GAME_PHASE.BETTING) return;
    if (this.multiplier <= MULTIPLIER.START || this.activeStake <= 0) return;

    const payout = this.activeStake * this.multiplier;
    this.balance += payout;
    this.activeStake = 0;
    this.multiplier = MULTIPLIER.START;
    this.effects.multiplierTint.active = false;
    playCoinsCollectSound();
    this._syncHud();
  }

  /**
   * @param {'HI' | 'LO'} choice
   */
  _resolveWin(choice) {
    this._pushRoundHistory('W');
    this.streak += 1;

    this.multiplier = Math.max(
      MULTIPLIER.START,
      Math.round(this.multiplier * MULTIPLIER.WIN_FACTOR * 100) / 100
    );
    this._pushMultiplierHistory(this.multiplier, true);
    this.effects.spawnMultiplierPopup(this.multiplier, true, {
      x: MULTIPLIER.POPUP_X,
      y: MULTIPLIER.POPUP_Y,
    });
    this._syncHud();

    this.player.playKickAttack(this.opponent.x, {
      onImpact: () => {
        playKickSound();
        this.opponent.takeDamage(HEALTH.WIN_COST);
        this.opponent.playHitReaction();

        this.effects.spawnSparks(this.opponent.x - 40, this.opponent.y - 180, 18);
        this.effects.spawnDamageNumber(
          this.opponent.x,
          this.opponent.y - 220,
          HEALTH.WIN_COST,
          'dealt'
        );
        this.effects.triggerFlash(0.45, 110);
        this.effects.triggerShake(8, 180);
      },
      onComplete: () => this._afterResolve(),
    });
  }

  _resolveLoss() {
    this._pushRoundHistory('L');
    this.streak = 0;
    if (this.multiplier > MULTIPLIER.START) {
      this.effects.triggerMultiplierBustFlash(500);
    }
    // Stake already deducted on lock — bust clears the climb
    this.activeStake = 0;
    this.multiplier = MULTIPLIER.START;
    this._syncHud();

    this.opponent.playPunchAttack(this.player.x, {
      onImpact: () => {
        playPunchSound();
        this.player.takeDamage(HEALTH.WIN_COST);
        this.player.playHitReaction();

        this.effects.spawnSparks(this.player.x + 40, this.player.y - 160, 14);
        this.effects.spawnDamageNumber(
          this.player.x,
          this.player.y - 200,
          HEALTH.WIN_COST,
          'received'
        );
        this.effects.triggerFlash(0.35, 90);
        this.effects.triggerShake(7, 180);
      },
      onComplete: () => this._afterResolve(),
    });
  }

  _afterResolve() {
    if (this.player.health <= 0) {
      this.onPlayerBoxesDepleted();
      return;
    }

    // Opponent boxes empty → win cutscene
    if (this.opponent.health <= 0) {
      if (!this._opponentDepleted) {
        this._opponentDepleted = true;
        this.onOpponentBoxesDepleted();
      } else {
        this.round += 1;
        this._returnToBetting();
      }
      return;
    }

    this.round += 1;
    this._returnToBetting();
  }

  /**
   * Called when the player's 5 yellow boxes are all gone (2P wins).
   * Banner → defeat video → lose screen.
   */
  onPlayerBoxesDepleted() {
    this.input.setEnabled(false);
    this._setButtonsDisabled(true);
    this.phase = GAME_PHASE.RESOLVING;

    const bannerMs = 1800;
    this.effects.showSpecialBanner(bannerMs, 'YOU LOSE');
    playYouLoseSound();
    this.effects.triggerFlash(0.6, 220);
    this.effects.triggerShake(10, 280);

    window.setTimeout(() => {
      this._playCutscene(this.ui.defeatVideoEl, () => this._endMatch(false));
    }, bannerMs);
  }

  /**
   * Called when the opponent's 5 yellow boxes are all gone.
   * Banner → victory video → round-clear (KEEP FIGHTING).
   */
  onOpponentBoxesDepleted() {
    this.input.setEnabled(false);
    this._setButtonsDisabled(true);
    this.phase = GAME_PHASE.RESOLVING;

    const bannerMs = 1800;
    const videoDelayMs = bannerMs + 1000; // 1s pause after YOU WIN before victory video
    this.effects.showSpecialBanner(bannerMs, 'YOU WIN');
    playYouWinSound();
    this.effects.triggerFlash(0.6, 220);
    this.effects.triggerShake(10, 280);

    window.setTimeout(() => {
      this._playCutscene(this.ui.victoryVideoEl, () => this._showRoundClear());
    }, videoDelayMs);
  }

  /**
   * Full-bleed cutscene (hides stage / fighters / HUD).
   * @param {HTMLVideoElement | undefined} video
   * @param {() => void} onDone
   */
  _playCutscene(video, onDone) {
    if (this.skipVideos) {
      this.effects.specialBanner.active = false;
      onDone();
      return;
    }

    const overlay = this.ui.victoryOverlay;

    if (!overlay || !(video instanceof HTMLVideoElement)) {
      onDone();
      return;
    }

    // Only one clip visible in the shared overlay
    if (this.ui.victoryVideoEl) this.ui.victoryVideoEl.hidden = true;
    if (this.ui.defeatVideoEl) this.ui.defeatVideoEl.hidden = true;
    video.hidden = false;

    this._setCutsceneActive(true);
    this.effects.specialBanner.active = false;
    this.effects.sparks = [];
    this.effects.floatTexts = [];
    this.effects.multiplierPopups = [];
    this.effects.flashes = [];

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      video.pause();
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('error', onFailed);
      video.removeEventListener('playing', onPlaying);
      video.hidden = true;
      overlay.hidden = true;
      overlay.setAttribute('aria-hidden', 'true');
      this._setCutsceneActive(false);
      startStageVideo();
      onDone();
    };

    const onEnded = () => finish();
    const onFailed = () => finish();
    const onPlaying = () => {
      try {
        video.muted = false;
      } catch {
        /* keep muted */
      }
    };

    if (assets.stageBackground instanceof HTMLVideoElement) {
      assets.stageBackground.pause();
    }

    overlay.hidden = false;
    overlay.setAttribute('aria-hidden', 'false');
    video.loop = false;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.muted = true;
    video.defaultMuted = true;

    video.addEventListener('ended', onEnded);
    video.addEventListener('error', onFailed);
    video.addEventListener('playing', onPlaying, { once: true });

    const start = () => {
      try {
        video.currentTime = 0;
      } catch {
        /* ignore seek races */
      }
      const p = video.play();
      if (p && typeof p.then === 'function') {
        p.catch(() => {
          video.muted = true;
          video.play().catch(() => finish());
        });
      }
    };

    if (video.readyState >= 1) {
      start();
    } else {
      video.addEventListener('loadedmetadata', start, { once: true });
      video.load();
      window.setTimeout(() => {
        if (!finished && video.paused) start();
      }, 1500);
    }
  }

  /** @param {boolean} active */
  _setCutsceneActive(active) {
    this.cutsceneActive = active;
    const wrap = this.canvas.parentElement;
    if (wrap) wrap.classList.toggle('is-cutscene', active);
  }

  /** Overlay primary button / R key — continue round or full restart. */
  _onOverlayPrimary() {
    if (this.overlayMode === 'roundClear') {
      this._continueFight();
      return;
    }
    this.restart();
  }

  /** After beating 2P — climb/streak stay live; invite KEEP FIGHTING. */
  _showRoundClear() {
    this.phase = GAME_PHASE.GAME_OVER;
    this.overlayMode = 'roundClear';
    this.input.setEnabled(false);
    this._setButtonsDisabled(true);

    this.ui.overlay.hidden = false;
    this.ui.overlay.classList.add('win');
    this.ui.overlay.classList.remove('lose');
    this.ui.overlayTitle.textContent = 'YOU WIN!';
    this.ui.overlaySub.textContent =
      "Don't worry — your streak is still in play. Keep fighting to climb higher or cash out.";
    if (this.ui.btnRestart) {
      this.ui.btnRestart.hidden = false;
      this.ui.btnRestart.textContent = 'KEEP FIGHTING';
    }
  }

  /** Refill both life bars and resume betting with climb intact. */
  _continueFight() {
    this.player.health = HEALTH.MAX_BOXES;
    this.opponent.health = HEALTH.MAX_BOXES;
    this._opponentDepleted = false;
    this.overlayMode = 'none';
    this.round += 1;

    this.ui.overlay.hidden = true;
    this.ui.overlay.classList.remove('win', 'lose');
    if (this.ui.btnRestart) {
      this.ui.btnRestart.textContent = 'RESTART';
    }

    this._returnToBetting();
  }

  /** @param {boolean} playerWon */
  _endMatch(playerWon) {
    this.phase = GAME_PHASE.GAME_OVER;
    this.overlayMode = 'gameOver';
    this.input.setEnabled(false);
    this._setButtonsDisabled(true);

    this.ui.overlay.hidden = false;
    this.ui.overlay.classList.toggle('win', playerWon);
    this.ui.overlay.classList.toggle('lose', !playerWon);
    this.ui.overlayTitle.textContent = playerWon ? 'YOU WIN!' : 'YOU LOSE';
    this.ui.overlaySub.textContent = playerWon
      ? 'Opponent KO — Hi-Lo Fighters champion!'
      : 'Your HP hit zero. Press Restart to fight again.';
    if (this.ui.btnRestart) {
      this.ui.btnRestart.hidden = false;
      this.ui.btnRestart.textContent = 'RESTART';
    }
  }

  _returnToBetting() {
    // Ensure fighters aren't stuck busy if an anim edged a race
    if (this.player.state !== 'IDLE' && !this.player.motion) this.player.setIdle();
    if (this.opponent.state !== 'IDLE' && !this.opponent.motion) this.opponent.setIdle();

    this.phase = GAME_PHASE.BETTING;
    this.input.setEnabled(true);
    this._setButtonsDisabled(false);
    this._syncWalletUi();
  }

  restart() {
    this.player.reset();
    this.opponent.reset();
    this.streak = 0;
    this.round = 1;
    this.multiplier = MULTIPLIER.START;
    this.balance = WALLET.START_BALANCE;
    this.bet = WALLET.DEFAULT_BET;
    this.activeStake = 0;
    this.multiplierHistory = [];
    this.roundHistory = [];
    this._opponentDepleted = false;
    this.overlayMode = 'none';
    this.phase = GAME_PHASE.BETTING;
    this._setCutsceneActive(false);
    this.effects.sparks = [];
    this.effects.floatTexts = [];
    this.effects.multiplierPopups = [];
    this.effects.flashes = [];
    this.effects.specialBanner.active = false;
    this.effects.multiplierTint.active = false;
    if (this.ui.victoryOverlay) {
      this.ui.victoryOverlay.hidden = true;
      this.ui.victoryOverlay.setAttribute('aria-hidden', 'true');
    }
    if (this.ui.victoryVideoEl instanceof HTMLVideoElement) {
      this.ui.victoryVideoEl.pause();
      this.ui.victoryVideoEl.hidden = true;
    }
    if (this.ui.defeatVideoEl instanceof HTMLVideoElement) {
      this.ui.defeatVideoEl.pause();
      this.ui.defeatVideoEl.hidden = true;
    }
    this.ui.overlay.hidden = true;
    this.ui.overlay.classList.remove('win', 'lose');
    if (this.ui.btnRestart) {
      this.ui.btnRestart.textContent = 'RESTART';
    }
    this.fairness.initSession().then(() => this._syncHud());
    this._syncHud();
    this._returnToBetting();
  }

  /**
   * @param {number} value
   * @param {boolean} won
   */
  _pushMultiplierHistory(value, won) {
    this.multiplierHistory.unshift({ value, won });
    if (this.multiplierHistory.length > MULTIPLIER.HISTORY_MAX) {
      this.multiplierHistory.length = MULTIPLIER.HISTORY_MAX;
    }
  }

  /** @param {'W' | 'L'} result */
  _pushRoundHistory(result) {
    this.roundHistory.push(result);
    if (this.roundHistory.length > ROUND_HISTORY_MAX) {
      this.roundHistory.shift();
    }
  }

  _syncHud() {
    if (this.ui.streakEl) {
      this.ui.streakEl.textContent = String(this.streak);
    }
    this._syncRoundHistoryUi();
    this._syncRtpUi();
    this._syncWalletUi();
  }

  _syncRoundHistoryUi() {
    const el = this.ui.roundHistoryEl;
    if (!el) return;
    el.innerHTML = '';
    for (const result of this.roundHistory) {
      const chip = document.createElement('span');
      chip.className = `round-chip ${result === 'W' ? 'win' : 'lose'}`;
      chip.textContent = result;
      el.appendChild(chip);
    }
  }

  _syncRtpUi() {
    const f = this.fairness;
    if (this.ui.rtpPercentEl) this.ui.rtpPercentEl.textContent = `${f.rtpPercent}%`;
    if (this.ui.rtpHashEl) this.ui.rtpHashEl.textContent = f.shortHash();
    if (this.ui.rtpClientEl) this.ui.rtpClientEl.textContent = f.shortClient();
    if (this.ui.rtpNonceEl) this.ui.rtpNonceEl.textContent = String(f.nonce);
    if (this.ui.rtpLastEl) {
      this.ui.rtpLastEl.textContent =
        f.lastRoll == null
          ? '—'
          : `${f.lastRoll.toFixed(4)} → ${f.lastOutcome}`;
    }
  }

  _syncWalletUi() {
    if (this.ui.balanceEl) {
      this.ui.balanceEl.textContent = this._fmtMoney(this.balance);
    }
    if (this.ui.betInput && document.activeElement !== this.ui.betInput) {
      this.ui.betInput.value = String(this._clampBet(this.bet));
    }
    const stake = this.activeStake > 0 ? this.activeStake : this._clampBet(this._readBetInput());
    const mult = Math.max(MULTIPLIER.START, this.multiplier);
    if (this.ui.winValueEl) {
      this.ui.winValueEl.textContent = this._fmtMoney(stake * mult);
    }
    const climbing = this.multiplier > MULTIPLIER.START && this.activeStake > 0;
    const canCash =
      this.phase === GAME_PHASE.BETTING && climbing && !this.cutsceneActive;
    if (this.ui.btnCashOut) this.ui.btnCashOut.disabled = !canCash;

    const betLocked =
      this.activeStake > 0 ||
      this.phase !== GAME_PHASE.BETTING ||
      this.cutsceneActive;
    if (this.ui.betInput) this.ui.betInput.disabled = betLocked;
    if (this.ui.btnBetHalf) this.ui.btnBetHalf.disabled = betLocked;
    if (this.ui.btnBetDouble) this.ui.btnBetDouble.disabled = betLocked;
    if (this.ui.btnBetMax) this.ui.btnBetMax.disabled = betLocked;
  }

  /** @param {boolean} disabled */
  _setButtonsDisabled(disabled) {
    this.ui.btnHi.disabled = disabled;
    this.ui.btnLo.disabled = disabled;
    this._syncWalletUi();
  }

  _bindWalletUi() {
    const input = this.ui.betInput;
    if (input) {
      input.min = String(WALLET.MIN_BET);
      input.max = String(WALLET.MAX_BET);
      input.value = String(this.bet);
      input.addEventListener('change', () => {
        this.bet = this._clampBet(this._readBetInput());
        this._syncWalletUi();
      });
      input.addEventListener('input', () => this._syncWalletUi());
    }
    this.ui.btnCashOut?.addEventListener('click', () => this.cashOut());
    this.ui.btnBetHalf?.addEventListener('click', () => {
      this.bet = this._clampBet(Math.floor(this._readBetInput() / 2));
      this._syncWalletUi();
    });
    this.ui.btnBetDouble?.addEventListener('click', () => {
      this.bet = this._clampBet(this._readBetInput() * 2);
      this._syncWalletUi();
    });
    this.ui.btnBetMax?.addEventListener('click', () => {
      this.bet = this._clampBet(Math.min(WALLET.MAX_BET, this.balance));
      this._syncWalletUi();
    });
  }

  _bindRulesAndFairnessUi() {
    const open = () => {
      if (this.ui.howToPlayModal) this.ui.howToPlayModal.hidden = false;
    };
    const close = () => {
      if (this.ui.howToPlayModal) this.ui.howToPlayModal.hidden = true;
    };
    this.ui.btnHowToPlay?.addEventListener('click', open);
    this.ui.btnHowToPlayHelp?.addEventListener('click', open);
    this.ui.btnCloseHowToPlay?.addEventListener('click', close);
    this.ui.howToPlayModal?.addEventListener('click', (e) => {
      if (e.target === this.ui.howToPlayModal) close();
    });

    this.ui.btnCopyHash?.addEventListener('click', () =>
      this._copyText(this.fairness.serverSeedHash, this.ui.btnCopyHash)
    );
    this.ui.btnCopyClient?.addEventListener('click', () =>
      this._copyText(this.fairness.clientSeed, this.ui.btnCopyClient)
    );
  }

  _bindSkipVideosUi() {
    const toggle = this.ui.skipVideosToggle;
    if (!toggle) return;
    toggle.checked = this.skipVideos;
    toggle.addEventListener('change', () => {
      this.skipVideos = !!toggle.checked;
      try {
        localStorage.setItem(SKIP_VIDEOS_KEY, this.skipVideos ? '1' : '0');
      } catch {
        /* ignore */
      }
    });
  }

  _bindCheatUi() {
    const btn = this.ui.btnCheat2pDamage;
    if (!btn) return;
    btn.addEventListener('click', () => this._cheatDamageOpponent(4));
  }

  _bindAudioTogglesUi() {
    const musicBtn = this.ui.btnToggleMusic;
    const sfxBtn = this.ui.btnToggleSfx;
    this._syncAudioToggleButtons();

    musicBtn?.addEventListener('click', () => {
      unlockAudio();
      toggleMusicMuted();
      this._syncAudioToggleButtons();
    });
    sfxBtn?.addEventListener('click', () => {
      unlockAudio();
      toggleSfxMuted();
      this._syncAudioToggleButtons();
    });
  }

  _syncAudioToggleButtons() {
    const musicBtn = this.ui.btnToggleMusic;
    const sfxBtn = this.ui.btnToggleSfx;
    if (musicBtn) {
      const muted = isMusicMuted();
      musicBtn.classList.toggle('is-muted', muted);
      musicBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
      musicBtn.title = muted ? 'Unmute music' : 'Mute music';
    }
    if (sfxBtn) {
      const muted = isSfxMuted();
      sfxBtn.classList.toggle('is-muted', muted);
      sfxBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
      sfxBtn.title = muted ? 'Unmute sound' : 'Mute sound';
    }
  }

  /** Dev cheat: strip health boxes from 2P (opponent). */
  _cheatDamageOpponent(amount = 4) {
    if (
      this.phase === GAME_PHASE.RESOLVING ||
      this.phase === GAME_PHASE.GAME_OVER ||
      this.cutsceneActive ||
      this._opponentDepleted
    ) {
      return;
    }

    const dealt = Math.min(amount, this.opponent.health);
    if (dealt <= 0) return;

    this.opponent.takeDamage(dealt);
    this.opponent.playHitReaction();
    playKickSound();
    this.effects.spawnSparks(this.opponent.x - 40, this.opponent.y - 180, 18);
    this.effects.spawnDamageNumber(
      this.opponent.x,
      this.opponent.y - 220,
      dealt,
      'dealt'
    );
    this.effects.triggerFlash(0.45, 110);
    this.effects.triggerShake(8, 180);
    this._syncHud();

    if (this.opponent.health <= 0 && !this._opponentDepleted) {
      this._opponentDepleted = true;
      this.onOpponentBoxesDepleted();
    }
  }

  _loadSkipVideosPref() {
    try {
      return localStorage.getItem(SKIP_VIDEOS_KEY) === '1';
    } catch {
      return false;
    }
  }

  /**
   * @param {string} text
   * @param {HTMLButtonElement | undefined} btn
   */
  async _copyText(text, btn) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      if (btn) {
        const prev = btn.textContent;
        btn.textContent = 'Copied';
        window.setTimeout(() => {
          btn.textContent = prev || 'Copy';
        }, 900);
      }
    } catch {
      /* ignore */
    }
  }

  _readBetInput() {
    const raw = this.ui.betInput ? Number(this.ui.betInput.value) : this.bet;
    return Number.isFinite(raw) ? raw : this.bet;
  }

  /** @param {number} n */
  _clampBet(n) {
    const v = Math.floor(Number(n) || 0);
    const balanceCap = Math.max(WALLET.MIN_BET, this.balance);
    return Math.max(WALLET.MIN_BET, Math.min(WALLET.MAX_BET, Math.min(v, balanceCap)));
  }

  /** @param {number} n */
  _fmtMoney(n) {
    const v = Math.round(Number(n) || 0);
    return String(v);
  }
}
