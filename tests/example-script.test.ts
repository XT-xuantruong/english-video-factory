import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { validateScript } from "../packages/quality/src/index.js";

describe("bundled vocabulary example", () => {
  it("matches the v3 script, blueprint and scene contracts", async () => {
    const raw = JSON.parse(
      await readFile("examples/vocabulary-spelling-script.json", "utf8"),
    ) as unknown;
    const script = await validateScript(raw);
    expect(script.version).toBe("3.2");
    expect(script.blueprintId).toBe("vocabulary-spelling");
    expect(script.scenes.map((scene) => scene.kind)).toEqual([
      "intro",
      "word",
      "examples",
      "quiz",
      "answer",
      "outro",
    ]);
  });
});
