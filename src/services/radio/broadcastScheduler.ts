import type { BroadcastItem, FrenchBulletinSlot } from '../../lib/types';
import {
  FRENCH_BULLETIN_PRIORITY,
  getFrenchBulletinSlot,
  getNextBulletinSlot,
} from '../../lib/frenchBulletin';

export type ScheduledEventCallback = (event: ScheduledEvent) => void;

export interface ScheduledEvent {
  type: 'french_bulletin' | 'normal';
  slot: FrenchBulletinSlot | null;
  timestamp: number;
  stationTimezone: string;
}

export class BroadcastScheduler {
  private timezone: string;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private checkIntervalMs: number;
  private onFrenchBulletin: ScheduledEventCallback | null = null;
  private lastTriggeredSlotKey: string = '';
  private _nextBulletinTime: string = '--:--';
  private _currentSlot: FrenchBulletinSlot | null = null;
  private _isBulletinWindow: boolean = false;

  constructor(timezone: string, checkIntervalMs = 15000) {
    this.timezone = timezone;
    this.checkIntervalMs = checkIntervalMs;
    this._nextBulletinTime = getNextBulletinSlot(timezone)
      ? `${String(getNextBulletinSlot(timezone)!.hour).padStart(2, '0')}:${String(getNextBulletinSlot(timezone)!.minute).padStart(2, '0')}`
      : '--:--';
  }

  setTimezone(timezone: string): void {
    this.timezone = timezone;
    this._nextBulletinTime = getNextBulletinSlot(timezone)
      ? `${String(getNextBulletinSlot(timezone)!.hour).padStart(2, '0')}:${String(getNextBulletinSlot(timezone)!.minute).padStart(2, '0')}`
      : '--:--';
  }

  onFrenchBulletinTrigger(callback: ScheduledEventCallback): void {
    this.onFrenchBulletin = callback;
  }

  start(): void {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => this.tick(), this.checkIntervalMs);
    this.tick();
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private tick(): void {
    const slot = getFrenchBulletinSlot(this.timezone);
    this._isBulletinWindow = slot !== null;
    this._currentSlot = slot;

    const next = getNextBulletinSlot(this.timezone);
    this._nextBulletinTime = next
      ? `${String(next.hour).padStart(2, '0')}:${String(next.minute).padStart(2, '0')}`
      : '--:--';

    if (slot) {
      const slotKey = `${slot.hour}:${slot.minute}`;
      if (this.lastTriggeredSlotKey !== slotKey) {
        this.lastTriggeredSlotKey = slotKey;
        this.onFrenchBulletin?.({
          type: 'french_bulletin',
          slot,
          timestamp: Date.now(),
          stationTimezone: this.timezone,
        });
      }
    }
  }

  get nextBulletinTime(): string {
    return this._nextBulletinTime;
  }

  get currentSlot(): FrenchBulletinSlot | null {
    return this._currentSlot;
  }

  get isBulletinWindow(): boolean {
    return this._isBulletinWindow;
  }

  enqueue(items: BroadcastItem[]): void {
    const slot = getFrenchBulletinSlot(this.timezone);
    if (slot) {
      const bulletinItem: BroadcastItem = {
        id: `french-bulletin-${slot.hour}-${Date.now()}`,
        title: `French Bulletin — ${slot.hour}:00`,
        body: '',
        type: 'news',
        priority: FRENCH_BULLETIN_PRIORITY,
        station: '',
        region: '',
        language: 'fr',
        source: 'french_bulletin',
        publishedAt: new Date().toISOString(),
        metadata: { bulletinHour: slot.hour, isGlobalBulletin: true },
      };
      items.unshift(bulletinItem);
    }
    // Items would normally be passed to the queue
  }
}
