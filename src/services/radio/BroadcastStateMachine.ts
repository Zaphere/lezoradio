export type BroadcastStateValue =
  | 'IDLE'
  | 'INTRO_MUSIC'
  | 'INTRO_DUCKING'
  | 'HOST_INTRO'
  | 'NEWS_SEGMENT'
  | 'TRANSITION'
  | 'ENTERTAINMENT'
  | 'STOPPING';

const VALID_TRANSITIONS: Record<BroadcastStateValue, BroadcastStateValue[]> = {
  IDLE: ['INTRO_MUSIC', 'NEWS_SEGMENT', 'ENTERTAINMENT'],
  INTRO_MUSIC: ['INTRO_DUCKING', 'STOPPING'],
  INTRO_DUCKING: ['HOST_INTRO', 'STOPPING'],
  HOST_INTRO: ['NEWS_SEGMENT', 'ENTERTAINMENT', 'STOPPING'],
  NEWS_SEGMENT: ['NEWS_SEGMENT', 'TRANSITION', 'ENTERTAINMENT', 'STOPPING'],
  TRANSITION: ['NEWS_SEGMENT', 'ENTERTAINMENT', 'STOPPING'],
  ENTERTAINMENT: ['NEWS_SEGMENT', 'STOPPING'],
  STOPPING: ['IDLE'],
};

export type BroadcastStateChangeCallback = (
  from: BroadcastStateValue,
  to: BroadcastStateValue,
) => void;

export class BroadcastStateMachine {
  private _state: BroadcastStateValue = 'IDLE';
  private listeners: Set<BroadcastStateChangeCallback> = new Set();

  get state(): BroadcastStateValue {
    return this._state;
  }

  get isActive(): boolean {
    return this._state !== 'IDLE';
  }

  get isStopping(): boolean {
    return this._state === 'STOPPING';
  }

  transition(to: BroadcastStateValue): boolean {
    if (this._state === to) return false;

    const allowed = VALID_TRANSITIONS[this._state];
    if (!allowed || !allowed.includes(to)) {
      console.warn(
        `[StateMachine] Invalid transition: ${this._state} -> ${to}. Allowed: ${allowed?.join(', ') || 'none'}`,
      );
      return false;
    }

    const from = this._state;
    this._state = to;
    for (const cb of this.listeners) {
      cb(from, to);
    }
    return true;
  }

  reset(): void {
    if (this._state === 'IDLE') return;
    const from = this._state;
    this._state = 'IDLE';
    for (const cb of this.listeners) {
      cb(from, 'IDLE');
    }
  }

  onChange(cb: BroadcastStateChangeCallback): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  serialize(): BroadcastStateValue {
    return this._state;
  }

  deserialize(state: BroadcastStateValue): void {
    if (VALID_TRANSITIONS[state]) {
      this._state = state;
    } else {
      this._state = 'IDLE';
    }
  }
}
