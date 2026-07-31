import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { validateScript } from "../packages/quality/src/index.js";

describe("bundled vocabulary recall example", () => {
  it("matches the fixed five-item recall blueprint", async () => {
    const raw = JSON.parse(
      await readFile("examples/vocabulary-recall-script.json", "utf8"),
    ) as unknown;
    const script = await validateScript(raw);
    expect(script.videoType).toBe("meaning_recall");
    expect(script.scenes).toHaveLength(8);
    expect(script.scenes.filter((scene) => scene.kind === "recall_item")).toHaveLength(5);
  });
});
