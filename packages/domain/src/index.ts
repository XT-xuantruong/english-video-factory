import { z } from "zod";

export const ContentTypeSchema = z.enum([
  "vocabulary",
  "vocabulary_recall",
  "grammar",
  "common_mistake",
  "sentence_pattern",
  "quiz",
  "conversation",
]);
export type ContentType = z.infer<typeof ContentTypeSchema>;

export const ContentStatusSchema = z.enum(["draft", "ready", "published"]);
export type ContentStatus = z.infer<typeof ContentStatusSchema>;

export const VocabularyQuizTypeSchema = z.enum([
  "spelling",
  "fill_blank",
  "meaning",
  "antonym",
  "pronunciation",
  "correct_sentence",
]);
export type VocabularyQuizType = z.infer<typeof VocabularyQuizTypeSchema>;

export const VocabularyExampleSchema = z
  .object({
    sentenceEn: z.string().trim().min(1),
    meaningVi: z.string().trim().min(1),
    explanationVi: z.string().trim().default(""),
  })
  .strict();
export type VocabularyExample = z.infer<typeof VocabularyExampleSchema>;

export const VocabularyQuizSchema = z
  .object({
    type: VocabularyQuizTypeSchema,
    question: z.string().trim().min(1),
    options: z.array(z.string().trim().min(1)).min(2).max(4),
    answer: z.string().trim().min(1),
    explanationVi: z.string().trim().min(1),
    countdownSec: z.number().int().min(5).max(10).default(7),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.options.includes(value.answer)) {
      ctx.addIssue({
        code: "custom",
        path: ["answer"],
        message: "quiz.answer phải trùng chính xác với một phần tử trong quiz.options",
      });
    }
  });
export type VocabularyQuiz = z.infer<typeof VocabularyQuizSchema>;

export const VocabularyContentSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(1)
      .regex(/^[a-z0-9][a-z0-9-]*$/, "id chỉ gồm chữ thường, số và dấu gạch ngang"),
    contentType: z.literal("vocabulary").default("vocabulary"),
    enabled: z.boolean().default(true),
    status: ContentStatusSchema.default("draft"),
    level: z.string().trim().default("A1"),
    topic: z.string().trim().default("Vocabulary"),
    word: z.string().trim().min(1),
    ipa: z.string().trim().min(1),
    partOfSpeech: z.string().trim().default(""),
    meaningVi: z.string().trim().min(1),
    usageVi: z.string().trim().min(1),
    examples: z.array(VocabularyExampleSchema).min(2).max(3),
    quiz: VocabularyQuizSchema,
  })
  .strict();
export type VocabularyContent = z.infer<typeof VocabularyContentSchema>;

/**
 * One deterministic recall video contains exactly five vocabulary ids.
 * Keeping the count fixed preserves the project's "one fixed blueprint = one scene sequence" rule.
 */
export const VocabularyRecallContentSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(1)
      .regex(/^[a-z0-9][a-z0-9-]*$/, "id chỉ gồm chữ thường, số và dấu gạch ngang"),
    contentType: z.literal("vocabulary_recall").default("vocabulary_recall"),
    enabled: z.boolean().default(true),
    status: ContentStatusSchema.default("draft"),
    level: z.string().trim().default("A1"),
    topic: z.string().trim().default("Vocabulary recall"),
    wordIds: z.array(z.string().trim().min(1)).length(5),
    countdownSec: z.number().int().min(5).max(10).default(7),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (new Set(value.wordIds).size !== value.wordIds.length) {
      ctx.addIssue({
        code: "custom",
        path: ["wordIds"],
        message: "word_ids không được chứa id trùng nhau",
      });
    }
  });
export type VocabularyRecallContent = z.infer<typeof VocabularyRecallContentSchema>;

export const ContentInputSchema = z.discriminatedUnion("contentType", [
  VocabularyContentSchema,
  VocabularyRecallContentSchema,
]);
export type ContentInput = z.infer<typeof ContentInputSchema>;

export const AudioSegmentSchema = z
  .object({
    id: z.string().trim().min(1),
    language: z.enum(["vi", "en"]),
    text: z.string().trim().min(1),
    displayText: z.string().trim().min(1).optional(),
    voice: z.string().trim().min(1).optional(),
    style: z.enum(["tu_nhien", "tin_tuc", "doc_truyen"]).optional(),
    rate: z.string().trim().min(1).optional(),
    pitch: z.string().trim().min(1).optional(),
    pauseBeforeMs: z.number().int().min(0).max(10000).default(0),
    pauseAfterMs: z.number().int().min(0).max(10000).default(220),
    rewritable: z.boolean().default(false),
    sourceField: z.string().trim().min(1).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.language === "en" && value.rewritable) {
      ctx.addIssue({
        code: "custom",
        path: ["rewritable"],
        message: "Segment tiếng Anh lấy từ dữ liệu nguồn không được phép rewrite",
      });
    }
  });
export type AudioSegment = z.infer<typeof AudioSegmentSchema>;

export const SceneSfxSchema = z
  .object({
    name: z.string().trim().min(1),
    volume: z.number().min(0).max(1).default(0.35),
    startOffsetSec: z.number().min(0).default(0),
  })
  .strict();

export const SceneKindSchema = z.enum([
  "intro",
  "word",
  "examples",
  "quiz",
  "answer",
  "recall_item",
  "summary",
  "outro",
]);
export type SceneKind = z.infer<typeof SceneKindSchema>;

export const SceneSchema = z
  .object({
    id: z.string().trim().min(1),
    role: z.enum(["intro", "main", "outro"]),
    kind: SceneKindSchema,
    templateId: z.string().trim().min(1),
    inputs: z.record(z.string(), z.unknown()).default({}),
    audioSegments: z.array(AudioSegmentSchema).min(1),
    minDurationSec: z.number().positive().default(1.5),
    transition: z.enum(["cut"]).default("cut"),
    sfx: SceneSfxSchema.optional(),
  })
  .strict();
export type Scene = z.infer<typeof SceneSchema>;

export const VocabularyLockedFactsSchema = z
  .object({
    word: z.string().trim().min(1),
    ipa: z.string().trim().min(1),
    meaningVi: z.string().trim().min(1),
    usageVi: z.string().trim().min(1),
    examples: z.array(VocabularyExampleSchema).min(2).max(3),
    quizType: VocabularyQuizTypeSchema,
    quizQuestion: z.string().trim().min(1),
    quizOptions: z.array(z.string().trim().min(1)).min(2).max(4),
    quizAnswer: z.string().trim().min(1),
    quizExplanationVi: z.string().trim().min(1),
  })
  .strict();
export type VocabularyLockedFacts = z.infer<typeof VocabularyLockedFactsSchema>;

export const VocabularyRecallItemSchema = z
  .object({
    id: z.string().trim().min(1),
    word: z.string().trim().min(1),
    ipa: z.string().trim().min(1),
    meaningVi: z.string().trim().min(1),
  })
  .strict();
export type VocabularyRecallItem = z.infer<typeof VocabularyRecallItemSchema>;

export const VocabularyRecallLockedFactsSchema = z
  .object({
    countdownSec: z.number().int().min(5).max(10),
    items: z.array(VocabularyRecallItemSchema).length(5),
  })
  .strict();
export type VocabularyRecallLockedFacts = z.infer<
  typeof VocabularyRecallLockedFactsSchema
>;

const MetadataSingleVocabularySchema = z
  .object({
    title: z.string().trim().min(1),
    channel: z.string().trim().min(1).default("English Mỗi Ngày"),
    level: z.string().trim().default("A1"),
    topic: z.string().trim().default("Vocabulary"),
    source: z
      .object({
        type: z.literal("excel").default("excel"),
        value: z.string().trim().min(1).default("data/content.xlsx"),
        sheet: z.literal("vocabulary").default("vocabulary"),
      })
      .strict(),
  })
  .strict();

const MetadataRecallSchema = z
  .object({
    title: z.string().trim().min(1),
    channel: z.string().trim().min(1).default("English Mỗi Ngày"),
    level: z.string().trim().default("A1"),
    topic: z.string().trim().default("Vocabulary recall"),
    source: z
      .object({
        type: z.literal("excel").default("excel"),
        value: z.string().trim().min(1).default("data/content.xlsx"),
        sheet: z.literal("vocabulary_recall").default("vocabulary_recall"),
      })
      .strict(),
  })
  .strict();

const VideoInfoSchema = z
  .object({
    id: z.string().trim().min(1),
    title: z.string().trim().min(1),
    width: z.number().int().positive().default(1080),
    height: z.number().int().positive().default(1920),
    fps: z.union([z.literal(24), z.literal(30), z.literal(60)]).default(30),
    aspect: z.enum(["9:16", "16:9", "1:1"]).default("9:16"),
  })
  .strict();

function validateUniqueSceneIds(
  scenes: Scene[],
  ctx: z.RefinementCtx,
): void {
  const ids = new Set<string>();
  for (const [index, scene] of scenes.entries()) {
    if (ids.has(scene.id)) {
      ctx.addIssue({
        code: "custom",
        path: ["scenes", index, "id"],
        message: `Trùng scene id: ${scene.id}`,
      });
    }
    ids.add(scene.id);
  }
}

function validateIntroInputs(
  scenes: Scene[],
  ctx: z.RefinementCtx,
): void {
  const introInputs = scenes[0]?.inputs ?? {};
  for (const key of ["seriesLabel", "hook", "previewText"]) {
    const input = introInputs[key];
    if (typeof input !== "string" || !input.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["scenes", 0, "inputs", key],
        message: `Intro bắt buộc có ${key} không rỗng`,
      });
    }
  }
}

export const SingleVocabularyVideoScriptSchema = z
  .object({
    version: z.enum(["3.1", "3.2", "3.2.1"]),
    videoType: z.literal("single_word").default("single_word"),
    renderer: z.literal("hyperframes").default("hyperframes"),
    contentType: z.literal("vocabulary"),
    blueprintId: z.string().trim().min(1),
    themeId: z.string().trim().min(1).default("english-modern"),
    metadata: MetadataSingleVocabularySchema,
    video: VideoInfoSchema,
    lockedFacts: VocabularyLockedFactsSchema,
    scenes: z.array(SceneSchema).length(6),
  })
  .strict()
  .superRefine((value, ctx) => {
    const expectedKinds: SceneKind[] = [
      "intro",
      "word",
      "examples",
      "quiz",
      "answer",
      "outro",
    ];
    value.scenes.forEach((scene, index) => {
      if (scene.kind !== expectedKinds[index]) {
        ctx.addIssue({
          code: "custom",
          path: ["scenes", index, "kind"],
          message: `Scene ${index + 1} phải có kind=${expectedKinds[index]}`,
        });
      }
    });
    if (value.scenes[0]?.role !== "intro") {
      ctx.addIssue({
        code: "custom",
        path: ["scenes", 0, "role"],
        message: "Scene đầu tiên phải có role=intro",
      });
    }
    if (value.scenes.at(-1)?.role !== "outro") {
      ctx.addIssue({
        code: "custom",
        path: ["scenes", value.scenes.length - 1, "role"],
        message: "Scene cuối cùng phải có role=outro",
      });
    }
    validateUniqueSceneIds(value.scenes, ctx);
    validateIntroInputs(value.scenes, ctx);
  });
export type SingleVocabularyVideoScript = z.infer<
  typeof SingleVocabularyVideoScriptSchema
>;

export const VocabularyRecallVideoScriptSchema = z
  .object({
    version: z.literal("3.2.1"),
    videoType: z.literal("meaning_recall"),
    renderer: z.literal("hyperframes").default("hyperframes"),
    contentType: z.literal("vocabulary_recall"),
    blueprintId: z.literal("vocabulary-meaning-recall"),
    themeId: z.string().trim().min(1).default("english-modern"),
    metadata: MetadataRecallSchema,
    video: VideoInfoSchema,
    lockedFacts: VocabularyRecallLockedFactsSchema,
    scenes: z.array(SceneSchema).length(8),
  })
  .strict()
  .superRefine((value, ctx) => {
    const expectedKinds: SceneKind[] = [
      "intro",
      "recall_item",
      "recall_item",
      "recall_item",
      "recall_item",
      "recall_item",
      "summary",
      "outro",
    ];
    value.scenes.forEach((scene, index) => {
      if (scene.kind !== expectedKinds[index]) {
        ctx.addIssue({
          code: "custom",
          path: ["scenes", index, "kind"],
          message: `Scene ${index + 1} phải có kind=${expectedKinds[index]}`,
        });
      }
    });
    if (value.scenes[0]?.role !== "intro") {
      ctx.addIssue({
        code: "custom",
        path: ["scenes", 0, "role"],
        message: "Scene đầu tiên phải có role=intro",
      });
    }
    if (value.scenes.at(-1)?.role !== "outro") {
      ctx.addIssue({
        code: "custom",
        path: ["scenes", value.scenes.length - 1, "role"],
        message: "Scene cuối cùng phải có role=outro",
      });
    }
    validateUniqueSceneIds(value.scenes, ctx);
    validateIntroInputs(value.scenes, ctx);
  });
export type VocabularyRecallVideoScript = z.infer<
  typeof VocabularyRecallVideoScriptSchema
>;

export const VideoScriptSchema = z.union([
  SingleVocabularyVideoScriptSchema,
  VocabularyRecallVideoScriptSchema,
]);
export type VideoScript = z.infer<typeof VideoScriptSchema>;

export interface TtsManifestItem {
  id: string;
  outputPath: string;
  durationMs: number;
  contentHash: string;
  cached: boolean;
  provider: "vieneu" | "edge";
}

export interface TtsManifest {
  items: TtsManifestItem[];
}
