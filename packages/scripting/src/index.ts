import {
  VideoScriptSchema,
  type AudioSegment,
  type Scene,
  type VideoScript,
  type VocabularyContent,
  type VocabularyQuizType,
  type VocabularyRecallContent,
  type VocabularyRecallItem,
} from "../../domain/src/index.js";
import {
  resolveVocabularyBlueprint,
  vocabularyRecallBlueprint,
  type VocabularyBlueprint,
  type BlueprintSceneStep,
} from "../../blueprints/src/index.js";

const BRAND = process.env.BRAND_NAME ?? "English Mỗi Ngày";
const SERIES_LABEL = process.env.SERIES_LABEL ?? "TỪ VỰNG MỖI NGÀY";
const INTRO_NARRATION = "Hôm nay mình cùng tìm hiểu về từ này nhá.";
const RECALL_INTRO_NARRATION = "Hôm nay mình cùng ôn nhanh năm từ vựng nhé.";
const OUTRO_HANDLE = process.env.OUTRO_HANDLE ?? "Theo dõi · Lưu · Ôn lại";
const RECALL_OUTRO_CTA =
  process.env.RECALL_OUTRO_CTA ??
  "Hãy follow kênh và thả tim để cập nhật thêm nhiều bài học mới nhé.";
const CHANNEL_LOGO_URL = process.env.CHANNEL_LOGO_URL ?? "";
const CHANNEL_LOGO_TEXT = process.env.CHANNEL_LOGO_TEXT ?? "EMN";
const OUTRO_CTA =
  process.env.OUTRO_CTA ??
  "Hãy đặt một câu với từ vừa học trong phần bình luận nhé.";
const ENGLISH_RATE = process.env.SCRIPT_ENGLISH_RATE ?? "-12%";

export interface ComposeScriptOptions {
  excelPath?: string;
  blueprintId?: string;
}

export interface ComposeRecallScriptOptions {
  excelPath?: string;
}

class ScriptBuilder {
  private sequence = 0;

  constructor(private readonly sceneId: string) {}

  audio(
    language: "vi" | "en",
    text: string,
    options: {
      pauseBeforeMs?: number;
      pauseAfterMs?: number;
      rewritable?: boolean;
      sourceField?: string;
      displayText?: string;
      voice?: string;
      style?: AudioSegment["style"];
      rate?: string;
      pitch?: string;
    } = {},
  ): AudioSegment {
    return {
      id: `${this.sceneId}-audio-${++this.sequence}`,
      language,
      text: text.trim(),
      displayText: options.displayText,
      pauseBeforeMs: options.pauseBeforeMs ?? 0,
      pauseAfterMs: options.pauseAfterMs ?? 260,
      rewritable: options.rewritable ?? false,
      sourceField: options.sourceField,
      voice: options.voice,
      style: options.style,
      rate: options.rate,
      pitch: options.pitch,
    };
  }
}

function scene(
  step: BlueprintSceneStep,
  inputs: Record<string, unknown>,
  audioSegments: AudioSegment[],
  minDurationSec: number,
): Scene {
  return {
    id: step.id,
    role: step.role,
    kind: step.kind,
    templateId: step.templateId,
    inputs,
    audioSegments,
    minDurationSec,
    transition: "cut",
  };
}

function withoutTrailingPunctuation(value: string): string {
  return value.trim().replace(/[.!?…]+$/u, "");
}

function withPeriod(value: string): string {
  const normalized = value.trim();
  return /[.!?…]$/u.test(normalized) ? normalized : `${normalized}.`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function smoothVietnameseQuizExplanation(content: VocabularyContent): string {
  let text = content.quiz.explanationVi.trim();
  text = text.replace(
    new RegExp(`\\b${escapeRegExp(content.word)}\\b`, "giu"),
    "từ vừa học",
  );

  if (answerLanguage(content.quiz.type) === "en" && content.quiz.answer !== content.word) {
    text = text.replace(
      new RegExp(escapeRegExp(content.quiz.answer), "giu"),
      "đáp án này",
    );
  }

  text = text.replace(/-([a-z]{2,8})\b/giu, (_, letters: string) =>
    letters.split("").join(", "),
  );
  return withPeriod(text);
}

function smoothUsage(value: string): string {
  const normalized = withoutTrailingPunctuation(value);
  if (/^dùng để\b/iu.test(normalized)) {
    return withPeriod(normalized.replace(/^dùng để\b/iu, "Nó được dùng để"));
  }
  if (/^dùng khi\b/iu.test(normalized)) {
    return withPeriod(normalized.replace(/^dùng khi\b/iu, "Nó được dùng khi"));
  }
  if (/^được dùng\b/iu.test(normalized)) {
    return withPeriod(`Nó ${normalized.toLocaleLowerCase("vi-VN")}`);
  }
  return withPeriod(normalized);
}

function answerLanguage(quizType: VocabularyQuizType): "vi" | "en" {
  return quizType === "meaning" ? "vi" : "en";
}

function answerIndex(content: VocabularyContent): number {
  const index = content.quiz.options.indexOf(content.quiz.answer);
  if (index < 0) throw new Error(`Quiz answer không nằm trong options của '${content.id}'`);
  return index;
}

/** Specific instructions make the exercise clear instead of using one generic sentence. */
export function quizInstruction(quizType: VocabularyQuizType): string {
  const instructions: Record<VocabularyQuizType, string> = {
    spelling: "Hãy chọn cách viết đúng chính tả của từ sau đây.",
    fill_blank: "Hãy chọn từ phù hợp để điền vào chỗ trống.",
    meaning: "Hãy chọn nghĩa tiếng Việt đúng của từ vừa học.",
    antonym: "Hãy chọn từ trái nghĩa phù hợp với từ vừa học.",
    pronunciation: "Hãy chọn cách phát âm đúng của từ sau đây.",
    correct_sentence: "Hãy chọn câu sử dụng từ đúng ngữ cảnh.",
  };
  return instructions[quizType];
}

function buildIntro(step: BlueprintSceneStep, content: VocabularyContent): Scene {
  const builder = new ScriptBuilder(step.id);
  return scene(
    step,
    {
      seriesLabel: SERIES_LABEL,
      hook: INTRO_NARRATION,
      previewText: content.word,
      level: content.level,
      topic: content.topic,
      brand: BRAND,
    },
    [
      builder.audio("vi", INTRO_NARRATION, {
        pauseAfterMs: 360,
        rewritable: false,
        sourceField: "generated.intro",
      }),
    ],
    5,
  );
}

function buildWord(step: BlueprintSceneStep, content: VocabularyContent): Scene {
  const builder = new ScriptBuilder(step.id);
  return scene(
    step,
    {
      label: "TỪ VỰNG HÔM NAY",
      word: content.word,
      ipa: content.ipa,
      partOfSpeech: content.partOfSpeech,
      meaningVi: content.meaningVi,
      usageVi: content.usageVi,
      brand: BRAND,
    },
    [
      builder.audio("en", content.word, {
        pauseAfterMs: 420,
        sourceField: "word",
        rate: ENGLISH_RATE,
      }),
      builder.audio(
        "vi",
        `Từ này có nghĩa là ${withoutTrailingPunctuation(content.meaningVi)}.`,
        {
          pauseAfterMs: 300,
          sourceField: "meaning_vi",
        },
      ),
      builder.audio("vi", smoothUsage(content.usageVi), {
        pauseAfterMs: 420,
        sourceField: "usage_vi",
      }),
    ],
    10,
  );
}

function buildExamples(step: BlueprintSceneStep, content: VocabularyContent): Scene {
  const builder = new ScriptBuilder(step.id);
  const audio: AudioSegment[] = [
    builder.audio("vi", "Sau đây là một số ví dụ nhé.", {
      pauseAfterMs: 320,
      rewritable: true,
      sourceField: "generated.examples_lead_in",
    }),
  ];

  content.examples.forEach((example, index) => {
    audio.push(
      builder.audio("en", example.sentenceEn, {
        pauseAfterMs: 320,
        sourceField: `examples[${index}].sentence_en`,
        rate: ENGLISH_RATE,
      }),
      builder.audio(
        "vi",
        `Câu này có nghĩa là ${withoutTrailingPunctuation(example.meaningVi)}.`,
        {
          pauseAfterMs: example.explanationVi ? 250 : 460,
          sourceField: `examples[${index}].meaning_vi`,
        },
      ),
    );
    if (example.explanationVi) {
      audio.push(
        builder.audio("vi", withPeriod(example.explanationVi), {
          pauseAfterMs: 520,
          sourceField: `examples[${index}].explanation_vi`,
        }),
      );
    }
  });

  return scene(
    step,
    {
      label: "VÍ DỤ THỰC TẾ",
      word: content.word,
      examples: content.examples,
      brand: BRAND,
    },
    audio,
    content.examples.length === 3 ? 21 : 16,
  );
}

function buildQuiz(
  step: BlueprintSceneStep,
  blueprint: VocabularyBlueprint,
  content: VocabularyContent,
): Scene {
  const builder = new ScriptBuilder(step.id);
  const instruction = quizInstruction(content.quiz.type);
  const commentPrompt =
    "Bạn nghĩ đáp án là gì? Hãy bình luận câu trả lời trước khi xem đáp án nhé.";
  return scene(
    step,
    {
      label: blueprint.quizLabel,
      question: content.quiz.question,
      instruction,
      options: content.quiz.options,
      countdownSec: content.quiz.countdownSec,
      commentPrompt,
      brand: BRAND,
    },
    [
      builder.audio("vi", "Tiếp theo, mình cùng làm một bài tập nhỏ nhé.", {
        pauseAfterMs: 300,
        rewritable: true,
        sourceField: "generated.quiz_lead_in",
      }),
      builder.audio("vi", instruction, {
        pauseAfterMs: 260,
        rewritable: false,
        sourceField: "generated.quiz_instruction",
      }),
      builder.audio("vi", commentPrompt, {
        pauseAfterMs: content.quiz.countdownSec * 1000,
        rewritable: true,
        sourceField: "generated.quiz_comment_prompt",
      }),
    ],
    content.quiz.countdownSec + 7,
  );
}

function buildAnswer(
  step: BlueprintSceneStep,
  blueprint: VocabularyBlueprint,
  content: VocabularyContent,
): Scene {
  const builder = new ScriptBuilder(step.id);
  const language = answerLanguage(content.quiz.type);
  const answerText =
    content.quiz.type === "pronunciation" ? content.word : content.quiz.answer;

  return scene(
    step,
    {
      label: blueprint.answerLabel,
      question: content.quiz.question,
      options: content.quiz.options,
      answer: content.quiz.answer,
      answerIndex: answerIndex(content),
      explanationVi: content.quiz.explanationVi,
      word: content.word,
      brand: BRAND,
    },
    [
      builder.audio("vi", "Đáp án đúng là:", {
        pauseAfterMs: 220,
        rewritable: true,
        sourceField: "generated.answer_lead_in",
      }),
      builder.audio(language, answerText, {
        pauseAfterMs: 360,
        sourceField:
          content.quiz.type === "pronunciation" ? "word" : "quiz_answer",
        rate: language === "en" ? ENGLISH_RATE : undefined,
      }),
      builder.audio("vi", smoothVietnameseQuizExplanation(content), {
        pauseAfterMs: 420,
        sourceField: "quiz_explanation_vi",
      }),
    ],
    8,
  );
}

function buildOutro(step: BlueprintSceneStep, content: VocabularyContent): Scene {
  const builder = new ScriptBuilder(step.id);
  return scene(
    step,
    {
      recapTitle: content.word,
      recapText: content.meaningVi,
      cta: OUTRO_CTA,
      brand: BRAND,
      handle: OUTRO_HANDLE,
    },
    [
      builder.audio("en", content.word, {
        pauseAfterMs: 320,
        sourceField: "word",
        rate: ENGLISH_RATE,
      }),
      builder.audio("vi", OUTRO_CTA, {
        pauseAfterMs: 0,
        rewritable: true,
        sourceField: "generated.outro_cta",
      }),
    ],
    6,
  );
}

function blankForWord(word: string): string {
  return Array.from(word)
    .map((character) => (/\p{L}/u.test(character) ? "_" : character))
    .join(" ");
}

function resolveRecallItems(
  recall: VocabularyRecallContent,
  vocabulary: VocabularyContent[],
): VocabularyRecallItem[] {
  const byId = new Map(vocabulary.map((item) => [item.id, item]));
  return recall.wordIds.map((id) => {
    const item = byId.get(id);
    if (!item) {
      throw new Error(
        `vocabulary_recall '${recall.id}' tham chiếu word id '${id}' không tồn tại trong sheet vocabulary`,
      );
    }
    if (!item.enabled) {
      throw new Error(
        `vocabulary_recall '${recall.id}' tham chiếu word id '${id}' đang disabled`,
      );
    }
    return {
      id: item.id,
      word: item.word,
      ipa: item.ipa,
      meaningVi: item.meaningVi,
    };
  });
}

function buildRecallIntro(
  step: BlueprintSceneStep,
  content: VocabularyRecallContent,
): Scene {
  const builder = new ScriptBuilder(step.id);
  return scene(
    step,
    {
      seriesLabel: "ĐOÁN TỪ TIẾNG ANH",
      hook: RECALL_INTRO_NARRATION,
      previewText: "5 TỪ VỰNG",
      level: content.level,
      topic: content.topic,
      brand: BRAND,
    },
    [
      builder.audio("vi", RECALL_INTRO_NARRATION, {
        pauseAfterMs: 350,
        rewritable: false,
        sourceField: "generated.recall_intro",
      }),
    ],
    5,
  );
}

function buildRecallItem(
  step: BlueprintSceneStep,
  item: VocabularyRecallItem,
  index: number,
  countdownSec: number,
): Scene {
  const builder = new ScriptBuilder(step.id);
  return scene(
    step,
    {
      label: `TỪ ${index + 1} / 5`,
      meaningVi: item.meaningVi,
      blankText: blankForWord(item.word),
      word: item.word,
      ipa: item.ipa,
      countdownSec,
      itemIndex: index + 1,
      itemTotal: 5,
      brand: BRAND,
    },
    [
      // No Vietnamese answer lead-in. After the countdown, Edge TTS reads only the English word.
      builder.audio("en", item.word, {
        pauseBeforeMs: countdownSec * 1000,
        pauseAfterMs: 900,
        rewritable: false,
        sourceField: `vocabulary.${item.id}.word`,
        rate: ENGLISH_RATE,
      }),
    ],
    countdownSec + 3,
  );
}

function buildRecallSummary(
  step: BlueprintSceneStep,
  items: VocabularyRecallItem[],
): Scene {
  const builder = new ScriptBuilder(step.id);
  const audio: AudioSegment[] = [
    builder.audio(
      "vi",
      "Cuối cùng, mình cùng đọc lại năm từ và nghĩa của từng từ nhé.",
      {
        pauseAfterMs: 320,
        rewritable: true,
        sourceField: "generated.recall_summary_lead_in",
      },
    ),
  ];

  items.forEach((item) => {
    audio.push(
      builder.audio("en", item.word, {
        pauseAfterMs: 180,
        rewritable: false,
        sourceField: `vocabulary.${item.id}.word`,
        rate: ENGLISH_RATE,
      }),
      builder.audio("vi", withPeriod(item.meaningVi), {
        pauseAfterMs: 420,
        rewritable: false,
        sourceField: `vocabulary.${item.id}.meaning_vi`,
      }),
    );
  });

  return scene(
    step,
    {
      title: "5 TỪ VỪA ÔN",
      subtitle: "Cùng đọc lại từ và nghĩa nhé!",
      items: items.map((item) => ({
        word: item.word,
        meaningVi: item.meaningVi,
      })),
      brand: BRAND,
      handle: OUTRO_HANDLE,
    },
    audio,
    18,
  );
}

function buildRecallChannelOutro(step: BlueprintSceneStep): Scene {
  const builder = new ScriptBuilder(step.id);
  return scene(
    step,
    {
      brand: BRAND,
      handle: OUTRO_HANDLE,
      cta: RECALL_OUTRO_CTA,
      logoUrl: CHANNEL_LOGO_URL,
      logoText: CHANNEL_LOGO_TEXT,
    },
    [
      builder.audio("vi", RECALL_OUTRO_CTA, {
        pauseAfterMs: 0,
        rewritable: false,
        sourceField: "generated.recall_outro_cta",
      }),
    ],
    7,
  );
}

export function composeScript(
  content: VocabularyContent,
  options: ComposeScriptOptions = {},
): VideoScript {
  const blueprint = resolveVocabularyBlueprint(options.blueprintId ?? content.quiz.type);
  if (blueprint.quizType !== content.quiz.type && options.blueprintId) {
    throw new Error(
      `Blueprint '${blueprint.id}' không khớp quiz_type='${content.quiz.type}' của '${content.id}'`,
    );
  }

  const steps = Object.fromEntries(blueprint.scenes.map((step) => [step.kind, step])) as Record<
    Scene["kind"],
    BlueprintSceneStep
  >;
  const title = `${content.word} · ${blueprint.title}`;

  return VideoScriptSchema.parse({
    version: "3.2.1",
    videoType: "single_word",
    renderer: "hyperframes",
    contentType: "vocabulary",
    blueprintId: blueprint.id,
    themeId: "english-modern",
    metadata: {
      title,
      channel: BRAND,
      level: content.level,
      topic: content.topic,
      source: {
        type: "excel",
        value: options.excelPath ?? "data/content.xlsx",
        sheet: "vocabulary",
      },
    },
    video: {
      id: content.id,
      title,
      width: 1080,
      height: 1920,
      fps: 30,
      aspect: "9:16",
    },
    lockedFacts: {
      word: content.word,
      ipa: content.ipa,
      meaningVi: content.meaningVi,
      usageVi: content.usageVi,
      examples: content.examples,
      quizType: content.quiz.type,
      quizQuestion: content.quiz.question,
      quizOptions: content.quiz.options,
      quizAnswer: content.quiz.answer,
      quizExplanationVi: content.quiz.explanationVi,
    },
    scenes: [
      buildIntro(steps.intro, content),
      buildWord(steps.word, content),
      buildExamples(steps.examples, content),
      buildQuiz(steps.quiz, blueprint, content),
      buildAnswer(steps.answer, blueprint, content),
      buildOutro(steps.outro, content),
    ],
  });
}

export function composeVocabularyRecallScript(
  content: VocabularyRecallContent,
  vocabulary: VocabularyContent[],
  options: ComposeRecallScriptOptions = {},
): VideoScript {
  const items = resolveRecallItems(content, vocabulary);
  const [introStep, ...rest] = vocabularyRecallBlueprint.scenes;
  const summaryStep = rest.at(-2);
  const outroStep = rest.at(-1);
  const itemSteps = rest.slice(0, -2);
  if (!introStep || !summaryStep || !outroStep || itemSteps.length !== 5) {
    throw new Error("Blueprint vocabulary-meaning-recall không hợp lệ");
  }

  const title = `Đoán 5 từ tiếng Anh · ${content.topic}`;
  return VideoScriptSchema.parse({
    version: "3.2.1",
    videoType: "meaning_recall",
    renderer: "hyperframes",
    contentType: "vocabulary_recall",
    blueprintId: vocabularyRecallBlueprint.id,
    themeId: "english-modern",
    metadata: {
      title,
      channel: BRAND,
      level: content.level,
      topic: content.topic,
      source: {
        type: "excel",
        value: options.excelPath ?? "data/content.xlsx",
        sheet: "vocabulary_recall",
      },
    },
    video: {
      id: content.id,
      title,
      width: 1080,
      height: 1920,
      fps: 30,
      aspect: "9:16",
    },
    lockedFacts: {
      countdownSec: content.countdownSec,
      items,
    },
    scenes: [
      buildRecallIntro(introStep, content),
      ...itemSteps.map((step, index) =>
        buildRecallItem(step, items[index]!, index, content.countdownSec),
      ),
      buildRecallSummary(summaryStep, items),
      buildRecallChannelOutro(outroStep),
    ],
  });
}
