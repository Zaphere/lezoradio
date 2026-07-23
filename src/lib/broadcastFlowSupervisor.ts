// Adapter — re-exports from legacy until BFS moves to backend `playbackController.js`.
export {
  BFS_CONFIG,
  STATION_IDS,
  BRIDGE_INTROS,
  pickLine,
  RECOVERY_ORDER,
} from '../_legacy/lib/broadcastFlowSupervisor';
export type { RecoveryStep } from '../_legacy/lib/broadcastFlowSupervisor';
