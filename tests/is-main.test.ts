import { mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isMainModule } from "../src/is-main.js";

// Regression: an installed bin (npx / global / node_modules/.bin) is a SYMLINK,
// so process.argv[1] is the link while import.meta.url is the resolved real file.
// A naive `===` is false there, silently skipping the entrypoint.
describe("isMainModule", () => {
  const savedArgv = process.argv;
  let dir: string;

  beforeEach(() => {
    dir = realpathSync(mkdtempSync(join(tmpdir(), "ismain-")));
  });
  afterEach(() => {
    process.argv = savedArgv;
    rmSync(dir, { recursive: true, force: true });
  });

  it("is true when argv[1] is a symlink to the module's real file", () => {
    const real = join(dir, "real.js");
    writeFileSync(real, "");
    const link = join(dir, "bin-link");
    symlinkSync(real, link);
    process.argv = ["node", link]; // as an installed .bin symlink would be
    expect(isMainModule(pathToFileURL(real).href)).toBe(true);
  });

  it("is true for a direct (non-symlink) path", () => {
    const real = join(dir, "direct.js");
    writeFileSync(real, "");
    process.argv = ["node", real];
    expect(isMainModule(pathToFileURL(real).href)).toBe(true);
  });

  it("is false when argv[1] points at a different file", () => {
    const a = join(dir, "a.js");
    const b = join(dir, "b.js");
    writeFileSync(a, "");
    writeFileSync(b, "");
    process.argv = ["node", a];
    expect(isMainModule(pathToFileURL(b).href)).toBe(false);
  });

  it("is false when there is no entrypoint", () => {
    process.argv = ["node"];
    expect(isMainModule("file:///whatever.js")).toBe(false);
  });
});
