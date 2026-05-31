import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * True when `moduleUrl` (pass `import.meta.url`) is the entrypoint the process
 * was launched with. Resolves symlinks first, so it still holds when the module
 * runs via an installed bin — npx, a global install, or `node_modules/.bin` —
 * where `process.argv[1]` is a symlink to the real file and a raw `===` against
 * `fileURLToPath(import.meta.url)` would wrongly be false.
 */
export function isMainModule(moduleUrl: string): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(entry) === fileURLToPath(moduleUrl);
  } catch {
    return false;
  }
}
