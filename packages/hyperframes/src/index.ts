import { access, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { runPackageBin } from "../../process/src/index.js";

export type RenderQuality = "draft" | "standard" | "high";
export type Aspect = "9:16" | "16:9" | "1:1";

const aspectEntry: Record<Aspect, string> = {
  "9:16": "compositions/portrait.html",
  "16:9": "index.html",
  "1:1": "compositions/square.html",
};

export interface RenderSceneInput {
  templateId: string;
  inputs: Record<string, unknown>;
  outputPath: string;
  aspect: Aspect;
  fps: number;
  quality: RenderQuality;
}

export interface TemplateInfo {
  id: string;
  name: string;
  hasPortrait: boolean;
  hasLandscape: boolean;
  hasSquare: boolean;
}

export class HyperframesRenderer {
  readonly templatesDir: string;

  constructor(templatesDir = process.env.TEMPLATES_DIR ?? "templates") {
    this.templatesDir = resolve(templatesDir);
  }

  private templateDir(templateId: string): string {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(templateId)) {
      throw new Error(`templateId không hợp lệ: ${templateId}`);
    }
    return resolve(this.templatesDir, templateId);
  }

  async validateTemplate(templateId: string, aspect: Aspect = "9:16"): Promise<string> {
    const directory = this.templateDir(templateId);
    await access(join(directory, "hyperframes.json"));
    await access(join(directory, "index.html"));
    const preferred = join(directory, aspectEntry[aspect]);
    return existsSync(preferred) ? aspectEntry[aspect] : "index.html";
  }

  async listTemplates(): Promise<TemplateInfo[]> {
    const entries = await readdir(this.templatesDir, { withFileTypes: true });
    const templates: TemplateInfo[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const directory = join(this.templatesDir, entry.name);
      if (!existsSync(join(directory, "hyperframes.json"))) continue;
      let name = entry.name;
      try {
        const meta = JSON.parse(await readFile(join(directory, "meta.json"), "utf8")) as {
          name?: string;
        };
        name = meta.name ?? name;
      } catch {
        // meta.json is optional.
      }
      templates.push({
        id: entry.name,
        name,
        hasPortrait: existsSync(join(directory, "compositions/portrait.html")),
        hasLandscape: existsSync(join(directory, "index.html")),
        hasSquare: existsSync(join(directory, "compositions/square.html")),
      });
    }
    return templates.sort((a, b) => a.id.localeCompare(b.id));
  }

  async doctor(): Promise<string> {
    const result = await runPackageBin("hyperframes", "hyperframes", ["--version"]);
    return result.stdout.trim() || result.stderr.trim();
  }

  async lint(templateId: string): Promise<void> {
    const directory = this.templateDir(templateId);
    await runPackageBin("hyperframes", "hyperframes", ["lint"], {
      cwd: directory,
      stdio: "inherit",
    });
  }

  async render(input: RenderSceneInput): Promise<void> {
    const directory = this.templateDir(input.templateId);
    const composition = await this.validateTemplate(input.templateId, input.aspect);
    const outputPath = resolve(input.outputPath);
    await mkdir(dirname(outputPath), { recursive: true });

    const tempDirectory = await mkdtemp(join(tmpdir(), "evf-hf-vars-"));
    const variablesPath = join(tempDirectory, "variables.json");
    await writeFile(variablesPath, JSON.stringify(input.inputs), "utf8");

    const commonArgs = [
      "--output",
      outputPath,
      "--fps",
      String(input.fps),
      "--quality",
      input.quality,
      "--variables-file",
      variablesPath,
      "--workers",
      process.env.HYPERFRAMES_WORKERS ?? "1",
    ];

    try {
      // Project directory + relative composition path matches the reference pipeline.
      await runPackageBin(
        "hyperframes",
        "hyperframes",
        ["render", directory, "--composition", composition, ...commonArgs],
        { stdio: "inherit", timeoutMs: 30 * 60_000 },
      );
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  }
}
