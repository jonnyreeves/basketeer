import type { Session } from "../models.js";

/** Optional 2FA/OTP callback, supplied by the consumer if Tesco demands a code. */
export type OtpProvider = () => Promise<string>;

export interface Credentials {
  username: string;
  password: string;
  otp?: OtpProvider;
}

/**
 * Mints and renews a {@link Session}. v1's confirmed implementation is
 * browser-driven (a real Chrome satisfies Akamai's bot defenses natively);
 * a pure-HTTP backend can drop in behind the same interface if a clean
 * token endpoint is ever found. `login()` credentials are optional because
 * the browser backend collects them in the browser window, not over the wire.
 */
export interface AuthBackend {
  login(credentials?: Credentials): Promise<Session>;
  refresh(session: Session): Promise<Session>;
}
