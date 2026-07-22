/**
 * Coin Fighters — core game loop & coin-flip resolution.
 *
 * Flow: SELECT → BETTING → (HEADS or PAWS) → coin flip → RESOLVING (fight) → BETTING | GAME_OVER
 */

import { GAME_PHASE, HEALTH, MULTIPLIER, STAGE, TIMING, WALLET } from './constants.js';
import { Fighter } from './fighter.js';
import { EffectsSystem } from './effects.js';
import { InputHandler } from './input.js';
import { Renderer } from './render.js';
import { getCharacter } from './characters.js';
import {
  assets,
  loadAssets,
  createAnimationsForCharacter,
  createOpponentAnimations,
  portraitDataUrl,
  startStageVideo,
} from './assets.js';
import {
  loadAudio,
  playKickSound,
  playPunchSound,
  playYouWinSound,
  playYouLoseSound,
  playCoinsCollectSound,
  playCoinSpinSound,
  stopCoinSpinSound,
  unlockAudio,
  isMusicMuted,
  isSfxMuted,
  toggleMusicMuted,
  toggleSfxMuted,
} from './audio.js';
import { Fairness } from './fairness.js';

const ROUND_HISTORY_MAX = 16;
const SKIP_VIDEOS_KEY = 'coin-fighters-skip-videos';

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
   *   rtpEdgeEl?: HTMLElement,
   *   rtpHashEl?: HTMLElement,
   *   rtpClientEl?: HTMLElement,
   *   rtpNonceEl?: HTMLElement,
   *   rtpLastEl?: HTMLElement,
   *   victoryOverlay?: HTMLElement,
   *   victoryVideoEl?: HTMLVideoElement,
   *   victoryPrezzVideoEl?: HTMLVideoElement,
   *   defeatVideoEl?: HTMLVideoElement,
   *   defeatPrezzVideoEl?: HTMLVideoElement,
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
   *   btnCheat1pDamage?: HTMLButtonElement,
   *   coinFlipOverlay?: HTMLElement,
   *   coinFlipImg?: HTMLImageElement,
   *   btnSkipFlip?: HTMLButtonElement,
   *   btnSkipFight?: HTMLButtonElement,
   *   btnToggleMusic?: HTMLButtonElement,
   *   btnToggleSfx?: HTMLButtonElement,
   *   charSelect?: HTMLElement,
   *   charCards?: HTMLElement[],
   *   portraitRookie?: HTMLImageElement,
   *   portraitTrump?: HTMLImageElement,
   *   btnFight?: HTMLButtonElement,
   * }} ui
   */
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.ui = ui;
    this.renderer = new Renderer(canvas);
    this.effects = new EffectsSystem();
    this.fairness = new Fairness();
    this.phase = GAME_PHASE.SELECT;
    /** @type {'rookie' | 'trump'} */
    this.characterId = 'rookie';
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
    /** @type {null | { phase: 'grab' | 'throw' | 'fly', elapsed: number, launched: boolean, impactDone: boolean }} */
    this.wigAttack = null;
    /** @type {null | { x: number, y: number, startX: number, startY: number, endX: number, endY: number, t: number, dur: number, image: HTMLCanvasElement, rotation: number, scale: number }} */
    this.projectile = null;
    /** Fight resolve animation can be skipped (like coin flip). */
    this._fightSkipArmed = false;
    this._fightResolveFinished = false;

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
      onHi: () => this.placeBet('HEADS'),
      onLo: () => this.placeBet('PAWS'),
      onRestart: () => this._onOverlayPrimary(),
    });
    /** @type {number | null} */
    this._coinFlipRaf = null;
    /** @type {ReturnType<typeof setTimeout> | null} */
    this._coinFlipLandTimer = null;
    this.input.bindUI(ui);
    this._bindWalletUi();
    this._bindRulesAndFairnessUi();
    this._bindSkipVideosUi();
    this._bindCheatUi();
    this._bindAudioTogglesUi();
    this._bindCharSelectUi();

    window.addEventListener('resize', () => this.renderer.resize());
  }

  async init() {
    await Promise.all([loadAssets(), loadAudio(), this.fairness.initSession()]);
    if (!assets.playerFighter || !assets.opponentFighter || !assets.trump) {
      throw new Error('Fighter sprites failed to load');
    }
    this.opponent.registerAnimations(
      createOpponentAnimations(assets.opponentFighter, assets.opponentPunch)
    );
    this._fillCharPortraits();
    this._syncHud();
    this._showCharacterSelect();
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
    this._updateWigAttack(dt);

    this.renderer.draw({
      player: this.player,
      opponent: this.opponent,
      effects: this.effects,
      streak: this.streak,
      round: this.round,
      multiplier: this.multiplier,
      multiplierHistory: this.multiplierHistory,
      cutsceneActive: this.cutsceneActive,
      projectile: this.projectile,
    });

    requestAnimationFrame((t) => this._frame(t));
  }

  /**
   * @param {'HEADS' | 'PAWS'} choice
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

    const { face, playerWon } = await this.fairness.nextCard(choice);

    this._lastCard = face;
    this._syncRtpUi();

    // Landing still = RNG face (HEADS/cat or PAWS), not merely the player's pick
    await this._playCoinFlip(face);

    if (playerWon) {
      this._resolveWin(choice);
    } else {
      this._resolveLoss();
    }
  }

  /**
   * 3s coin spin (fast → slow): heads → middle → paws → middle…
   * Lands on the RNG outcome face (cat head or paw). Skip jumps to that still.
   * @param {'HEADS' | 'PAWS'} face — coin side that won this flip
   * @returns {Promise<void>}
   */
  _playCoinFlip(face) {
    const overlay = this.ui.coinFlipOverlay;
    const img = this.ui.coinFlipImg;
    const skipBtn = this.ui.btnSkipFlip;
    const landUrl = face === 'HEADS' ? assets.coinHeadsUrl : assets.coinTailsUrl;
    const frames = [
      assets.coinHeadsUrl,
      assets.coinMiddleUrl,
      assets.coinTailsUrl,
      assets.coinMiddleUrl,
    ].filter(Boolean);

    if (!overlay || !img || !landUrl || frames.length < 3) {
      return Promise.resolve();
    }

    const landMs = TIMING.COIN_FLIP_LAND_MS;

    /** Show final face briefly, then dismiss overlay. */
    const showLandingStill = () =>
      new Promise((resolve) => {
        stopCoinSpinSound();
        if (this._coinFlipRaf != null) {
          cancelAnimationFrame(this._coinFlipRaf);
          this._coinFlipRaf = null;
        }
        if (this._coinFlipLandTimer != null) {
          clearTimeout(this._coinFlipLandTimer);
          this._coinFlipLandTimer = null;
        }
        overlay.hidden = false;
        overlay.setAttribute('aria-hidden', 'false');
        // Force a paint of the outcome face (cat head / paw)
        img.removeAttribute('src');
        img.src = landUrl;
        img.alt = face === 'HEADS' ? 'Heads' : 'Paws';
        img.classList.remove('is-flip');
        if (skipBtn) skipBtn.hidden = true;
        this._coinFlipLandTimer = setTimeout(() => {
          this._coinFlipLandTimer = null;
          overlay.hidden = true;
          overlay.setAttribute('aria-hidden', 'true');
          if (skipBtn) skipBtn.hidden = false;
          resolve();
        }, landMs);
      });

    // "Skip video" also skips the spin — still shows the result face.
    if (this.skipVideos) {
      return showLandingStill();
    }

    return new Promise((resolve) => {
      let finished = false;
      let frameIndex = 0;
      let nextFlipAt = 0;
      const duration = TIMING.COIN_FLIP_MS;
      const start = performance.now();

      const showFrame = (url) => {
        img.src = url;
        img.classList.remove('is-flip');
      };

      const cleanup = () => {
        if (this._coinFlipRaf != null) {
          cancelAnimationFrame(this._coinFlipRaf);
          this._coinFlipRaf = null;
        }
        skipBtn?.removeEventListener('click', onSkip);
      };

      const finish = () => {
        if (finished) return;
        finished = true;
        cleanup();
        showLandingStill().then(resolve);
      };

      const onSkip = () => finish();

      const tick = (now) => {
        if (finished) return;
        const t = now - start;
        if (t >= duration) {
          finish();
          return;
        }
        const u = Math.min(1, t / duration);
        // Interval eases from ~55ms → ~280ms (fast start, slow end)
        const interval = 55 + u * u * 225;
        if (now >= nextFlipAt) {
          showFrame(frames[frameIndex % frames.length]);
          frameIndex += 1;
          nextFlipAt = now + interval;
        }
        this._coinFlipRaf = requestAnimationFrame(tick);
      };

      overlay.hidden = false;
      overlay.setAttribute('aria-hidden', 'false');
      if (skipBtn) skipBtn.hidden = false;
      showFrame(frames[0]);
      playCoinSpinSound();
      skipBtn?.addEventListener('click', onSkip);
      this._coinFlipRaf = requestAnimationFrame(tick);
    });
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
   * @param {'HEADS' | 'PAWS'} choice
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

    if (this.skipVideos) {
      this._applyWinImpact();
      this._afterResolve();
      return;
    }

    this._armFightSkip();

    if (getCharacter(this.characterId).attackStyle === 'wig') {
      this._startWigAttack();
      return;
    }

    this.player.playKickAttack(this.opponent.x, {
      onImpact: () => this._applyWinImpact(),
      onComplete: () => this._finishFightResolve(),
    });
  }

  /** Shared win hit FX + 2P yellow-box damage. */
  _applyWinImpact() {
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
  }

  /** Trump: grab wig → throw pose → wig projectile → 2P loses a box. */
  _startWigAttack() {
    this.wigAttack = {
      phase: 'grab',
      elapsed: 0,
      launched: false,
      impactDone: false,
    };
    this.projectile = null;
    this.player.state = 'ATTACKING';
    this.player.anim.play('attackGrab', { loop: false });
  }

  /** @param {number} dt */
  _updateWigAttack(dt) {
    if (!this.wigAttack) return;

    const atk = this.wigAttack;
    atk.elapsed += dt;

    if (atk.phase === 'grab' && atk.elapsed >= TIMING.WIG_GRAB) {
      atk.phase = 'throw';
      atk.elapsed = 0;
      this.player.anim.play('attackThrow', { loop: false });
    }

    if (atk.phase === 'throw' && !atk.launched && atk.elapsed >= TIMING.WIG_THROW * 0.35) {
      atk.launched = true;
      const wig = assets.trump?.wig;
      if (wig) {
        const startX = this.player.x + 70;
        const startY = this.player.y - TIMING.WIG_Y_OFFSET;
        this.projectile = {
          x: startX,
          y: startY,
          startX,
          startY,
          endX: this.opponent.x - 30,
          endY: this.opponent.y - TIMING.WIG_Y_OFFSET + 20,
          t: 0,
          dur: TIMING.WIG_FLIGHT,
          image: wig,
          rotation: -0.35,
          scale: 0.2,
        };
      } else if (!atk.impactDone) {
        atk.impactDone = true;
        this._applyWinImpact();
        this.player.setIdle();
        this.wigAttack = null;
        this._finishFightResolve();
        return;
      }
    }

    if (atk.phase === 'throw' && atk.elapsed >= TIMING.WIG_THROW) {
      atk.phase = 'fly';
    }

    if (this.projectile) {
      const p = this.projectile;
      p.t = Math.min(1, p.t + dt / p.dur);
      const u = p.t;
      const eased = u * u * (3 - 2 * u);
      p.x = p.startX + (p.endX - p.startX) * eased;
      p.y = p.startY + (p.endY - p.startY) * eased - Math.sin(u * Math.PI) * 40;
      p.rotation = -0.35 + u * 2.8;

      if (p.t >= 1 && !atk.impactDone) {
        atk.impactDone = true;
        this.projectile = null;
        this._applyWinImpact();
        this.player.setIdle();
        this.wigAttack = null;
        this._finishFightResolve();
      }
    }
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

    const applyLossImpact = () => {
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
    };

    if (this.skipVideos) {
      applyLossImpact();
      this._afterResolve();
      return;
    }

    this._armFightSkip();
    this.opponent.playPunchAttack(this.player.x, {
      onImpact: applyLossImpact,
      onComplete: () => this._finishFightResolve(),
    });
  }

  _armFightSkip() {
    this._fightSkipArmed = true;
    this._fightResolveFinished = false;
    const btn = this.ui.btnSkipFight;
    if (btn) btn.hidden = false;
  }

  _disarmFightSkip() {
    this._fightSkipArmed = false;
    const btn = this.ui.btnSkipFight;
    if (btn) btn.hidden = true;
  }

  /**
   * Skip post-flip fight animation: apply pending impact, then finish resolve.
   */
  _skipFightAnimation() {
    if (!this._fightSkipArmed || this._fightResolveFinished) return;
    this._disarmFightSkip();

    // Wig attack path
    if (this.wigAttack) {
      if (!this.wigAttack.impactDone) {
        this.wigAttack.impactDone = true;
        this._applyWinImpact();
      }
      this.projectile = null;
      this.wigAttack = null;
      this.player.motion = null;
      this.opponent.motion = null;
      this.player.setIdle();
      this.opponent.setIdle();
      this._finishFightResolve();
      return;
    }

    // Kick / punch lunge on either fighter
    const attacker = this.player.motion ? this.player : this.opponent.motion ? this.opponent : null;
    if (attacker?.motion) {
      const m = attacker.motion;
      if (!m.impactFired) {
        m.impactFired = true;
        m.onImpact?.();
      }
      // Drop callbacks so delayed onComplete cannot double-finish
      m.onComplete = undefined;
      m.onImpact = undefined;
    }

    this.player.motion = null;
    this.opponent.motion = null;
    this.player.setIdle();
    this.opponent.setIdle();
    this._finishFightResolve();
  }

  /** Single entry so skip + natural complete cannot double-run. */
  _finishFightResolve() {
    if (this._fightResolveFinished) return;
    this._fightResolveFinished = true;
    this._disarmFightSkip();
    this._afterResolve();
  }

  _afterResolve() {
    this._disarmFightSkip();
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
   * Prezz uses a dedicated defeat cutscene.
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

    const defeatEl =
      this.characterId === 'trump' && this.ui.defeatPrezzVideoEl
        ? this.ui.defeatPrezzVideoEl
        : this.ui.defeatVideoEl;

    window.setTimeout(() => {
      this._playCutscene(defeatEl, () => this._endMatch(false));
    }, bannerMs);
  }

  /**
   * Called when the opponent's 5 yellow boxes are all gone.
   * Banner → victory video → round-clear (KEEP FIGHTING).
   * Prezz uses a dedicated victory cutscene.
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

    const victoryEl =
      this.characterId === 'trump' && this.ui.victoryPrezzVideoEl
        ? this.ui.victoryPrezzVideoEl
        : this.ui.victoryVideoEl;

    window.setTimeout(() => {
      this._playCutscene(victoryEl, () => this._showRoundClear());
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
    if (this.ui.victoryPrezzVideoEl) this.ui.victoryPrezzVideoEl.hidden = true;
    if (this.ui.defeatVideoEl) this.ui.defeatVideoEl.hidden = true;
    if (this.ui.defeatPrezzVideoEl) this.ui.defeatPrezzVideoEl.hidden = true;
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
      ? 'Opponent KO — Coin Fighters champion!'
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
    this.wigAttack = null;
    this.projectile = null;
    if (this._coinFlipRaf != null) {
      cancelAnimationFrame(this._coinFlipRaf);
      this._coinFlipRaf = null;
    }
    if (this._coinFlipLandTimer != null) {
      clearTimeout(this._coinFlipLandTimer);
      this._coinFlipLandTimer = null;
    }
    stopCoinSpinSound();
    if (this.ui.coinFlipOverlay) {
      this.ui.coinFlipOverlay.hidden = true;
      this.ui.coinFlipOverlay.setAttribute('aria-hidden', 'true');
    }
    this._setCutsceneActive(false);
    this.effects.sparks = [];
    this.effects.floatTexts = [];
    this.effects.multiplierPopups = [];
    this.effects.flashes = [];
    this.effects.specialBanner.active = false;
    this._showCharacterSelect();
    this.effects.multiplierTint.active = false;
    if (this.ui.victoryOverlay) {
      this.ui.victoryOverlay.hidden = true;
      this.ui.victoryOverlay.setAttribute('aria-hidden', 'true');
    }
    if (this.ui.victoryVideoEl instanceof HTMLVideoElement) {
      this.ui.victoryVideoEl.pause();
      this.ui.victoryVideoEl.hidden = true;
    }
    if (this.ui.victoryPrezzVideoEl instanceof HTMLVideoElement) {
      this.ui.victoryPrezzVideoEl.pause();
      this.ui.victoryPrezzVideoEl.hidden = true;
    }
    if (this.ui.defeatVideoEl instanceof HTMLVideoElement) {
      this.ui.defeatVideoEl.pause();
      this.ui.defeatVideoEl.hidden = true;
    }
    if (this.ui.defeatPrezzVideoEl instanceof HTMLVideoElement) {
      this.ui.defeatPrezzVideoEl.pause();
      this.ui.defeatPrezzVideoEl.hidden = true;
    }
    this.ui.overlay.hidden = true;
    this.ui.overlay.classList.remove('win', 'lose');
    if (this.ui.btnRestart) {
      this.ui.btnRestart.textContent = 'RESTART';
    }
    this.fairness.initSession().then(() => this._syncHud());
    this._syncHud();
  }

  _bindCharSelectUi() {
    const cards = this.ui.charCards ?? [];
    for (const card of cards) {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-char');
        if (id === 'rookie' || id === 'trump') this._highlightCharacter(id);
      });
    }
    this.ui.btnFight?.addEventListener('click', () => this.confirmCharacterSelect());
  }

  _fillCharPortraits() {
    if (this.ui.portraitRookie) this.ui.portraitRookie.src = portraitDataUrl('rookie');
    if (this.ui.portraitTrump) this.ui.portraitTrump.src = portraitDataUrl('trump');
  }

  /** Street Fighter–style select before betting. */
  _showCharacterSelect() {
    this.phase = GAME_PHASE.SELECT;
    this.input.setEnabled(false);
    // HEADS/PAWS wait for FIGHT; bet amount stays editable via _syncWalletUi
    this._setButtonsDisabled(true);
    this.wigAttack = null;
    this.projectile = null;
    if (this.ui.charSelect) {
      this.ui.charSelect.hidden = false;
      this.ui.charSelect.setAttribute('aria-hidden', 'false');
    }
    this._highlightCharacter(this.characterId);
    this._syncWalletUi();
  }

  /** @param {'rookie' | 'trump'} id */
  _highlightCharacter(id) {
    this.characterId = id;
    const cards = this.ui.charCards ?? [];
    for (const card of cards) {
      const selected = card.getAttribute('data-char') === id;
      card.classList.toggle('is-selected', selected);
      card.setAttribute('aria-pressed', selected ? 'true' : 'false');
    }
  }

  /** Apply selected 1P kit and start the match. */
  confirmCharacterSelect() {
    if (this.phase !== GAME_PHASE.SELECT) return;
    const id = this.characterId;
    const char = getCharacter(id);
    this.player.name = char.name;
    this.player.registerAnimations(createAnimationsForCharacter(id));
    // 2P always stays the original opponent
    this.opponent.name = 'CPU';
    this.opponent.drawScale = STAGE.OPPONENT_SCALE;
    this.opponent.registerAnimations(
      createOpponentAnimations(assets.opponentFighter, assets.opponentPunch)
    );
    // Match 1P on-screen height to 2P (sprite plates differ after crop)
    this._matchPlayerScaleToOpponent();
    this.player.reset();
    this.opponent.reset();

    if (this.ui.charSelect) {
      this.ui.charSelect.hidden = true;
      this.ui.charSelect.setAttribute('aria-hidden', 'true');
    }
    this._returnToBetting();
  }

  /** Scale 1P so idle height matches 2P on the stage. */
  _matchPlayerScaleToOpponent() {
    const playerH = this.player.anim.definitions.get('idle')?.frameH;
    const opponentH = this.opponent.anim.definitions.get('idle')?.frameH;
    if (!playerH || !opponentH) {
      this.player.drawScale = STAGE.FIGHTER_SCALE;
      return;
    }
    this.player.drawScale = (opponentH * this.opponent.drawScale) / playerH;
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
    if (this.ui.rtpEdgeEl) this.ui.rtpEdgeEl.textContent = `${f.houseEdgePercent}%`;
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

    // Bet amount (½ / input / 2× / MAX) stays editable any time a climb
    // isn't already locked — including character select before FIGHT.
    // Only freeze while stake is live, mid-resolve, or during a cutscene.
    const betLocked =
      this.activeStake > 0 ||
      this.phase === GAME_PHASE.RESOLVING ||
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
    this.ui.btnSkipFight?.addEventListener('click', () => this._skipFightAnimation());
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
    this.ui.btnCheat2pDamage?.addEventListener('click', () => this._cheatDamageOpponent(4));
    this.ui.btnCheat1pDamage?.addEventListener('click', () => this._cheatDamagePlayer(4));
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

  /** Dev cheat: strip health boxes from 1P (player). */
  _cheatDamagePlayer(amount = 4) {
    if (
      this.phase === GAME_PHASE.RESOLVING ||
      this.phase === GAME_PHASE.GAME_OVER ||
      this.cutsceneActive
    ) {
      return;
    }

    const dealt = Math.min(amount, this.player.health);
    if (dealt <= 0) return;

    this.player.takeDamage(dealt);
    this.player.playHitReaction();
    playPunchSound();
    this.effects.spawnSparks(this.player.x + 40, this.player.y - 160, 14);
    this.effects.spawnDamageNumber(
      this.player.x,
      this.player.y - 200,
      dealt,
      'received'
    );
    this.effects.triggerFlash(0.35, 90);
    this.effects.triggerShake(7, 180);
    this._syncHud();

    if (this.player.health <= 0) {
      this.onPlayerBoxesDepleted();
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
