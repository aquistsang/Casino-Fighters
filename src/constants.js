/** Global game constants and fighter state enum. */

export const FIGHTER_STATE = {
  IDLE: 'IDLE',
  ATTACKING: 'ATTACKING',
  HIT_REACTION: 'HIT_REACTION',
  SPECIAL: 'SPECIAL',
};

export const GAME_PHASE = {
  SELECT: 'SELECT',
  BETTING: 'BETTING',
  RESOLVING: 'RESOLVING',
  GAME_OVER: 'GAME_OVER',
};

export const CANVAS = {
  WIDTH: 960,
  HEIGHT: 540,
};

/** Feet rest on the stage stone tiles (bottom of fighter sprite). */
export const STAGE = {
  FLOOR_Y: 532,
  PLAYER_X: 250,
  OPPONENT_X: 710,
  FIGHTER_SCALE: 0.46,
  /** 2P draw scale; 1P is matched to this on-screen height at fight start */
  OPPONENT_SCALE: 0.39,
};

export const HEALTH = {
  /** Yellow life boxes on each HUD side */
  MAX_BOXES: 5,
  /** Boxes removed from opponent on a successful bet win */
  WIN_COST: 1,
};

export const TIMING = {
  IDLE_FPS: 10,
  ATTACK_DURATION: 620,
  HIT_DURATION: 400,
  SPECIAL_DURATION: 1200,
  RESOLVE_DELAY: 50,
  /** Coin flip overlay spin duration (ms) */
  COIN_FLIP_MS: 3000,
  /** Brief hold on final face before fight resolve (ms) */
  COIN_FLIP_LAND_MS: 550,
  /** Kick lunge timeline (ms) */
  KICK_WINDUP: 100,
  KICK_LUNGE: 180,
  KICK_HOLD: 160,
  KICK_RECOVER: 200,
  KICK_REACH: 145,
  /** Trump wig throw timeline (ms) */
  WIG_GRAB: 320,
  WIG_THROW: 160,
  WIG_FLIGHT: 380,
  WIG_Y_OFFSET: 210,
};

export const COLORS = {
  PLAYER_HP: '#44cc66',
  OPPONENT_HP: '#cc3344',
  HP_BG: '#1a1a2e',
  HP_BORDER: '#d4af37',
  STAGE_SKY: '#2a1f4e',
  STAGE_FLOOR: '#3d2b1f',
  STAGE_FLOOR_LIGHT: '#5c4033',
  SPARK: '#fff8a0',
  FLASH: '#ffffff',
  LIFE_BOX: '#ffd84a',
  LIFE_BOX_EDGE: '#b8860b',
  LIFE_BOX_GLOW: 'rgba(255, 210, 64, 0.45)',
};

/**
 * HUD overlay layout — coords are for the 1016×160 source image.
 */
export const HUD = {
  SRC_W: 1016,
  SRC_H: 160,
  /** Draw HUD smaller than full canvas width so it sits in proportion */
  DISPLAY_SCALE: 0.78,
  BOX_COUNT: 5,
  /** 1P dark trough — mirrored from right bar */
  PLAYER_TRACK: { x: 29, y: 60, w: 386, h: 44 },
  /** 2P dark trough — center to tip (source px) */
  OPPONENT_TRACK: { x: 601, y: 60, w: 386, h: 44 },
  /** Outer arrow tip depths in source px (left mirrors right) */
  TIP_DEPTH_LEFT: 18,
  TIP_DEPTH_RIGHT: 18,
  /** Tip-box length scales (left mirrors right) */
  TIP_BOX_SCALE_LEFT: 0.964,
  TIP_BOX_SCALE_RIGHT: 0.964,
  /** Center frame for live multiplier (Nx) */
  CENTER: { x: 458, y: 48, w: 100, h: 78 },
};

export const MULTIPLIER = {
  START: 1,
  /**
   * Growth per correct Heads/Paws. Was 2.0 (1→2→4→8→16→32), which hit huge mults too fast.
   * 1.15 keeps typical cashouts around 1.0–1.8× (2× needs ~5 wins in a row).
   */
  WIN_FACTOR: 1.15,
  HISTORY_MAX: 8,
  /** Popup spawn — left side between HUD and player head (below health bar) */
  POPUP_X: 118,
  POPUP_Y: 268,
};

/**
 * Casino house edge on the coin flip.
 * Fair coin would be 50% win chance; EDGE reduces P(win) for the house.
 * First-cashout RTP ≈ WIN_CHANCE × WIN_FACTOR (e.g. 0.475 × 1.15 ≈ 54.6%).
 */
export const HOUSE = {
  /** 5% edge vs a fair even-money coin */
  EDGE: 0.05,
  /** P(player wins this flip) */
  WIN_CHANCE: 0.5 * (1 - 0.05),
};

/** Play-money coin-flip wallet */
export const WALLET = {
  START_BALANCE: 1000,
  MIN_BET: 1,
  MAX_BET: 500,
  DEFAULT_BET: 10,
};
