// Adapter — re-exports from legacy until channels are read from `station_channels` table.
export {
  CHANNELS,
  GLOBAL_CHANNELS,
  FREQUENCIES,
  FREQ_MAP,
  MIN_FREQ,
  MAX_FREQ,
  snapFrequency,
  getChannel,
  newsCategoryForChannel,
  slugify,
  getGlobalChannelBySlug,
} from '../_legacy/lib/channels';
export type { Channel } from '../_legacy/lib/channels';
