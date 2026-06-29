import type { ITTSProvider, BroadcastItem, PlaybackState } from '../../lib/types';
import { BroadcastQueue } from './broadcastQueue';

export class RadioEngine {
  private tts: ITTSProvider;
  private queue: BroadcastQueue;
  private _state: PlaybackState = 'idle';
  private _currentItem: BroadcastItem | null = null;
  private introSpoken = false;

  onItemStart?: (item: BroadcastItem) => void;
  onItemEnd?: (item: BroadcastItem) => void;
  onProgress?: (item: BroadcastItem, percentage: number) => void;
  onEmpty?: () => void;

  constructor(tts: ITTSProvider) {
    this.tts = tts;
    this.queue = new BroadcastQueue();
    this.tts.onEnd = () => this.handleEnd();
  }

  enqueue(items: BroadcastItem[]): void {
    this.queue.enqueue(items);
  }

  play(): void {
    if (this._state === 'speaking') return;
    if (this.queue.length === 0 && !this._currentItem) {
      this.onEmpty?.();
      return;
    }

    this._state = 'speaking';

    if (!this.introSpoken) {
      this.introSpoken = true;
      const intro = this.getIntro();
      this.tts.speak(intro);
      return;
    }

    this.playNext();
  }

  pause(): void {
    this.tts.pause();
    this._state = 'paused';
  }

  resume(): void {
    this.tts.resume();
    this._state = 'speaking';
  }

  stop(): void {
    this.tts.stop();
    this.queue.clear();
    this._currentItem = null;
    this._state = 'idle';
    this.introSpoken = false;
  }

  skip(): void {
    this.tts.stop();
    const next = this.queue.skip();
    if (next) {
      this._currentItem = next;
      this.onItemStart?.(next);
      this.tts.speak(this.formatItem(next));
    } else {
      this._currentItem = null;
      this._state = 'idle';
      this.introSpoken = false;
      this.onEmpty?.();
    }
  }

  interrupt(item: BroadcastItem): void {
    this.tts.stop();
    this.queue.enqueue([item]);
    if (this._state !== 'idle') {
      this._currentItem = item;
      this.onItemStart?.(item);
      this.tts.speak(this.formatItem(item));
    }
  }

  get state(): PlaybackState {
    return this._state;
  }

  get currentItem(): BroadcastItem | null {
    return this._currentItem;
  }

  private handleEnd(): void {
    if (this._currentItem) {
      this.onItemEnd?.(this._currentItem);
    }

    if (!this.introSpoken) {
      this.play();
      return;
    }

    const next = this.queue.dequeue();
    if (next) {
      this._currentItem = next;
      this.onItemStart?.(next);
      this.tts.speak(this.formatItem(next));
    } else {
      this._currentItem = null;
      this._state = 'idle';
      this.introSpoken = false;
      this.onEmpty?.();
    }
  }

  private playNext(): void {
    const next = this.queue.dequeue();
    if (next) {
      this._currentItem = next;
      this.onItemStart?.(next);
      this.tts.speak(this.formatItem(next));
    } else {
      this._currentItem = null;
      this._state = 'idle';
      this.introSpoken = false;
      this.onEmpty?.();
    }
  }

  private getIntro(): string {
    return 'Welcome to Africa AI Radio. Here are todays headlines.';
  }

  private formatItem(item: BroadcastItem): string {
    return `${item.title}. ${item.body}`;
  }
}
