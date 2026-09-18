import { describe, expect, it } from "vitest";
import { getWorkerStatus } from "../src/main";

describe("worker shell", () => {
  it("starts without pretending that work is configured", () => {
    expect(getWorkerStatus()).toBe("idle");
  });
});
