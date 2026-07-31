import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { listSceneTemplateContracts } from "../packages/scenes/src/index.js";
import { validateTemplateTheme } from "../packages/theme/src/index.js";

const root = resolve("templates");

describe("scene template catalog", () => {
  it("contains every registered scene template and the shared theme", async () => {
    const contracts = listSceneTemplateContracts();
    expect(contracts).toHaveLength(19);

    for (const contract of contracts) {
      const templateDir = resolve(root, contract.id);
      const [html, portrait, config, meta] = await Promise.all([
        readFile(resolve(templateDir, "index.html"), "utf8"),
        readFile(resolve(templateDir, "compositions/portrait.html"), "utf8"),
        readFile(resolve(templateDir, "hyperframes.json"), "utf8"),
        readFile(resolve(templateDir, "meta.json"), "utf8"),
      ]);
      validateTemplateTheme(html, contract.id);
      validateTemplateTheme(portrait, contract.id);
      if (contract.kind === "quiz") {
        expect(portrait).toContain("countDigit");
        expect(portrait).toContain("countdownDelaySec");
      }
      if (contract.id === "shared-channel-outro") {
        expect(portrait).toContain("logoUrl");
        expect(portrait).toContain("FOLLOW");
        expect(portrait).toContain("THẢ TIM");
      }
      if (contract.kind === "recall_item") {
        expect(portrait).toContain("countDigit");
        expect(portrait).toContain("revealDelaySec");
        expect(portrait).toContain("ĐÁP ÁN");
      }
      expect(() => JSON.parse(config)).not.toThrow();
      expect(() => JSON.parse(meta)).not.toThrow();
    }
  });
});
