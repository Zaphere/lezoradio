// @deprecated — archived in Phase 1 (2026-07-14). Config values now in database tables. See docs/DATABASE_ARCHITECTURE.md.
export const TIMING = {
  INTRO_CUE_PERCENT: 0.85,
  INTRO_DUCK_DURATION: 500,        // Duck background smoothly before voice starts
  HOST_FADE_IN_DURATION: 400,     // Faster host fade in
  HOST_DELAY_AFTER_DUCK: 200,     // Minimal delay after duck
  BACKGROUND_FADE_IN: 800,        // Slower restore so background doesn't jump up
  BACKGROUND_FADE_OUT: 500,       // Faster background fade out
  OUTRO_FADE_DURATION: 800,       // Faster outro fade
  STOP_FADE_DURATION: 500,        // Faster stop fade
  TRANSITION_GAP_MS: 200,         // Minimal gap between transitions
  CROSSFADE_DURATION: 500,        // Faster crossfade
  FADE_STEP_MS: 20,               // Smoother, faster fade steps
  FULL_VOLUME: 1.0,
  BACKGROUND_VOLUME: 0.10,        // Ambient bed: very quiet under presenters
  DUCKED_BACKGROUND_VOLUME: 0.03, // Near-silent when voice is active
  BACKGROUND_FILL_VOLUME: 0.42,
  ENTERTAINMENT_DELAY_MS: 3000,   // Much shorter entertainment delay
  BROADCAST_SEGMENT_MS: 270000,
  POLL_INTERVAL_MS: 15000,
  PRE_TRACK_GAP_MS: 0,            // No gap - immediate transitions
} as const;
