import { access } from "node:fs/promises";
import {
  VideoScriptSchema,
  type AudioSegment,
  type SingleVocabularyVideoScript,
  type VideoScript,
  type VocabularyRecallVideoScript,
} from "../../domain/src/index.js";
import {
  resolveVocabularyBlueprint,
  vocabularyRecallBlueprint,
} from "../../blueprints/src/index.js";
import { validateScriptSceneContracts } from "../../scenes/src/index.js";
import { durationSec } from "../../audio/src/index.js";
import { runCommand } from "../../process/src/index.js";
import { stableJson } from "../../shared/src/index.js";

function textInput(script: VideoScript, sceneKind: string, key: string): unknown {
  return script.scenes.find((scene) => scene.kind === sceneKind)?.inputs[key];
}

function assertEqual(label: string, actual: unknown, expected: unknown): void {
  if (stableJson(actual) !== stableJson(expected)) {
    throw new Error(`${label} không khớp lockedFacts`);
  }
}

function validateSingleLockedFacts(script: SingleVocabularyVideoScript): void {
  const facts = script.lockedFacts;
  assertEqual("word.inputs.word", textInput(script, "word", "word"), facts.word);
  assertEqual("word.inputs.ipa", textInput(script, "word", "ipa"), facts.ipa);
  assertEqual("word.inputs.meaningVi", textInput(script, "word", "meaningVi"), facts.meaningVi);
  assertEqual("word.inputs.usageVi", textInput(script, "word", "usageVi"), facts.usageVi);
  assertEqual("examples.inputs.examples", textInput(script, "examples", "examples"), facts.examples);
  assertEqual("quiz.inputs.question", textInput(script, "quiz", "question"), facts.quizQuestion);
  assertEqual("quiz.inputs.options", textInput(script, "quiz", "options"), facts.quizOptions);
  assertEqual("answer.inputs.answer", textInput(script, "answer", "answer"), facts.quizAnswer);
  assertEqual(
    "answer.inputs.explanationVi",
    textInput(script, "answer", "explanationVi"),
    facts.quizExplanationVi,
  );
  assertEqual("outro.inputs.recapTitle", textInput(script, "outro", "recapTitle"), facts.word);
  assertEqual("outro.inputs.recapText", textInput(script, "outro", "recapText"), facts.meaningVi);
}

function validateRecallLockedFacts(script: VocabularyRecallVideoScript): void {
  const facts = script.lockedFacts;
  const itemScenes = script.scenes.filter((scene) => scene.kind === "recall_item");
  if (itemScenes.length !== 5) throw new Error("Recall blueprint phải có đúng 5 item scenes");

  itemScenes.forEach((scene, index) => {
    const item = facts.items[index]!;
    assertEqual(`${scene.id}.inputs.word`, scene.inputs.word, item.word);
    assertEqual(`${scene.id}.inputs.ipa`, scene.inputs.ipa, item.ipa);
    assertEqual(`${scene.id}.inputs.meaningVi`, scene.inputs.meaningVi, item.meaningVi);
    assertEqual(`${scene.id}.inputs.countdownSec`, scene.inputs.countdownSec, facts.countdownSec);
    if (scene.audioSegments.length !== 1) {
      throw new Error(`Scene '${scene.id}' chỉ được có một voice segment tiếng Anh`);
    }
    const segment = scene.audioSegments[0]!;
    assertEqual(`${scene.id}.audio.text`, segment.text, item.word);
    assertEqual(`${scene.id}.audio.language`, segment.language, "en");
    assertEqual(
      `${scene.id}.audio.pauseBeforeMs`,
      segment.pauseBeforeMs,
      facts.countdownSec * 1000,
    );
    if (segment.rewritable) {
      throw new Error(`Scene '${scene.id}' không được rewrite từ tiếng Anh`);
    }
  });

  const summary = script.scenes.find((scene) => scene.kind === "summary");
  assertEqual(
    "summary.inputs.items",
    summary?.inputs.items,
    facts.items.map((item) => ({ word: item.word, meaningVi: item.meaningVi })),
  );
  if (!summary || summary.audioSegments.length !== 11) {
    throw new Error("Recall summary phải có một câu dẫn và 5 cặp word/meaning");
  }
  facts.items.forEach((item, index) => {
    const wordSegment = summary.audioSegments[index * 2 + 1];
    const meaningSegment = summary.audioSegments[index * 2 + 2];
    assertEqual(`summary.audio.word.${index + 1}`, wordSegment?.text, item.word);
    assertEqual(`summary.audio.word_language.${index + 1}`, wordSegment?.language, "en");
    assertEqual(
      `summary.audio.meaning.${index + 1}`,
      meaningSegment?.text.replace(/[.!?…]+$/u, ""),
      item.meaningVi.replace(/[.!?…]+$/u, ""),
    );
    assertEqual(`summary.audio.meaning_language.${index + 1}`, meaningSegment?.language, "vi");
    if (wordSegment?.rewritable || meaningSegment?.rewritable) {
      throw new Error("Recall summary không được rewrite từ hoặc nghĩa lấy từ Excel");
    }
  });

  const outro = script.scenes.at(-1);
  if (outro?.templateId !== "shared-channel-outro") {
    throw new Error("Recall video phải kết thúc bằng shared-channel-outro");
  }
  if (typeof outro.inputs.cta !== "string" || !outro.inputs.cta.trim()) {
    throw new Error("Recall channel outro bắt buộc có CTA");
  }
}

function validateSingleBlueprint(script: SingleVocabularyVideoScript): void {
  const blueprint = resolveVocabularyBlueprint(script.blueprintId);
  if (blueprint.quizType !== script.lockedFacts.quizType) {
    throw new Error(
      `blueprintId='${script.blueprintId}' không khớp quizType='${script.lockedFacts.quizType}'`,
    );
  }
  if (script.scenes.length !== blueprint.scenes.length) {
    throw new Error(`Blueprint '${blueprint.id}' yêu cầu ${blueprint.scenes.length} scenes`);
  }
  blueprint.scenes.forEach((step, index) => {
    const scene = script.scenes[index];
    if (!scene) throw new Error(`Thiếu scene thứ ${index + 1}`);
    if (
      scene.id !== step.id ||
      scene.role !== step.role ||
      scene.kind !== step.kind ||
      scene.templateId !== step.templateId
    ) {
      throw new Error(
        `Scene ${index + 1} không khớp blueprint '${blueprint.id}': cần ${step.id}/${step.kind}/${step.templateId}`,
      );
    }
  });
}

function validateRecallBlueprint(script: VocabularyRecallVideoScript): void {
  const blueprint = vocabularyRecallBlueprint;
  if (script.blueprintId !== blueprint.id) {
    throw new Error(`Recall script phải dùng blueprint '${blueprint.id}'`);
  }
  if (script.scenes.length !== blueprint.scenes.length) {
    throw new Error(`Blueprint '${blueprint.id}' yêu cầu ${blueprint.scenes.length} scenes`);
  }
  blueprint.scenes.forEach((step, index) => {
    const scene = script.scenes[index];
    if (!scene) throw new Error(`Thiếu scene thứ ${index + 1}`);
    if (
      scene.id !== step.id ||
      scene.role !== step.role ||
      scene.kind !== step.kind ||
      scene.templateId !== step.templateId
    ) {
      throw new Error(
        `Scene ${index + 1} không khớp blueprint '${blueprint.id}': cần ${step.id}/${step.kind}/${step.templateId}`,
      );
    }
  });
}

function validateNarrationText(segment: AudioSegment): void {
  if (/```|\*\*|^\s*[-#>]\s/m.test(segment.text)) {
    throw new Error(`Segment '${segment.id}' chứa Markdown không phù hợp TTS`);
  }
  if (/https?:\/\//i.test(segment.text)) {
    throw new Error(`Segment '${segment.id}' không được chứa URL`);
  }
  if (segment.text.length > 500) {
    throw new Error(`Segment '${segment.id}' dài quá 500 ký tự`);
  }
}

export async function validateScript(raw: unknown): Promise<VideoScript> {
  const script = VideoScriptSchema.parse(raw);
  if (script.videoType === "meaning_recall") {
    validateRecallBlueprint(script);
    validateRecallLockedFacts(script);
  } else {
    validateSingleBlueprint(script);
    validateSingleLockedFacts(script);
  }
  validateScriptSceneContracts(script);
  for (const scene of script.scenes) {
    for (const segment of scene.audioSegments) validateNarrationText(segment);
  }
  return script;
}

export interface ImproveValidationReport {
  ok: true;
  changedSegments: number;
  unchangedSegments: number;
  changedSegmentIds: string[];
}

export async function validateImprovedScript(
  rawBase: unknown,
  rawCandidate: unknown,
): Promise<ImproveValidationReport> {
  const base = await validateScript(rawBase);
  const candidate = await validateScript(rawCandidate);

  const normalizedCandidate = structuredClone(candidate);
  const changedSegmentIds: string[] = [];
  let unchangedSegments = 0;

  base.scenes.forEach((baseScene, sceneIndex) => {
    const candidateScene = candidate.scenes[sceneIndex];
    const normalizedScene = normalizedCandidate.scenes[sceneIndex];
    if (!candidateScene || !normalizedScene) {
      throw new Error("Skill không được thêm hoặc xóa scene");
    }
    if (baseScene.audioSegments.length !== candidateScene.audioSegments.length) {
      throw new Error(`Skill không được thêm hoặc xóa audio segment tại scene '${baseScene.id}'`);
    }

    baseScene.audioSegments.forEach((baseSegment, segmentIndex) => {
      const candidateSegment = candidateScene.audioSegments[segmentIndex];
      const normalizedSegment = normalizedScene.audioSegments[segmentIndex];
      if (!candidateSegment || !normalizedSegment) {
        throw new Error(`Thiếu segment '${baseSegment.id}' sau khi improve`);
      }
      if (candidateSegment.id !== baseSegment.id) {
        throw new Error(`Skill không được thay segment id '${baseSegment.id}'`);
      }
      const changed = candidateSegment.text !== baseSegment.text;
      if (changed && !baseSegment.rewritable) {
        throw new Error(`Segment '${baseSegment.id}' có rewritable=false nhưng đã bị thay đổi`);
      }
      if (changed) changedSegmentIds.push(baseSegment.id);
      else unchangedSegments += 1;
      normalizedSegment.text = baseSegment.text;
    });
  });

  if (stableJson(normalizedCandidate) !== stableJson(base)) {
    throw new Error(
      "Skill chỉ được sửa scenes[*].audioSegments[*].text với rewritable=true; phát hiện thay đổi ngoài phạm vi",
    );
  }

  return {
    ok: true,
    changedSegments: changedSegmentIds.length,
    unchangedSegments,
    changedSegmentIds,
  };
}

export interface VideoQualityReport {
  ok: boolean;
  durationSec: number;
  width: number;
  height: number;
  videoCodec: string;
  audioCodec: string;
  hasAudio: boolean;
  issues: string[];
}

export async function validateFinalVideo(
  path: string,
  expected?: { width: number; height: number },
): Promise<VideoQualityReport> {
  await access(path);
  const duration = await durationSec(path);
  const result = await runCommand(process.env.FFPROBE_BIN ?? "ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "stream=index,codec_type,codec_name,width,height",
    "-of",
    "json",
    path,
  ]);
  const parsed = JSON.parse(result.stdout) as {
    streams?: Array<{
      codec_type?: string;
      codec_name?: string;
      width?: number;
      height?: number;
    }>;
  };
  const video = parsed.streams?.find((stream) => stream.codec_type === "video");
  const audio = parsed.streams?.find((stream) => stream.codec_type === "audio");
  const issues: string[] = [];
  if (!video) issues.push("Không có video stream");
  if (!audio) issues.push("Không có audio stream");
  if (duration <= 0) issues.push("Duration không hợp lệ");
  if (expected && video) {
    if (video.width !== expected.width || video.height !== expected.height) {
      issues.push(
        `Sai resolution: ${video.width ?? 0}x${video.height ?? 0}, cần ${expected.width}x${expected.height}`,
      );
    }
  }
  return {
    ok: issues.length === 0,
    durationSec: duration,
    width: video?.width ?? 0,
    height: video?.height ?? 0,
    videoCodec: video?.codec_name ?? "",
    audioCodec: audio?.codec_name ?? "",
    hasAudio: Boolean(audio),
    issues,
  };
}
