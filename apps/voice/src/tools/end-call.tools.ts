import type { ToolResult } from './index.js';

// Ends the call once the agent has said goodbye.
export function endCall(): ToolResult {
  return { end: true };
}
