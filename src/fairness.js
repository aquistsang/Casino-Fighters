/**
 * Provably-fair coin flip with house edge.
 * Outcome = SHA-256(serverSeed:clientSeed:nonce) → roll in [0,1).
 * Player wins when roll < HOUSE.WIN_CHANCE (not a raw 50/50).
 */

import { HOUSE, MULTIPLIER } from './constants.js';

const CLIENT_SEED_KEY = 'coin-fighters-client-seed';

function randomSeed() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

export class Fairness {
  constructor() {
    this.serverSeed = '';
    this.serverSeedHash = '';
    this.clientSeed = this._loadClientSeed();
    this.nonce = 0;
    this.lastRoll = null;
    this.lastOutcome = null;
    /** Approx. RTP if cashing after first win: WIN_CHANCE × WIN_FACTOR */
    this.rtpPercent = Math.round(HOUSE.WIN_CHANCE * MULTIPLIER.WIN_FACTOR * 100);
    this.houseEdgePercent = Math.round(HOUSE.EDGE * 100);
  }

  _loadClientSeed() {
    try {
      const stored = localStorage.getItem(CLIENT_SEED_KEY);
      if (stored) return stored;
    } catch {
      /* ignore */
    }
    return randomSeed();
  }

  async initSession() {
    this.serverSeed = randomSeed();
    this.serverSeedHash = await sha256Hex(this.serverSeed);
    this.nonce = 0;
    this.lastRoll = null;
    this.lastOutcome = null;
    try {
      localStorage.setItem(CLIENT_SEED_KEY, this.clientSeed);
    } catch {
      /* ignore */
    }
  }

  /**
   * Provably-fair flip with house edge.
   * Roll decides win/loss; landing face is the side that "won" the flip
   * (player's pick on a win, the opposite on a loss) so the still always
   * matches the bet outcome.
   * @param {'HEADS' | 'PAWS'} choice — player's pick
   * @returns {Promise<{ face: 'HEADS' | 'PAWS', isHeads: boolean, playerWon: boolean, roll: number }>}
   */
  async nextCard(choice = 'HEADS') {
    const payload = `${this.serverSeed}:${this.clientSeed}:${this.nonce}`;
    const hash = await sha256Hex(payload);
    const slice = hash.slice(0, 8);
    const roll = parseInt(slice, 16) / 0x100000000;
    // House edge: win window is smaller than 50%
    const playerWon = roll < HOUSE.WIN_CHANCE;
    // Face that won this flip — what the coin must land on
    const face = /** @type {'HEADS' | 'PAWS'} */ (
      playerWon ? choice : choice === 'HEADS' ? 'PAWS' : 'HEADS'
    );
    this.lastRoll = roll;
    this.lastOutcome = face;
    this.nonce += 1;
    return { face, isHeads: face === 'HEADS', playerWon, roll };
  }

  shortHash() {
    return this.serverSeedHash || '—';
  }

  shortClient() {
    return this.clientSeed || '—';
  }
}
