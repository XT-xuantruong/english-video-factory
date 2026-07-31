import { describe, expect, it } from "vitest";
import { VocabularyContentSchema } from "../packages/domain/src/index.js";
import { composeScript } from "../packages/scripting/src/index.js";
import { validateImprovedScript } from "../packages/quality/src/index.js";

const content = VocabularyContentSchema.parse({
  id: "rapid-antonym",
  contentType: "vocabulary",
  word: "rapid",
  ipa: "/ˈræpɪd/",
  meaningVi: "nhanh",
  usageVi: "Dùng cho thay đổi xảy ra trong thời gian ngắn.",
  examples: [
    { sentenceEn: "The city saw rapid growth.", meaningVi: "Thành phố tăng trưởng nhanh." },
    { sentenceEn: "Change was rapid.", meaningVi: "Sự thay đổi diễn ra nhanh." },
  ],
  quiz: {
    type: "antonym",
    question: "Từ nào trái nghĩa với rapid?",
    options: ["slow", "quick", "careful"],
    answer: "slow",
    explanationVi: "Slow là từ trái nghĩa phù hợp với rapid.",
    countdownSec: 5,
  },
});

describe("validateImprovedScript", () => {
  it("allows only text changes on rewritable segments", async () => {
    const base = composeScript(content);
    const improved = structuredClone(base);
    const target = improved.scenes
      .flatMap((scene) => scene.audioSegments)
      .find((segment) => segment.rewritable);
    expect(target).toBeTruthy();
    target!.text = "Hãy thử chọn đáp án phù hợp nhất nhé.";
    const report = await validateImprovedScript(base, improved);
    expect(report.changedSegments).toBe(1);
  });

  it("rejects template changes", async () => {
    const base = composeScript(content);
    const invalid = structuredClone(base);
    invalid.scenes[3]!.templateId = "shared-intro";
    await expect(validateImprovedScript(base, invalid)).rejects.toThrow();
  });

  it("rejects changes to locked English segments", async () => {
    const base = composeScript(content);
    const invalid = structuredClone(base);
    const english = invalid.scenes
      .flatMap((scene) => scene.audioSegments)
      .find((segment) => segment.language === "en");
    english!.text = "changed";
    await expect(validateImprovedScript(base, invalid)).rejects.toThrow(/rewritable=false/);
  });
});
