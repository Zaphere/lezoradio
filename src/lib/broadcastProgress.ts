// Adapter — re-exports from legacy until broadcast tracking moves to `queue_played_items` table.
export {
  loadBroadcastProgress,
  saveBroadcastProgress,
  markItemPlayed,
  clearBroadcastProgress,
  savePlaybackIndex,
  findFirstUnplayedIndex,
  findNextUnplayedIndex,
  hasUnplayedItems,
} from '../_legacy/lib/broadcastProgress';
