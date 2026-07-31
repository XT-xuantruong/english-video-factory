import { describe, expect, it } from "vitest";
import { buildSrt } from "../packages/captions/src/index.js";

describe("buildSrt", () => {
  it("writes stable SRT timestamps", () => {
    const srt = buildSrt([
      { text: "Xin chào", startSec: 0, durationSec: 1.25 },
      { text: "Hello", startSec: 1.5, durationSec: 0.8 },
    ]);
    expect(srt).toContain("00:00:00,000 --> 00:00:01,250");
    expect(srt).toContain("00:00:01,500 --> 00:00:02,300");
  });
});
