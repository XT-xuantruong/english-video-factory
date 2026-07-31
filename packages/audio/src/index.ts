import { mkdtemp, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { runCommand } from "../../process/src/index.js";

const ffmpeg = () => process.env.FFMPEG_BIN ?? "ffmpeg";
const ffprobe = () => process.env.FFPROBE_BIN ?? "ffprobe";

export interface AudioPart {
  path: string;
  pauseBeforeMs?: number;
  pauseAfterMs: number;
}

export interface SfxMixSpec {
  path: string;
  startSec: number;
  volume: number;
}

export async function durationSec(path: string): Promise<number> {
  const result = await runCommand(ffprobe(), [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    path,
  ]);
  const duration = Number(result.stdout.trim());
  if (!Number.isFinite(duration)) throw new Error(`Không đọc được duration: ${path}`);
  return duration;
}

export async function concatAudioParts(
  parts: AudioPart[],
  outputPath: string,
): Promise<void> {
  if (!parts.length) throw new Error("concatAudioParts: parts rỗng");
  await mkdir(dirname(outputPath), { recursive: true });
  const args = ["-y"];
  for (const part of parts) args.push("-i", part.path);

  const filters: string[] = [];
  const labels: string[] = [];
  parts.forEach((part, index) => {
    const label = `a${index}`;
    const pauseBeforeMs = Math.max(0, part.pauseBeforeMs ?? 0);
    const pauseAfterSec = Math.max(0, part.pauseAfterMs) / 1000;
    filters.push(
      `[${index}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=mono,` +
        `afade=t=in:st=0:d=0.008,areverse,afade=t=in:st=0:d=0.008,areverse,` +
        `adelay=${pauseBeforeMs}:all=1,` +
        `apad=pad_dur=${pauseAfterSec.toFixed(3)}[${label}]`,
    );
    labels.push(`[${label}]`);
  });
  filters.push(`${labels.join("")}concat=n=${labels.length}:v=0:a=1[out]`);
  args.push(
    "-filter_complex",
    filters.join(";"),
    "-map",
    "[out]",
    "-ar",
    "48000",
    "-ac",
    "1",
    "-c:a",
    "pcm_s16le",
    outputPath,
  );
  await runCommand(ffmpeg(), args);
}


export async function padAudioToDuration(
  inputPath: string,
  targetSec: number,
): Promise<void> {
  const current = await durationSec(inputPath);
  if (current >= targetSec - 0.01) return;

  const tempPath = `${inputPath}.padded.wav`;
  const padding = Math.max(0, targetSec - current);
  await runCommand(ffmpeg(), [
    "-y",
    "-i",
    inputPath,
    "-af",
    `apad=pad_dur=${padding.toFixed(3)}`,
    "-t",
    targetSec.toFixed(3),
    "-ar",
    "48000",
    "-ac",
    "1",
    "-c:a",
    "pcm_s16le",
    tempPath,
  ]);
  await rename(tempPath, inputPath);
}

export async function concatVideos(
  clipPaths: string[],
  outputPath: string,
): Promise<void> {
  if (!clipPaths.length) throw new Error("concatVideos: clips rỗng");
  await mkdir(dirname(outputPath), { recursive: true });
  const tempDir = await mkdtemp(join(tmpdir(), "evf-vconcat-"));
  try {
    const listPath = join(tempDir, "list.txt");
    const content = clipPaths
      .map((path) => `file '${resolve(path).replace(/\\/g, "/").replace(/'/g, "'\\''")}'`)
      .join("\n");
    await writeFile(listPath, content, "utf8");
    await runCommand(ffmpeg(), [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-c",
      "copy",
      outputPath,
    ]);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function fitClipToDuration(
  inputPath: string,
  targetSec: number,
  outputPath: string,
  fps: number,
): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });
  const current = await durationSec(inputPath);
  const target = Math.max(0.1, targetSec);
  const args = ["-y", "-i", inputPath];
  if (target > current + 0.02) {
    args.push(
      "-vf",
      `tpad=stop_mode=clone:stop_duration=${(target - current).toFixed(3)}`,
    );
  }
  args.push(
    "-t",
    target.toFixed(3),
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    "-r",
    String(fps),
    "-movflags",
    "+faststart",
    outputPath,
  );
  await runCommand(ffmpeg(), args);
}

export async function mixSfx(
  voicePath: string,
  sfx: SfxMixSpec[],
  outputPath: string,
): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });
  if (!sfx.length) {
    await runCommand(ffmpeg(), [
      "-y",
      "-i",
      voicePath,
      "-ar",
      "48000",
      "-ac",
      "1",
      "-c:a",
      "libmp3lame",
      "-b:a",
      "192k",
      outputPath,
    ]);
    return;
  }

  const args = ["-y", "-i", voicePath];
  for (const item of sfx) args.push("-i", item.path);
  const filters: string[] = [
    "[0:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=mono[voice]",
  ];
  const labels: string[] = [];
  sfx.forEach((item, index) => {
    const input = index + 1;
    const label = `s${index}`;
    const delay = Math.max(0, Math.round(item.startSec * 1000));
    filters.push(
      `[${input}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=mono,` +
        `adelay=${delay}|${delay},volume=${item.volume}[${label}]`,
    );
    labels.push(`[${label}]`);
  });
  if (labels.length === 1) {
    filters.push(`[voice]${labels[0]!}amix=inputs=2:duration=first:normalize=0[out]`);
  } else {
    filters.push(`${labels.join("")}amix=inputs=${labels.length}:normalize=0[sfx]`);
    filters.push("[voice][sfx]amix=inputs=2:duration=first:normalize=0[out]");
  }
  args.push(
    "-filter_complex",
    filters.join(";"),
    "-map",
    "[out]",
    "-ar",
    "48000",
    "-ac",
    "1",
    "-c:a",
    "libmp3lame",
    "-b:a",
    "192k",
    outputPath,
  );
  await runCommand(ffmpeg(), args);
}

export async function muxVideoAudio(
  videoPath: string,
  audioPath: string,
  outputPath: string,
): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });
  await runCommand(ffmpeg(), [
    "-y",
    "-i",
    videoPath,
    "-i",
    audioPath,
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
}
