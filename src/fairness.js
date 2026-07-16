/**
 * Lightweight fairness / RTP seed display for Hi-Lo (50% fair odds).
 */

const CLIENT_SEED_KEY = 'hi-lo-fighters-client-seed';

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
    /** Approx. RTP if cashing after first win (50% × 1.15). Climbing further lowers EV. */
    this.rtpPercent = 58;
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
   * Provably-fair coin: SHA-256(server:client:nonce) → float in [0,1)
   * @returns {Promise<{ cardIsHigh: boolean, roll: number }>}
   */
  async nextCard() {
    const payload = `${this.serverSeed}:${this.clientSeed}:${this.nonce}`;
    const hash = await sha256Hex(payload);
    const slice = hash.slice(0, 8);
    const roll = parseInt(slice, 16) / 0x100000000;
    const cardIsHigh = roll < 0.5;
    this.lastRoll = roll;
    this.lastOutcome = cardIsHigh ? 'HI' : 'LO';
    this.nonce += 1;
    return { cardIsHigh, roll };
  }

  shortHash() {
    return this.serverSeedHash || '—';
  }

  shortClient() {
    return this.clientSeed || '—';
  }
}
