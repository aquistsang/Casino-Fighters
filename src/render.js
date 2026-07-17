/**
 * Canvas renderer: stage background, fighters, HUD bars, FX overlays.
 */

import { CANVAS, COLORS, HUD } from './constants.js';
import { assets } from './assets.js';

export class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
    this.dpr = window.devicePixelRatio || 1;
    this.resize();
  }

  resize() {
    const wrap = this.canvas.parentElement;
    const cssW = wrap ? wrap.clientWidth : CANVAS.WIDTH;
    const aspect = CANVAS.WIDTH / CANVAS.HEIGHT;
    let w = cssW;
    let h = cssW / aspect;
    // Leave room for wallet / HI-LO controls on phones and short iframes
    const maxFrac = window.innerWidth <= 560 || window.innerHeight < 640 ? 0.42 : 0.62;
    const maxH = window.innerHeight * maxFrac;
    if (h > maxH) {
      h = maxH;
      w = h * aspect;
    }

    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.canvas.width = Math.floor(CANVAS.WIDTH * this.dpr);
    this.canvas.height = Math.floor(CANVAS.HEIGHT * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
  }

  /**
   * @param {{
   *   player: import('./fighter.js').Fighter,
   *   opponent: import('./fighter.js').Fighter,
   *   effects: import('./effects.js').EffectsSystem,
   *   streak: number,
   *   round: number,
   *   multiplier: number,
   *   multiplierHistory: Array<{ value: number, won: boolean }>,
   *   cutsceneActive?: boolean,
   *   projectile?: null | {
   *     x: number,
   *     y: number,
   *     image: HTMLImageElement | HTMLCanvasElement,
   *     rotation?: number,
   *     scale?: number,
   *   },
   * }} state
   */
  draw(state) {
    const ctx = this.ctx;

    // Winner video owns the stage — blank the canvas (stage, fighters, HUD)
    if (state.cutsceneActive) {
      ctx.clearRect(0, 0, CANVAS.WIDTH, CANVAS.HEIGHT);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, CANVAS.WIDTH, CANVAS.HEIGHT);
      return;
    }

    const shake = state.effects.getShakeOffset();

    ctx.save();
    ctx.clearRect(0, 0, CANVAS.WIDTH, CANVAS.HEIGHT);
    ctx.translate(shake.x, shake.y);

    this._drawStage(ctx);
    this._drawFighter(ctx, state.opponent);
    this._drawFighter(ctx, state.player);
    this._drawProjectile(ctx, state.projectile);
    this._drawEffects(ctx, state.effects);

    ctx.restore();

    this._drawHud(ctx, state);
    // After HUD so multipliers sit in the gap above the fighter head
    this._drawMultiplierPopups(ctx, state.effects);
    this._drawScreenFlash(ctx, state.effects);
    this._drawSpecialBanner(ctx, state.effects);
  }

  /** @param {CanvasRenderingContext2D} ctx */
  _drawStage(ctx) {
    const bg = assets.stageBackground;
    if (bg) {
      const srcW =
        bg instanceof HTMLVideoElement ? bg.videoWidth || CANVAS.WIDTH : bg.width || CANVAS.WIDTH;
      const srcH =
        bg instanceof HTMLVideoElement
          ? bg.videoHeight || CANVAS.HEIGHT
          : bg.height || CANVAS.HEIGHT;

      // Cover-fit so the loop fills the arena without letterboxing
      const scale = Math.max(CANVAS.WIDTH / srcW, CANVAS.HEIGHT / srcH);
      const dw = srcW * scale;
      const dh = srcH * scale;
      const dx = (CANVAS.WIDTH - dw) / 2;
      const dy = (CANVAS.HEIGHT - dh) / 2;

      ctx.imageSmoothingEnabled = true;
      if (bg instanceof HTMLVideoElement) {
        if (bg.readyState >= 2) {
          ctx.drawImage(bg, dx, dy, dw, dh);
        } else {
          ctx.fillStyle = '#120a18';
          ctx.fillRect(0, 0, CANVAS.WIDTH, CANVAS.HEIGHT);
        }
      } else {
        ctx.drawImage(bg, dx, dy, dw, dh);
      }
      ctx.imageSmoothingEnabled = false;
      return;
    }

    const g = ctx.createLinearGradient(0, 0, 0, CANVAS.HEIGHT);
    g.addColorStop(0, '#1a1535');
    g.addColorStop(0.45, '#2a1f4e');
    g.addColorStop(0.55, COLORS.STAGE_FLOOR);
    g.addColorStop(1, '#1a100c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CANVAS.WIDTH, CANVAS.HEIGHT);
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('./fighter.js').Fighter} fighter
   */
  _drawFighter(ctx, fighter) {
    const img = fighter.anim.image;
    if (!img) return;

    const frame = fighter.anim.getCurrentFrame();
    const sw = frame.sw || img.width;
    const sh = frame.sh || img.height;

    let scale = fighter.drawScale;
    const idleDef = fighter.anim.definitions.get('idle');
    const attackPose =
      fighter.anim.currentName === 'attack' ||
      fighter.anim.currentName === 'attackGrab' ||
      fighter.anim.currentName === 'attackThrow';
    if (attackPose && idleDef?.frameH && sh > 0) {
      scale = (idleDef.frameH * fighter.drawScale) / sh;
    }

    const drawW = sw * scale * (frame.scaleX || 1);
    const drawH = sh * scale * (frame.scaleY || 1);

    ctx.save();
    ctx.translate(fighter.x + frame.offsetX * fighter.facing, fighter.y + 2);
    ctx.scale(1, 0.28);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 0, drawW * 0.38, drawW * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(fighter.x + frame.offsetX * fighter.facing, fighter.y + frame.offsetY);
    ctx.scale(fighter.facing, 1);
    ctx.rotate(frame.rotation || 0);
    ctx.globalAlpha = frame.alpha ?? 1;

    if (fighter.hitFlash > 0) {
      ctx.filter = 'brightness(2.4) saturate(0.3)';
    } else if (fighter.flashTimer > 0) {
      ctx.filter = 'brightness(1.6) drop-shadow(0 0 12px #ffd700)';
    }

    ctx.drawImage(
      img,
      frame.sx,
      frame.sy,
      sw,
      sh,
      -drawW / 2,
      -drawH,
      drawW,
      drawH
    );

    ctx.filter = 'none';
    ctx.restore();
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {null | undefined | {
   *   x: number,
   *   y: number,
   *   image: HTMLImageElement | HTMLCanvasElement,
   *   rotation?: number,
   *   scale?: number,
   * }} projectile
   */
  _drawProjectile(ctx, projectile) {
    if (!projectile?.image) return;
    const img = projectile.image;
    const scale = projectile.scale ?? 0.22;
    const drawW = img.width * scale;
    const drawH = img.height * scale;

    ctx.save();
    ctx.translate(projectile.x, projectile.y);
    ctx.rotate(projectile.rotation ?? 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.imageSmoothingEnabled = false;
    ctx.restore();
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('./effects.js').EffectsSystem} fx
   */
  _drawEffects(ctx, fx) {
    for (const s of fx.sparks) {
      const a = Math.max(0, s.life / s.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size * a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.textAlign = 'center';
    ctx.font = 'bold 28px "Press Start 2P", Impact, sans-serif';
    for (const t of fx.floatTexts) {
      const a = Math.max(0, t.life / t.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = t.color;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 4;
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  /**
   * Multiplier popups on the left between HUD and character head.
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('./effects.js').EffectsSystem} fx
   */
  _drawMultiplierPopups(ctx, fx) {
    for (const p of fx.multiplierPopups) {
      const a = Math.max(0, p.life / p.maxLife);
      const fade = a > 0.2 ? 1 : a / 0.2;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(p.x, p.y);
      ctx.scale(p.scale || 1, p.scale || 1);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#000';
      ctx.fillStyle = p.color;
      ctx.font = 'bold 22px "Press Start 2P", monospace';
      ctx.strokeText(p.text, 0, 0);
      ctx.fillText(p.text, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{
   *   player: import('./fighter.js').Fighter,
   *   opponent: import('./fighter.js').Fighter,
   *   multiplier: number,
   * }} state
   */
  _drawHud(ctx, state) {
    const hud = assets.hudOverlay;
    if (!hud) return;

    const display = HUD.DISPLAY_SCALE;
    const drawW = CANVAS.WIDTH * display;
    const drawH = (HUD.SRC_H / HUD.SRC_W) * drawW;
    const ox = (CANVAS.WIDTH - drawW) / 2;
    const oy = 6;
    const unit = drawW / HUD.SRC_W;

    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(hud, 0, 0, HUD.SRC_W, HUD.SRC_H, ox, oy, drawW, drawH);
    ctx.imageSmoothingEnabled = false;

    this._drawLifeBoxes(ctx, HUD.PLAYER_TRACK, state.player.health, unit, ox, oy, true);
    this._drawLifeBoxes(ctx, HUD.OPPONENT_TRACK, state.opponent.health, unit, ox, oy, false);
    this._drawMultiplierLabel(ctx, unit, ox, oy, state.multiplier, state.effects);
  }

  /**
   * Yellow life segments that fill the entire track (no gaps).
   * Outer boxes use an arrow tip so they meet the chrome ends.
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ x: number, y: number, w: number, h: number }} track
   * @param {number} boxes
   * @param {number} unit
   * @param {number} ox
   * @param {number} oy
   * @param {boolean} leftSide
   */
  _drawLifeBoxes(ctx, track, boxes, unit, ox, oy, leftSide) {
    const count = HUD.BOX_COUNT;
    const filled = Math.max(0, Math.min(count, Math.round(boxes)));
    if (filled <= 0) return;

    const x = ox + track.x * unit;
    const y = oy + track.y * unit;
    const w = track.w * unit;
    const h = track.h * unit;

    // Per-slot widths — tip box can be shorter; others share the rest
    /** @type {number[]} */
    const widths = [];
    const tipSlot = leftSide ? 0 : count - 1;
    const tipScale = leftSide
      ? (HUD.TIP_BOX_SCALE_LEFT ?? 1)
      : (HUD.TIP_BOX_SCALE_RIGHT ?? 1);
    const tipW = (w / count) * tipScale;
    const otherW = (w - tipW) / (count - 1);
    for (let s = 0; s < count; s++) {
      widths.push(s === tipSlot ? tipW : otherW);
    }

    /** @type {number[]} */
    const starts = [];
    let cursor = x;
    for (let s = 0; s < count; s++) {
      starts.push(cursor);
      cursor += widths[s];
    }

    const tipDepth = leftSide ? HUD.TIP_DEPTH_LEFT : HUD.TIP_DEPTH_RIGHT;

    for (let i = 0; i < filled; i++) {
      // Deplete from outer tip inward — remaining boxes stay near center
      const slot = leftSide ? count - filled + i : i;
      const bw = widths[slot];
      const tip = Math.min(tipDepth * unit, bw * 0.55);
      const tipSide =
        leftSide && slot === 0 ? 'left' : !leftSide && slot === count - 1 ? 'right' : 'none';
      this._fillLifeBox(ctx, starts[slot], y, bw, h, tipSide, tip);
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} bx
   * @param {number} by
   * @param {number} bw
   * @param {number} bh
   * @param {'left' | 'right' | 'none'} tipSide
   * @param {number} tip
   */
  _fillLifeBox(ctx, bx, by, bw, bh, tipSide, tip) {
    ctx.beginPath();
    if (tipSide === 'left') {
      ctx.moveTo(bx + tip, by);
      ctx.lineTo(bx + bw, by);
      ctx.lineTo(bx + bw, by + bh);
      ctx.lineTo(bx + tip, by + bh);
      ctx.lineTo(bx, by + bh / 2);
    } else if (tipSide === 'right') {
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + bw - tip, by);
      ctx.lineTo(bx + bw, by + bh / 2);
      ctx.lineTo(bx + bw - tip, by + bh);
      ctx.lineTo(bx, by + bh);
    } else {
      ctx.rect(bx, by, bw, bh);
    }
    ctx.closePath();

    const grad = ctx.createLinearGradient(bx, by, bx, by + bh);
    grad.addColorStop(0, '#ffe98a');
    grad.addColorStop(0.45, COLORS.LIFE_BOX);
    grad.addColorStop(1, '#e0a820');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = COLORS.LIFE_BOX_EDGE;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /**
   * Center square shows the live Hi/Lo multiplier (1.00×, 1.15×, 1.32×…).
   * Gold at 1x, green while climbing, brief red flash on bust.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} unit
   * @param {number} ox
   * @param {number} oy
   * @param {number} multiplier
   * @param {import('./effects.js').EffectsSystem} fx
   */
  _drawMultiplierLabel(ctx, unit, ox, oy, multiplier, fx) {
    const n = Number(multiplier) || 1;
    const label =
      n >= 100 ? `${Math.round(n)}x` : Number.isInteger(n) ? `${n}.00x` : `${n.toFixed(2)}x`;

    const c = HUD.CENTER;
    const x = ox + c.x * unit;
    const y = oy + c.y * unit;
    const w = c.w * unit;
    const h = c.h * unit;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const maxW = w * 0.88;
    const maxH = h * 0.7;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let size = Math.floor(Math.min(maxH, w * (label.length <= 4 ? 0.32 : 0.22)));
    size = Math.max(10, size);
    ctx.font = `bold ${size}px "Press Start 2P", monospace`;
    while (size > 9 && ctx.measureText(label).width > maxW) {
      size -= 1;
      ctx.font = `bold ${size}px "Press Start 2P", monospace`;
    }

    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.lineWidth = Math.max(3, Math.round(size * 0.2));

    const grad = ctx.createLinearGradient(x, y, x, y + h);
    if (fx?.multiplierTint?.active) {
      grad.addColorStop(0, '#ffb0b0');
      grad.addColorStop(0.55, '#ff5555');
      grad.addColorStop(1, '#b01020');
    } else if (n > 1) {
      grad.addColorStop(0, '#7dff9a');
      grad.addColorStop(0.55, '#3ecf6e');
      grad.addColorStop(1, '#1f8f42');
    } else {
      grad.addColorStop(0, '#ffe566');
      grad.addColorStop(0.55, '#ff9a1a');
      grad.addColorStop(1, '#e04810');
    }
    ctx.fillStyle = grad;

    ctx.strokeText(label, cx, cy);
    ctx.fillText(label, cx, cy);
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('./effects.js').EffectsSystem} fx
   */
  _drawScreenFlash(ctx, fx) {
    for (const f of fx.flashes) {
      const a = (f.life / f.maxLife) * f.strength;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.fillRect(0, 0, CANVAS.WIDTH, CANVAS.HEIGHT);
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('./effects.js').EffectsSystem} fx
   */
  _drawSpecialBanner(ctx, fx) {
    if (!fx.specialBanner.active) return;
    const t = fx.specialBanner.life / fx.specialBanner.maxLife;
    const pulse = 0.7 + Math.sin(Date.now() / 80) * 0.3;

    ctx.fillStyle = `rgba(0,0,0,${0.55 * Math.min(1, t * 3)})`;
    ctx.fillRect(0, CANVAS.HEIGHT / 2 - 50, CANVAS.WIDTH, 100);

    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(255, 215, 0, ${pulse})`;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 5;
    const msg = fx.specialBanner.text || 'SPECIAL ATTACK READY!';
    const size = msg.length > 22 ? 16 : 22;
    ctx.font = `bold ${size}px "Press Start 2P", monospace`;
    ctx.strokeText(msg, CANVAS.WIDTH / 2, CANVAS.HEIGHT / 2 + 8);
    ctx.fillText(msg, CANVAS.WIDTH / 2, CANVAS.HEIGHT / 2 + 8);
  }
}
