import { z } from "zod";
import type { Scene, VideoScript } from "../../domain/src/index.js";
import { listVocabularyBlueprints } from "../../blueprints/src/index.js";

const SharedIntroInputSchema = z
  .object({
    seriesLabel: z.string().trim().min(1).max(36),
    hook: z.string().trim().min(1).max(120),
    previewText: z.string().trim().min(1).max(60),
    level: z.string().trim().min(1).max(20),
    topic: z.string().trim().max(40).default("Vocabulary"),
    brand: z.string().trim().min(1).max(40),
  })
  .strict();

const VocabularyWordInputSchema = z
  .object({
    label: z.string().trim().min(1).max(36),
    word: z.string().trim().min(1).max(36),
    ipa: z.string().trim().min(1).max(80),
    partOfSpeech: z.string().trim().max(30).default(""),
    meaningVi: z.string().trim().min(1).max(120),
    usageVi: z.string().trim().min(1).max(220),
    brand: z.string().trim().min(1).max(40),
  })
  .strict();

const VocabularyExamplesInputSchema = z
  .object({
    label: z.string().trim().min(1).max(36),
    word: z.string().trim().min(1).max(36),
    examples: z
      .array(
        z
          .object({
            sentenceEn: z.string().trim().min(1).max(180),
            meaningVi: z.string().trim().min(1).max(180),
            explanationVi: z.string().trim().max(220).default(""),
          })
          .strict(),
      )
      .min(2)
      .max(3),
    brand: z.string().trim().min(1).max(40),
  })
  .strict();

const VocabularyQuizInputSchema = z
  .object({
    label: z.string().trim().min(1).max(40),
    question: z.string().trim().min(1).max(180),
    instruction: z.string().trim().max(180).default(""),
    options: z.array(z.string().trim().min(1).max(140)).min(2).max(4),
    countdownSec: z.number().int().min(5).max(10),
    commentPrompt: z.string().trim().min(1).max(160),
    brand: z.string().trim().min(1).max(40),
  })
  .strict();

const VocabularyAnswerInputSchema = z
  .object({
    label: z.string().trim().min(1).max(40),
    question: z.string().trim().min(1).max(180),
    options: z.array(z.string().trim().min(1).max(140)).min(2).max(4),
    answer: z.string().trim().min(1).max(180),
    answerIndex: z.number().int().min(0).max(3),
    explanationVi: z.string().trim().min(1).max(260),
    word: z.string().trim().min(1).max(36),
    brand: z.string().trim().min(1).max(40),
  })
  .strict();

const SharedOutroInputSchema = z
  .object({
    recapTitle: z.string().trim().min(1).max(60),
    recapText: z.string().trim().min(1).max(150),
    cta: z.string().trim().min(1).max(180),
    brand: z.string().trim().min(1).max(40),
    handle: z.string().trim().min(1).max(60),
  })
  .strict();

const SharedChannelOutroInputSchema = z
  .object({
    brand: z.string().trim().min(1).max(40),
    handle: z.string().trim().min(1).max(60),
    cta: z.string().trim().min(1).max(200),
    logoUrl: z.string().trim().max(2048).default(""),
    logoText: z.string().trim().min(1).max(12),
  })
  .strict();

const VocabularyRecallItemInputSchema = z
  .object({
    label: z.string().trim().min(1).max(30),
    meaningVi: z.string().trim().min(1).max(140),
    blankText: z.string().trim().min(1).max(120),
    word: z.string().trim().min(1).max(50),
    ipa: z.string().trim().min(1).max(80),
    countdownSec: z.number().int().min(5).max(10),
    itemIndex: z.number().int().min(1).max(5),
    itemTotal: z.literal(5),
    brand: z.string().trim().min(1).max(40),
  })
  .strict();

const VocabularyRecallSummaryInputSchema = z
  .object({
    title: z.string().trim().min(1).max(60),
    subtitle: z.string().trim().min(1).max(100),
    items: z
      .array(
        z
          .object({
            word: z.string().trim().min(1).max(50),
            meaningVi: z.string().trim().min(1).max(140),
          })
          .strict(),
      )
      .length(5),
    brand: z.string().trim().min(1).max(40),
    handle: z.string().trim().min(1).max(60),
  })
  .strict();

export interface SceneTemplateContract {
  id: string;
  role: Scene["role"];
  kind: Scene["kind"];
  inputSchema: { parse(input: unknown): unknown };
  recommendedDurationSec: { min: number; max: number };
}

const contracts = new Map<string, SceneTemplateContract>();

function register(contract: SceneTemplateContract): void {
  if (contracts.has(contract.id)) throw new Error(`Trùng scene template id '${contract.id}'`);
  contracts.set(contract.id, contract);
}

register({
  id: "shared-intro",
  role: "intro",
  kind: "intro",
  inputSchema: SharedIntroInputSchema,
  recommendedDurationSec: { min: 3, max: 8 },
});
register({
  id: "vocabulary-word",
  role: "main",
  kind: "word",
  inputSchema: VocabularyWordInputSchema,
  recommendedDurationSec: { min: 7, max: 16 },
});
register({
  id: "vocabulary-examples",
  role: "main",
  kind: "examples",
  inputSchema: VocabularyExamplesInputSchema,
  recommendedDurationSec: { min: 12, max: 28 },
});
register({
  id: "shared-outro",
  role: "outro",
  kind: "outro",
  inputSchema: SharedOutroInputSchema,
  recommendedDurationSec: { min: 4, max: 10 },
});
register({
  id: "shared-channel-outro",
  role: "outro",
  kind: "outro",
  inputSchema: SharedChannelOutroInputSchema,
  recommendedDurationSec: { min: 5, max: 12 },
});
register({
  id: "vocabulary-recall-item",
  role: "main",
  kind: "recall_item",
  inputSchema: VocabularyRecallItemInputSchema,
  recommendedDurationSec: { min: 8, max: 14 },
});
register({
  id: "vocabulary-recall-summary",
  role: "main",
  kind: "summary",
  inputSchema: VocabularyRecallSummaryInputSchema,
  recommendedDurationSec: { min: 14, max: 32 },
});

for (const blueprint of listVocabularyBlueprints()) {
  const quiz = blueprint.scenes.find((scene) => scene.kind === "quiz");
  const answer = blueprint.scenes.find((scene) => scene.kind === "answer");
  if (!quiz || !answer) throw new Error(`Blueprint '${blueprint.id}' thiếu quiz/answer scene`);
  register({
    id: quiz.templateId,
    role: "main",
    kind: "quiz",
    inputSchema: VocabularyQuizInputSchema,
    recommendedDurationSec: { min: 7, max: 16 },
  });
  register({
    id: answer.templateId,
    role: "main",
    kind: "answer",
    inputSchema: VocabularyAnswerInputSchema,
    recommendedDurationSec: { min: 6, max: 16 },
  });
}

export function getSceneTemplateContract(templateId: string): SceneTemplateContract {
  const contract = contracts.get(templateId);
  if (!contract) throw new Error(`Scene template '${templateId}' chưa đăng ký`);
  return contract;
}

export function listSceneTemplateContracts(): SceneTemplateContract[] {
  return [...contracts.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function validateSceneContract(scene: Scene): void {
  const contract = getSceneTemplateContract(scene.templateId);
  if (scene.role !== contract.role) {
    throw new Error(
      `Scene '${scene.id}' dùng role=${scene.role}, template '${scene.templateId}' yêu cầu role=${contract.role}`,
    );
  }
  if (scene.kind !== contract.kind) {
    throw new Error(
      `Scene '${scene.id}' dùng kind=${scene.kind}, template '${scene.templateId}' yêu cầu kind=${contract.kind}`,
    );
  }
  contract.inputSchema.parse(scene.inputs);
}

export function validateScriptSceneContracts(script: VideoScript): void {
  for (const scene of script.scenes) validateSceneContract(scene);
}
