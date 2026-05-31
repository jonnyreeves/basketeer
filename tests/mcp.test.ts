import { describe, expect, it } from "vitest";
import { buildServer, confirmToken } from "../src/mcp-server.js";

describe("confirmToken", () => {
  it("is deterministic for the same input", () => {
    expect(confirmToken("cancel:12345")).toBe(confirmToken("cancel:12345"));
  });

  it("returns 8 lowercase hex characters", () => {
    expect(confirmToken("checkout:3:42.5")).toMatch(/^[0-9a-f]{8}$/);
  });

  it("maps different inputs to different tokens", () => {
    expect(confirmToken("cancel:1")).not.toBe(confirmToken("cancel:2"));
    expect(confirmToken("cancel:1")).not.toBe(confirmToken("checkout:1"));
  });
});

describe("buildServer", () => {
  it("is a function exported for wiring/tests", () => {
    expect(typeof buildServer).toBe("function");
  });
});
