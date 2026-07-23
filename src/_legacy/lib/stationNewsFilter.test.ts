import { describe, expect, it } from 'vitest';
import { filterNewsForStation } from './stationNewsFilter';

describe('filterNewsForStation', () => {
  it('returns items when station metadata is missing so the feed preview can still render', () => {
    const items = [
      {
        id: '1',
        feed_id: 'feed-1',
        title: 'Congo update',
        description: 'Latest update',
        content: 'Latest update',
        url: 'https://example.com/1',
        region: 'congo',
        category: 'regional',
        published_at: '2026-07-22T10:00:00.000Z',
        ingested_at: '2026-07-22T10:00:00.000Z',
        is_processed: false,
      },
    ];

    const result = filterNewsForStation(items, {
      name: 'Global Channel',
      country: '',
      region: '',
    } as any);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Congo update');
  });
});
