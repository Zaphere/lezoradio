import type { BroadcastItem, BroadcastScript } from '../../lib/types';
import type { IScriptGenerator } from '../../lib/types';

export type { IScriptGenerator };

// Placeholder: real AI script generation will be implemented in Phase 2
export class ScriptGenerator implements IScriptGenerator {
  async generate(_items: BroadcastItem[]): Promise<BroadcastScript> {
    return { segments: [] };
  }
}
