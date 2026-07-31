import { describe, expect, it } from "vitest";
import {
  VocabularyContentSchema,
  VocabularyRecallContentSchema,
} from "../packages/domain/src/index.js";
import {
  composeScript,
  composeVocabularyRecallScript,
  quizInstruction,
} from "../packages/scripting/src/index.js";
import { validateScript } from "../packages/quality/src/index.js";

const content = VocabularyContentSchema.parse({
  id: "resilient-spelling",
  contentType: "vocabulary",
  enabled: true,
  status: "ready",
  level: "B1",
  topic: "Personal growth",
  word: "resilient",
  ipa: "/rɪˈzɪliənt/",
  partOfSpeech: "adjective",
  meaningVi: "kiên cường, có khả năng phục hồi",
  usageVi: "Dùng để mô tả khả năng vượt qua khó khăn.",
  examples: [
    {
      sentenceEn: "She remained resilient after the failure.",
      meaningVi: "Cô ấy vẫn kiên cường sau thất bại.",
      explanationVi: "Dùng để nói về khả năng vượt qua khó khăn.",
    },
    {
      sentenceEn: "The local economy proved resilient.",
      meaningVi: "Nền kinh tế địa phương cho thấy khả năng phục hồi tốt.",
      explanationVi: "Có thể dùng cho tổ chức hoặc hệ thống.",
    },
  ],
  quiz: {
    type: "spelling",
    question: "Đâu là cách viết đúng?",
    options: ["resilient", "resilent", "resiliant", "resillent"],
    answer: "resilient",
    explanationVi: "Cách viết đúng có phần -ient ở cuối.",
    countdownSec: 7,
  },
});

function vocabularyItem(id: string, word: string, meaningVi: string) {
  return VocabularyContentSchema.parse({
    ...content,
    id,
    word,
    meaningVi,
    ipa: `/${word}/`,
    quiz: {
      ...content.quiz,
      question: `Đâu là cách viết đúng của ${word}?`,
      options: [word, `${word}x`],
      answer: word,
    },
  });
}

describe("composeScript", () => {
  it("uses the quiz-specific fixed blueprint and six scenes", () => {
    const script = composeScript(content);
    expect(script.version).toBe("3.2.1");
    expect(script.videoType).toBe("single_word");
    expect(script.blueprintId).toBe("vocabulary-spelling");
    expect(script.scenes.map((scene) => scene.kind)).toEqual([
      "intro",
      "word",
      "examples",
      "quiz",
      "answer",
      "outro",
    ]);
    expect(script.scenes[3]?.templateId).toBe("vocabulary-quiz-spelling");
    expect(script.scenes[4]?.templateId).toBe("vocabulary-answer-spelling");
    expect(script.scenes[0]?.inputs.hook).toBe("Hôm nay mình cùng tìm hiểu về từ này nhá.");
  });

  it("uses a specific spelling instruction", () => {
    const script = composeScript(content);
    expect(quizInstruction("spelling")).toBe(
      "Hãy chọn cách viết đúng chính tả của từ sau đây.",
    );
    expect(script.scenes[3]?.audioSegments[1]?.text).toBe(
      "Hãy chọn cách viết đúng chính tả của từ sau đây.",
    );
    expect(script.scenes[3]?.audioSegments[1]?.rewritable).toBe(false);
  });

  it("supports quiz countdown pauses up to ten seconds", () => {
    const maxCountdownContent = VocabularyContentSchema.parse({
      ...content,
      id: "resilient-spelling-ten-seconds",
      quiz: {
        ...content.quiz,
        countdownSec: 10,
      },
    });
    const script = composeScript(maxCountdownContent);
    expect(script.scenes[3]?.audioSegments.at(-1)?.pauseAfterMs).toBe(10000);
  });

  it("locks English source segments and marks only selected Vietnamese narration rewriteable", () => {
    const script = composeScript(content);
    const segments = script.scenes.flatMap((scene) => scene.audioSegments);
    expect(
      segments
        .filter((segment) => segment.language === "en")
        .every((segment) => !segment.rewritable),
    ).toBe(true);
    expect(
      segments.some((segment) => segment.language === "vi" && segment.rewritable),
    ).toBe(true);
  });
});

describe("composeVocabularyRecallScript", () => {
  it("creates intro, five recall scenes, a spoken summary and a channel outro", async () => {
    const vocabulary = [
      vocabularyItem("word-one", "efficient", "hiệu quả"),
      vocabularyItem("word-two", "resilient", "kiên cường"),
      vocabularyItem("word-three", "sustainable", "bền vững"),
      vocabularyItem("word-four", "maintain", "duy trì"),
      vocabularyItem("word-five", "capability", "khả năng"),
    ];
    const recall = VocabularyRecallContentSchema.parse({
      id: "daily-recall-01",
      contentType: "vocabulary_recall",
      enabled: true,
      status: "ready",
      level: "B1",
      topic: "Vocabulary recall",
      wordIds: vocabulary.map((item) => item.id),
      countdownSec: 7,
    });

    const script = composeVocabularyRecallScript(recall, vocabulary);
    await expect(validateScript(script)).resolves.toMatchObject({ videoType: "meaning_recall" });
    expect(script.videoType).toBe("meaning_recall");
    expect(script.blueprintId).toBe("vocabulary-meaning-recall");
    expect(script.scenes).toHaveLength(8);
    expect(script.scenes.map((scene) => scene.kind)).toEqual([
      "intro",
      "recall_item",
      "recall_item",
      "recall_item",
      "recall_item",
      "recall_item",
      "summary",
      "outro",
    ]);

    const itemScenes = script.scenes.filter((scene) => scene.kind === "recall_item");
    expect(itemScenes).toHaveLength(5);
    for (const [index, scene] of itemScenes.entries()) {
      expect(scene.audioSegments).toHaveLength(1);
      expect(scene.audioSegments[0]).toMatchObject({
        language: "en",
        text: vocabulary[index]?.word,
        pauseBeforeMs: 7000,
        rewritable: false,
      });
    }
    const summary = script.scenes.at(-2)!;
    expect(summary.kind).toBe("summary");
    expect(summary.inputs.items).toEqual(
      vocabulary.map((item) => ({ word: item.word, meaningVi: item.meaningVi })),
    );
    expect(summary.audioSegments).toHaveLength(11);
    vocabulary.forEach((item, index) => {
      expect(summary.audioSegments[index * 2 + 1]).toMatchObject({
        language: "en",
        text: item.word,
        rewritable: false,
      });
      expect(summary.audioSegments[index * 2 + 2]).toMatchObject({
        language: "vi",
        text: `${item.meaningVi}.`,
        rewritable: false,
      });
    });

    const outro = script.scenes.at(-1)!;
    expect(outro).toMatchObject({
      kind: "outro",
      role: "outro",
      templateId: "shared-channel-outro",
    });
    expect(outro.inputs.cta).toBe(
      "Hãy follow kênh và thả tim để cập nhật thêm nhiều bài học mới nhé.",
    );
    expect(outro.audioSegments).toHaveLength(1);
  });
});
