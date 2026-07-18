/**
 * Keyboard + button input for HEADS / PAWS / restart.
 * Keys: 1 = HEADS, 2 = PAWS, R = restart (when game over)
 */

export class InputHandler {
  /**
   * @param {{
   *   onHi: () => void,
   *   onLo: () => void,
   *   onRestart: () => void,
   * }} handlers
   */
  constructor(handlers) {
    this.handlers = handlers;
    this.enabled = true;
    this._onKeyDown = this._onKeyDown.bind(this);
  }

  /**
   * @param {{ btnHi: HTMLElement, btnLo: HTMLElement, btnRestart: HTMLElement }} els
   */
  bindUI(els) {
    els.btnHi.addEventListener('click', () => {
      if (this.enabled) this.handlers.onHi();
    });
    els.btnLo.addEventListener('click', () => {
      if (this.enabled) this.handlers.onLo();
    });
    els.btnRestart.addEventListener('click', () => this.handlers.onRestart());
    window.addEventListener('keydown', this._onKeyDown);
  }

  /** @param {KeyboardEvent} e */
  _onKeyDown(e) {
    if (!this.enabled && e.key !== 'r' && e.key !== 'R') return;
    if (e.key === '1') this.handlers.onHi();
    if (e.key === '2') this.handlers.onLo();
    if (e.key === 'r' || e.key === 'R') this.handlers.onRestart();
  }

  setEnabled(value) {
    this.enabled = value;
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
  }
}
