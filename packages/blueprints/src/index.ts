import type {
  SceneKind,
  VocabularyQuizType,
} from "../../domain/src/index.js";

export interface BlueprintSceneStep {
  id: string;
  role: "intro" | "main" | "outro";
  kind: SceneKind;
  templateId: string;
}

export interface VocabularyBlueprint {
  id: string;
  contentType: "vocabulary";
  quizType: VocabularyQuizType;
  title: string;
  quizLabel: string;
  answerLabel: string;
  scenes: readonly BlueprintSceneStep[];
}

export interface VocabularyRecallBlueprint {
  id: "vocabulary-meaning-recall";
  contentType: "vocabulary_recall";
  title: string;
  itemCount: 5;
  scenes: readonly BlueprintSceneStep[];
}

function createVocabularyBlueprint(args: {
  quizType: VocabularyQuizType;
  title: string;
  quizLabel: string;
  answerLabel: string;
}): VocabularyBlueprint {
  const suffix = args.quizType.replaceAll("_", "-");
  return {
    id: `vocabulary-${suffix}`,
    contentType: "vocabulary",
    quizType: args.quizType,
    title: args.title,
    quizLabel: args.quizLabel,
    answerLabel: args.answerLabel,
    scenes: [
      { id: "intro", role: "intro", kind: "intro", templateId: "shared-intro" },
      { id: "word", role: "main", kind: "word", templateId: "vocabulary-word" },
      {
        id: "examples",
        role: "main",
        kind: "examples",
        templateId: "vocabulary-examples",
      },
      {
        id: "quiz",
        role: "main",
        kind: "quiz",
        templateId: `vocabulary-quiz-${suffix}`,
      },
      {
        id: "answer",
        role: "main",
        kind: "answer",
        templateId: `vocabulary-answer-${suffix}`,
      },
      { id: "outro", role: "outro", kind: "outro", templateId: "shared-outro" },
    ],
  };
}

export const vocabularyBlueprints = {
  spelling: createVocabularyBlueprint({
    quizType: "spelling",
    title: "Vocabulary · Spelling",
    quizLabel: "CHÍNH TẢ",
    answerLabel: "CÁCH VIẾT ĐÚNG",
  }),
  fill_blank: createVocabularyBlueprint({
    quizType: "fill_blank",
    title: "Vocabulary · Fill in the blank",
    quizLabel: "ĐIỀN VÀO CHỖ TRỐNG",
    answerLabel: "ĐÁP ÁN HOÀN CHỈNH",
  }),
  meaning: createVocabularyBlueprint({
    quizType: "meaning",
    title: "Vocabulary · Meaning",
    quizLabel: "CHỌN NGHĨA ĐÚNG",
    answerLabel: "NGHĨA CHÍNH XÁC",
  }),
  antonym: createVocabularyBlueprint({
    quizType: "antonym",
    title: "Vocabulary · Antonym",
    quizLabel: "TỪ TRÁI NGHĨA",
    answerLabel: "TỪ TRÁI NGHĨA ĐÚNG",
  }),
  pronunciation: createVocabularyBlueprint({
    quizType: "pronunciation",
    title: "Vocabulary · Pronunciation",
    quizLabel: "PHÂN BIỆT PHÁT ÂM",
    answerLabel: "PHÁT ÂM ĐÚNG",
  }),
  correct_sentence: createVocabularyBlueprint({
    quizType: "correct_sentence",
    title: "Vocabulary · Correct sentence",
    quizLabel: "CHỌN CÂU ĐÚNG",
    answerLabel: "CÂU DÙNG ĐÚNG",
  }),
} satisfies Record<VocabularyQuizType, VocabularyBlueprint>;

export const vocabularyRecallBlueprint: VocabularyRecallBlueprint = {
  id: "vocabulary-meaning-recall",
  contentType: "vocabulary_recall",
  title: "Vocabulary · Meaning to word recall",
  itemCount: 5,
  scenes: [
    { id: "intro", role: "intro", kind: "intro", templateId: "shared-intro" },
    ...Array.from({ length: 5 }, (_, index): BlueprintSceneStep => ({
      id: `recall-${index + 1}`,
      role: "main",
      kind: "recall_item",
      templateId: "vocabulary-recall-item",
    })),
    {
      id: "summary",
      role: "main",
      kind: "summary",
      templateId: "vocabulary-recall-summary",
    },
    {
      id: "outro",
      role: "outro",
      kind: "outro",
      templateId: "shared-channel-outro",
    },
  ],
};

const byId = new Map(
  Object.values(vocabularyBlueprints).map((blueprint) => [blueprint.id, blueprint]),
);

export function resolveVocabularyBlueprint(
  quizTypeOrId: VocabularyQuizType | string,
): VocabularyBlueprint {
  const direct = byId.get(quizTypeOrId);
  if (direct) return direct;
  const byType = vocabularyBlueprints[quizTypeOrId as VocabularyQuizType];
  if (byType) return byType;
  throw new Error(`Không tìm thấy vocabulary blueprint '${quizTypeOrId}'`);
}

export function listVocabularyBlueprints(): VocabularyBlueprint[] {
  return Object.values(vocabularyBlueprints);
}

export function listAllBlueprints(): Array<VocabularyBlueprint | VocabularyRecallBlueprint> {
  return [...listVocabularyBlueprints(), vocabularyRecallBlueprint];
}
