import type { BroadcastItem } from '../../lib/types';

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
