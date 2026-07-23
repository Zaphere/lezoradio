import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSupabaseFrom } = vi.hoisted(() => ({
  mockSupabaseFrom: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockSupabaseFrom,
  })),
}));

import { fetchNewsItems } from './supabase';

describe('supabase content proxy', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
    });
  });

  it('uses the backend content proxy when available', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{
        id: '1',
        title: 'Proxy news item',
        description: 'Proxy description',
        content: 'Proxy content',
        url: 'https://example.com',
        region: 'global',
        category: 'news',
        published_at: new Date().toISOString(),
        ingested_at: new Date().toISOString(),
        is_processed: false,
      }],
    });

    vi.stubGlobal('fetch', fetchSpy);

    const result = await fetchNewsItems(undefined, 'global');

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Proxy news item');
    expect(fetchSpy).toHaveBeenCalled();
  });
});
