import { access, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import pLimit from "p-limit";
import type {
  Scene,
  TtsManifestItem,
  VideoScript,
} from "../../domain/src/index.js";
import {
  concatAudioParts,
  concatVideos,
  durationSec,
  fitClipToDuration,
  mixSfx,
  muxVideoAudio,
  padAudioToDuration,
  type SfxMixSpec,
} from "../../audio/src/index.js";
import { buildSrt, type CaptionCue } from "../../captions/src/index.js";
import { HyperframesRenderer, type RenderQuality } from "../../hyperframes/src/index.js";
import { validateFinalVideo, validateScript } from "../../quality/src/index.js";
import { defaultSfxPlayback, indexSfxLibrary, pickSfx } from "../../sfx/src/index.js";
import { PythonTtsClient } from "../../tts-client/src/index.js";
import { readJson, sha256, writeJson } from "../../shared/src/index.js";

const SCENE_GAP_MS = 300;
const OUTRO_HOLD_SEC = 3;

export interface RenderOptions {
  outputDir?: string;
  force?: boolean;
  quality?: RenderQuality;
  sceneId?: string;
  sfx?: boolean;
}

interface SegmentTimeline {
  id: string;
  text: string;
  durationSec: number;
  startSec: number;
}

interface SceneManifest {
  version: "1.0";
  sceneId: string;
  audioHash: string;
  clipHash: string;
  durationSec: number;
  audioPath: string;
  rawClipPath: string;
  fittedClipPath: string;
  segments: SegmentTimeline[];
}

interface VideoManifest {
  version: "1.0";
  videoId: string;
  scriptHash: string;
  hyperframesVersion: string;
  scenes: SceneManifest[];
  finalVideo: string;
  voiceTrack: string;
  captions: string;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function sceneText(scene: Scene): string {
  return scene.audioSegments.map((segment) => segment.text).join(" ");
}

function renderInputsForScene(
  scene: Scene,
  segments: SegmentTimeline[],
): Record<string, unknown> {
  if (scene.kind === "quiz") {
    const lastSpokenSegment = segments.at(-1);
    const countdownDelaySec = lastSpokenSegment
      ? lastSpokenSegment.startSec + lastSpokenSegment.durationSec
      : 3;
    return {
      ...scene.inputs,
      countdownDelaySec: Number(countdownDelaySec.toFixed(3)),
    };
  }
  if (scene.kind === "recall_item") {
    const answerSegment = segments[0];
    const revealDelaySec = answerSegment?.startSec ?? Number(scene.inputs.countdownSec ?? 7);
    return {
      ...scene.inputs,
      revealDelaySec: Number(revealDelaySec.toFixed(3)),
    };
  }
  return scene.inputs;
}

function segmentMap(items: TtsManifestItem[]): Map<string, TtsManifestItem> {
  return new Map(items.map((item) => [item.id, item]));
}

function printStep(current: number, total: number, label: string): void {
  console.log(`\n[${current}/${total}] ${label}`);
}

export async function renderVideo(
  raw: unknown,
  options: RenderOptions = {},
): Promise<string> {
  const totalSteps = 8;
  const script = await validateScript(raw);
  const root = resolve(options.outputDir ?? process.env.OUTPUT_DIR ?? "output", script.video.id);
  const voiceDir = join(root, "voice");
  const segmentsDir = join(voiceDir, "segments");
  const clipsDir = join(root, "clips");
  const manifestsDir = join(root, "manifests");
  await Promise.all([
    mkdir(root, { recursive: true }),
    mkdir(voiceDir, { recursive: true }),
    mkdir(segmentsDir, { recursive: true }),
    mkdir(clipsDir, { recursive: true }),
    mkdir(manifestsDir, { recursive: true }),
  ]);

  printStep(1, totalSteps, "Validate script và templates");
  const renderer = new HyperframesRenderer();
  const targetScenes = options.sceneId
    ? script.scenes.filter((scene) => scene.id === options.sceneId)
    : script.scenes;
  if (options.sceneId && !targetScenes.length) {
    throw new Error(`Không tìm thấy scene '${options.sceneId}'`);
  }
  for (const scene of targetScenes) {
    await renderer.validateTemplate(scene.templateId, script.video.aspect);
  }
  const hyperframesVersion = await renderer.doctor();
  await writeJson(join(root, "script.json"), script);

  printStep(2, totalSteps, "Xuất script.txt");
  await writeFile(
    join(root, "script.txt"),
    `${script.scenes.map((scene) => sceneText(scene)).join("\n\n")}\n`,
    "utf8",
  );

  printStep(3, totalSteps, "TTS từng segment qua Python service");
  const tts = new PythonTtsClient(
    process.env.TTS_SERVICE_URL ?? "http://127.0.0.1:8124",
  );
  if (!(await tts.health())) {
    throw new Error(
      `Python TTS service chưa chạy tại ${process.env.TTS_SERVICE_URL ?? "http://127.0.0.1:8124"}`,
    );
  }
  const requestedSegments = targetScenes.flatMap((scene) => scene.audioSegments);
  const ttsManifest = await tts.synthesizeBatch(requestedSegments, segmentsDir);
  const bySegmentId = segmentMap(ttsManifest.items);

  printStep(4, totalSteps, "Ghép audio scene và tạo subtitle");
  const sceneManifests: SceneManifest[] = [];
  for (const scene of targetScenes) {
    const manifestPath = join(manifestsDir, `scene-${scene.id}.json`);
    const previous = (await exists(manifestPath))
      ? await readJson<SceneManifest>(manifestPath)
      : undefined;
    const items = scene.audioSegments.map((segment) => {
      const item = bySegmentId.get(segment.id);
      if (!item) throw new Error(`TTS thiếu segment '${segment.id}'`);
      return { segment, item };
    });
    const audioHash = sha256(
      items.map(({ segment, item }) => ({
        contentHash: item.contentHash,
        pauseBeforeMs: segment.pauseBeforeMs,
        pauseAfterMs: segment.pauseAfterMs,
      })),
    );
    const sceneAudioPath = join(voiceDir, `scene-${scene.id}.wav`);
    if (options.force || previous?.audioHash !== audioHash || !(await exists(sceneAudioPath))) {
      await concatAudioParts(
        items.map(({ segment, item }) => ({
          path: item.outputPath,
          pauseBeforeMs: segment.pauseBeforeMs,
          pauseAfterMs: segment.pauseAfterMs,
        })),
        sceneAudioPath,
      );
    }
    await padAudioToDuration(sceneAudioPath, scene.minDurationSec);
    const sceneDuration = await durationSec(sceneAudioPath);
    let localCursor = 0;
    const timelines: SegmentTimeline[] = [];
    for (const { segment, item } of items) {
      localCursor += segment.pauseBeforeMs / 1000;
      const segmentDuration = item.durationMs / 1000;
      timelines.push({
        id: segment.id,
        text: segment.text,
        startSec: localCursor,
        durationSec: segmentDuration,
      });
      localCursor += segmentDuration + segment.pauseAfterMs / 1000;
    }
    await writeFile(
      join(voiceDir, `scene-${scene.id}.srt`),
      buildSrt(
        timelines.map((timeline) => ({
          text: timeline.text,
          startSec: timeline.startSec,
          durationSec: timeline.durationSec,
        })),
      ),
      "utf8",
    );

    const rawClipPath = join(clipsDir, `scene-${scene.id}.mp4`);
    const fittedClipPath = join(clipsDir, `scene-${scene.id}-fit.mp4`);
    const visualDuration =
      sceneDuration +
      (scene.role === "outro" ? OUTRO_HOLD_SEC : options.sceneId ? 0 : SCENE_GAP_MS / 1000);
    const renderInputs = renderInputsForScene(scene, timelines);
    const clipHash = sha256({
      templateId: scene.templateId,
      inputs: renderInputs,
      aspect: script.video.aspect,
      fps: script.video.fps,
      quality: options.quality ?? process.env.HYPERFRAMES_QUALITY ?? "standard",
      visualDuration,
      hyperframesVersion,
    });
    sceneManifests.push({
      version: "1.0",
      sceneId: scene.id,
      audioHash,
      clipHash,
      durationSec: sceneDuration,
      audioPath: sceneAudioPath,
      rawClipPath,
      fittedClipPath,
      segments: timelines,
    });
  }

  printStep(5, totalSteps, "Chọn và mix SFX");
  if (options.sceneId) {
    console.log("Preview mode: bỏ qua full-track SFX");
  }

  printStep(6, totalSteps, "Render HyperFrames và fit clip theo narration");
  const quality = (options.quality ??
    process.env.HYPERFRAMES_QUALITY ??
    "standard") as RenderQuality;
  const renderConcurrency = Math.max(1, Number(process.env.RENDER_CONCURRENCY ?? 1));
  const renderLimit = pLimit(renderConcurrency);
  await Promise.all(
    targetScenes.map((scene, index) =>
      renderLimit(async () => {
        const manifest = sceneManifests[index]!;
        const manifestPath = join(manifestsDir, `scene-${scene.id}.json`);
        const previous = (await exists(manifestPath))
          ? await readJson<SceneManifest>(manifestPath)
          : undefined;
        if (
          options.force ||
          previous?.clipHash !== manifest.clipHash ||
          !(await exists(manifest.rawClipPath))
        ) {
          console.log(`Render ${scene.id}: ${scene.templateId}`);
          await renderer.render({
            templateId: scene.templateId,
            inputs: renderInputsForScene(scene, manifest.segments),
            outputPath: manifest.rawClipPath,
            aspect: script.video.aspect,
            fps: script.video.fps,
            quality,
          });
        } else {
          console.log(`Reuse clip ${scene.id}`);
        }
        const visualDuration =
          manifest.durationSec +
          (scene.role === "outro"
            ? OUTRO_HOLD_SEC
            : options.sceneId
              ? 0
              : SCENE_GAP_MS / 1000);
        if (
          options.force ||
          previous?.clipHash !== manifest.clipHash ||
          !(await exists(manifest.fittedClipPath))
        ) {
          await fitClipToDuration(
            manifest.rawClipPath,
            visualDuration,
            manifest.fittedClipPath,
            script.video.fps,
          );
        }
        await writeJson(manifestPath, manifest);
      }),
    ),
  );

  if (options.sceneId) {
    printStep(7, totalSteps, "Mux preview scene");
    const manifest = sceneManifests[0]!;
    const previewPath = join(root, `preview-${options.sceneId}.mp4`);
    await muxVideoAudio(manifest.fittedClipPath, manifest.audioPath, previewPath);
    printStep(8, totalSteps, "Hoàn tất preview");
    console.log(`Preview: ${previewPath}`);
    return previewPath;
  }

  const orderedManifests = script.scenes.map((scene) => {
    const manifest = sceneManifests.find((candidate) => candidate.sceneId === scene.id);
    if (!manifest) throw new Error(`Thiếu manifest scene '${scene.id}'`);
    return manifest;
  });

  const sceneStarts = new Map<string, number>();
  let cursor = 0;
  const fullCues: CaptionCue[] = [];
  for (const [index, scene] of script.scenes.entries()) {
    const manifest = orderedManifests[index]!;
    sceneStarts.set(scene.id, cursor);
    for (const segment of manifest.segments) {
      fullCues.push({
        text: segment.text,
        startSec: cursor + segment.startSec,
        durationSec: segment.durationSec,
      });
    }
    cursor += manifest.durationSec + (index < script.scenes.length - 1 ? SCENE_GAP_MS / 1000 : 0);
  }
  const captionsPath = join(root, "captions.srt");
  await writeFile(captionsPath, buildSrt(fullCues), "utf8");

  const voiceRawPath = join(root, "voice-raw.wav");
  await concatAudioParts(
    orderedManifests.map((manifest, index) => ({
      path: manifest.audioPath,
      pauseAfterMs: index < orderedManifests.length - 1 ? SCENE_GAP_MS : 0,
    })),
    voiceRawPath,
  );

  const voicePath = join(root, "voice.mp3");
  const sfxSpecs: SfxMixSpec[] = [];
  if (options.sfx !== false) {
    const assetsDir = resolve(process.env.ASSETS_DIR ?? "assets");
    const sfxDir = join(assetsDir, "sfx");
    const sfxIndex = indexSfxLibrary(sfxDir);
    for (const scene of script.scenes) {
      const startSec = sceneStarts.get(scene.id) ?? 0;
      if (scene.sfx?.name === "none") continue;
      if (scene.sfx) {
        const explicitPath = join(sfxDir, scene.sfx.name);
        if (await exists(explicitPath)) {
          sfxSpecs.push({
            path: explicitPath,
            startSec: startSec + scene.sfx.startOffsetSec,
            volume: scene.sfx.volume,
          });
        }
        continue;
      }
      const picked = pickSfx({
        role: scene.role,
        sceneId: scene.id,
        text: sceneText(scene),
        index: sfxIndex,
      });
      if (!picked) continue;
      const playback = defaultSfxPlayback(picked);
      sfxSpecs.push({
        path: join(sfxDir, picked),
        startSec: startSec + playback.offsetSec,
        volume: playback.volume,
      });
    }
  }
  await mixSfx(voiceRawPath, sfxSpecs, voicePath);

  printStep(7, totalSteps, "Concat clips và mux voice");
  const silentVideoPath = join(root, "video-silent.mp4");
  const finalVideoPath = join(root, "video.mp4");
  await concatVideos(
    orderedManifests.map((manifest) => manifest.fittedClipPath),
    silentVideoPath,
  );
  await muxVideoAudio(silentVideoPath, voicePath, finalVideoPath);

  printStep(8, totalSteps, "Quality gate và manifest");
  const qualityReport = await validateFinalVideo(finalVideoPath, {
    width: script.video.width,
    height: script.video.height,
  });
  await writeJson(join(root, "quality-report.json"), qualityReport);
  if (!qualityReport.ok) {
    throw new Error(`Video không vượt quality gate: ${qualityReport.issues.join("; ")}`);
  }
  const manifest: VideoManifest = {
    version: "1.0",
    videoId: script.video.id,
    scriptHash: sha256(script),
    hyperframesVersion,
    scenes: orderedManifests,
    finalVideo: finalVideoPath,
    voiceTrack: voicePath,
    captions: captionsPath,
  };
  await writeJson(join(root, "manifest.json"), manifest);

  console.log("\n=== Kết quả ===");
  console.log(`Video:    ${finalVideoPath}`);
  console.log(`Voice:    ${voicePath}`);
  console.log(`Captions: ${captionsPath}`);
  console.log(`Duration: ${qualityReport.durationSec.toFixed(2)}s`);
  return finalVideoPath;
}
