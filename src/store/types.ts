import type { Session } from "../models.js";

/** Persists the authenticated session between processes. */
export interface TokenStore {
  load(): Promise<Session | null>;
  save(session: Session): Promise<void>;
  clear(): Promise<void>;
}
