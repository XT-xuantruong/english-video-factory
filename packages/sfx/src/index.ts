import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export interface SfxIndex {
  [category: string]: string[];
}

export function indexSfxLibrary(sfxDir: string): SfxIndex {
  const index: SfxIndex = {};
  if (!existsSync(sfxDir)) return index;
  for (const category of readdirSync(sfxDir)) {
    const categoryDir = join(sfxDir, category);
    try {
      if (!statSync(categoryDir).isDirectory()) continue;
      const files = readdirSync(categoryDir)
        .filter((file) => /\.(mp3|wav|m4a)$/i.test(file))
        .sort();
      if (files.length) index[category] = files;
    } catch {
      // Ignore unreadable folders.
    }
  }
  return index;
}

const ROLE_CATEGORIES: Record<string, string[]> = {
  intro: ["transition", "reveal", "cinematic"],
  main: ["emphasis", "transition", "success"],
  outro: ["outro", "success"],
};

const KEYWORD_RULES: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /(sai|lỗi|đừng nói|wrong|mistake|error)/i, category: "fail" },
  { pattern: /(đúng|thành công|ghi nhớ|success|correct)/i, category: "success" },
  { pattern: /(quiz|câu hỏi|đáp án|answer|question)/i, category: "countdown" },
  { pattern: /(khám phá|hôm nay|ra mắt|reveal|discover)/i, category: "reveal" },
];

function stableIndex(seed: string, size: number): number {
  let hash = 0;
  for (const char of seed) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return Math.abs(hash) % size;
}

export function pickSfx(args: {
  role: "intro" | "main" | "outro";
  sceneId: string;
  text: string;
  index: SfxIndex;
}): string | undefined {
  const candidates: string[] = [];
  for (const rule of KEYWORD_RULES) {
    if (rule.pattern.test(args.text)) candidates.push(rule.category);
  }
  candidates.push(...(ROLE_CATEGORIES[args.role] ?? []));
  for (const category of candidates) {
    const files = args.index[category];
    if (!files?.length) continue;
    return join(category, files[stableIndex(args.sceneId, files.length)]!);
  }
  return undefined;
}

export function defaultSfxPlayback(relativePath: string): {
  volume: number;
  offsetSec: number;
} {
  const category = relativePath.split(/[\\/]/)[0];
  switch (category) {
    case "transition":
      return { volume: 0.3, offsetSec: 0 };
    case "countdown":
      return { volume: 0.25, offsetSec: 0.1 };
    case "fail":
      return { volume: 0.28, offsetSec: 0.1 };
    case "success":
      return { volume: 0.25, offsetSec: 0.2 };
    case "outro":
      return { volume: 0.25, offsetSec: 0.3 };
    default:
      return { volume: 0.25, offsetSec: 0.1 };
  }
}
