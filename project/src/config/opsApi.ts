import { env } from './env';

// Base URL for the operational panels (Deployed Apps, How It Learned, UI
// Self-Test). These talk to the same backend as the rest of the app (the Qwen
// Cloud backend, VITE_API_URL). VITE_UITEST_API_URL can override for split
// topologies; `||` (not `??`) so a blank value still falls back to the app
// backend instead of proxying to a stale same-origin host.
export const OPS_API: string =
  (import.meta as any).env?.VITE_UITEST_API_URL || env.apiUrl;

export const OPS_WS: string = OPS_API.replace(/^http/, 'ws');
