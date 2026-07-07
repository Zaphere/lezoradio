import type { BroadcastItem } from '../../lib/types';

// Priority constants (1 = highest, 10 = lowest)
export const PRIORITY = {
  INSTITUTIONAL_ALERT: 1,
  FATAL_ACCIDENT: 2,
  MAJOR_INCIDENT: 3,
  SEVERE_INCIDENT: 4,
  HEAVY_TRAFFIC: 5,
  ROAD_WORK: 6,
  TRANSPORT_UPDATE: 7,
  REGULAR_NEWS: 6,
  WEATHER_ALERT: 3,
  EMERGENCY: 2,
  DEFAULT: 6,
  LOW_PRIORITY: 10,
} as const;

export class BroadcastQueue {
  private _items: BroadcastItem[] = [];

  enqueue(items: BroadcastItem[]): void {
    this._items.push(...items);
    this._items.sort((a, b) => a.priority - b.priority);
  }

  dequeue(): BroadcastItem | null {
    return this._items.shift() || null;
  }

  peek(): BroadcastItem | null {
    return this._items[0] || null;
  }

  skip(): BroadcastItem | null {
    this._items.shift();
    return this.dequeue();
  }

  remove(id: string): void {
    this._items = this._items.filter((item) => item.id !== id);
  }

  clear(): void {
    this._items = [];
  }

  get length(): number {
    return this._items.length;
  }

  get items(): BroadcastItem[] {
    return [...this._items];
  }
}
