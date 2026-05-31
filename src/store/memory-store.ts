import type { Session } from "../models.js";
import type { TokenStore } from "./types.js";

/** In-memory store for tests and serverless single-invocation use. */
export class MemoryTokenStore implements TokenStore {
  private session: Session | null;

  constructor(initial: Session | null = null) {
    this.session = initial;
  }

  async load(): Promise<Session | null> {
    return this.session;
  }

  async save(session: Session): Promise<void> {
    this.session = session;
  }

  async clear(): Promise<void> {
    this.session = null;
  }
}
