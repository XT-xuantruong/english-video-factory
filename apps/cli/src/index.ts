#!/usr/bin/env node
import "dotenv/config";
import { Command, Option } from "commander";
import { access, readFile, readdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
  composeScript,
  composeVocabularyRecallScript,
} from "../../../packages/scripting/src/index.js";
import {
  listExcelSheets,
  readContentsFromExcel,
} from "../../../packages/excel/src/index.js";
import { readJson, writeJson } from "../../../packages/shared/src/index.js";
import {
  validateImprovedScript,
  validateScript,
} from "../../../packages/quality/src/index.js";
import { renderVideo } from "../../../packages/pipeline/src/index.js";
import {
  HyperframesRenderer,
  type RenderQuality,
} from "../../../packages/hyperframes/src/index.js";
import { PythonTtsClient } from "../../../packages/tts-client/src/index.js";
import { runCommand } from "../../../packages/process/src/index.js";
import { listAllBlueprints } from "../../../packages/blueprints/src/index.js";
import { listSceneTemplateContracts } from "../../../packages/scenes/src/index.js";
import { validateTemplateTheme } from "../../../packages/theme/src/index.js";
import type {
  ContentInput,
  VideoScript,
  VocabularyContent,
} from "../../../packages/domain/src/index.js";

const excelDefault = process.env.EXCEL_PATH ?? "data/content.xlsx";
const outputDefault = process.env.OUTPUT_DIR ?? "output";
const ttsUrl = process.env.TTS_SERVICE_URL ?? "http://127.0.0.1:8124";

function normalizeUserArgs(argv = process.argv): string[] {
  const args = argv.slice(2);
  while (args[0] === "--") args.shift();
  return args;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function findContent(
  excelPath: string,
  id: string,
): Promise<{ content: ContentInput; contents: ContentInput[] }> {
  const contents = await readContentsFromExcel(excelPath);
  const content = contents.find((item) => item.id === id);
  if (!content) throw new Error(`Không tìm thấy content id '${id}' trong ${excelPath}`);
  return { content, contents };
}

function scriptPaths(outputDir: string, id: string): {
  root: string;
  base: string;
  working: string;
} {
  const root = join(outputDir, id);
  return {
    root,
    base: join(root, "script.base.json"),
    working: join(root, "script.json"),
  };
}

async function createScriptFiles(args: {
  content: ContentInput;
  allContents: ContentInput[];
  excelPath: string;
  outputDir: string;
  blueprintId?: string;
  force?: boolean;
}): Promise<{ basePath: string; workingPath: string; script: VideoScript }> {
  const vocabulary = args.allContents.filter(
    (item): item is VocabularyContent => item.contentType === "vocabulary",
  );
  if (args.content.contentType === "vocabulary_recall" && args.blueprintId) {
    throw new Error(
      "vocabulary_recall dùng fixed blueprint 'vocabulary-meaning-recall'; không hỗ trợ --blueprint",
    );
  }
  const script =
    args.content.contentType === "vocabulary"
      ? composeScript(args.content, {
          excelPath: args.excelPath,
          blueprintId: args.blueprintId,
        })
      : composeVocabularyRecallScript(args.content, vocabulary, {
          excelPath: args.excelPath,
        });
  const paths = scriptPaths(args.outputDir, args.content.id);
  await writeJson(paths.base, script);
  console.log(`✓ Base: ${paths.base}`);
  if (args.force || !(await exists(paths.working))) {
    await writeJson(paths.working, script);
    console.log(`✓ Script: ${paths.working}`);
  } else {
    console.log(`↷ Giữ nguyên script đã có: ${paths.working}`);
    console.log("  Dùng --force để ghi đè bản đã được improve.");
  }
  return { basePath: paths.base, workingPath: paths.working, script };
}

async function checkCommand(
  label: string,
  command: string,
  args: string[],
): Promise<boolean> {
  try {
    const result = await runCommand(command, args, { timeoutMs: 15_000 });
    const version = (result.stdout || result.stderr).trim().split("\n")[0];
    console.log(`✓ ${label}${version ? ` — ${version}` : ""}`);
    return true;
  } catch (error) {
    console.log(`✗ ${label} — ${error instanceof Error ? error.message.split("\n")[0] : error}`);
    return false;
  }
}

async function checkPython(): Promise<boolean> {
  const candidates: Array<[string, string[]]> =
    process.platform === "win32"
      ? [
          ["python", ["--version"]],
          ["py", ["-3", "--version"]],
        ]
      : [
          ["python3", ["--version"]],
          ["python", ["--version"]],
        ];
  for (const [command, args] of candidates) {
    try {
      const result = await runCommand(command, args, { timeoutMs: 15_000 });
      console.log(`✓ python — ${(result.stdout || result.stderr).trim()}`);
      return true;
    } catch {
      // Try next command.
    }
  }
  console.log("✗ python");
  return false;
}

const program = new Command()
  .name("evf")
  .description("English Video Factory — Excel → script → TTS → HyperFrames → FFmpeg")
  .version("3.2.0")
  .showHelpAfterError()
  .configureHelp({ sortSubcommands: true, sortOptions: true });

program
  .command("doctor")
  .description("Kiểm tra Node, Python, FFmpeg, HyperFrames, TTS và Excel")
  .option("--excel <path>", "Đường dẫn Excel", excelDefault)
  .action(async (options: { excel: string }) => {
    let failed = false;
    failed ||= !(await checkCommand("node", process.execPath, ["--version"]));
    failed ||= !(await checkPython());
    failed ||= !(await checkCommand("ffmpeg", process.env.FFMPEG_BIN ?? "ffmpeg", ["-version"]));
    failed ||= !(await checkCommand("ffprobe", process.env.FFPROBE_BIN ?? "ffprobe", ["-version"]));
    try {
      const version = await new HyperframesRenderer().doctor();
      console.log(`✓ hyperframes — ${version}`);
    } catch (error) {
      console.log(`✗ hyperframes — ${error instanceof Error ? error.message.split("\n")[0] : error}`);
      failed = true;
    }
    const ttsOk = await new PythonTtsClient(ttsUrl).health();
    console.log(`${ttsOk ? "✓" : "✗"} Python TTS service — ${ttsUrl}`);
    failed ||= !ttsOk;
    try {
      await access(options.excel);
      const sheets = await listExcelSheets(options.excel);
      console.log(`✓ Excel — ${options.excel} [${sheets.join(", ")}]`);
    } catch (error) {
      console.log(`✗ Excel — ${error instanceof Error ? error.message : options.excel}`);
      failed = true;
    }
    if (failed) process.exitCode = 1;
  });

const content = program.command("content").description("Đọc và kiểm tra input Excel");
content
  .command("validate")
  .description("Validate toàn bộ content trong các sheet được hỗ trợ")
  .option("--excel <path>", "Đường dẫn Excel", excelDefault)
  .action(async (options: { excel: string }) => {
    const contents = await readContentsFromExcel(options.excel);
    const vocabulary = contents.filter((item) => item.contentType === "vocabulary");
    const recall = contents.filter((item) => item.contentType === "vocabulary_recall");
    console.log(
      `✓ ${vocabulary.length} vocabulary và ${recall.length} vocabulary_recall hợp lệ; ` +
        `${contents.filter((item) => item.enabled).length} enabled`,
    );
  });

content
  .command("list")
  .description("Liệt kê content trong Excel")
  .option("--excel <path>", "Đường dẫn Excel", excelDefault)
  .option("--level <level>", "Lọc level")
  .option("--quiz-type <type>", "Lọc quiz_type")
  .option("--enabled", "Chỉ hiện nội dung enabled")
  .action(
    async (options: {
      excel: string;
      level?: string;
      quizType?: string;
      enabled?: boolean;
    }) => {
      let contents = await readContentsFromExcel(options.excel);
      if (options.level) contents = contents.filter((item) => item.level === options.level);
      if (options.quizType) {
        contents = contents.filter(
          (item) => item.contentType === "vocabulary" && item.quiz.type === options.quizType,
        );
      }
      if (options.enabled) contents = contents.filter((item) => item.enabled);
      console.table(
        contents.map((item) => ({
          id: item.id,
          type: item.contentType,
          word:
            item.contentType === "vocabulary"
              ? item.word
              : `${item.wordIds.length} từ`,
          quiz_type:
            item.contentType === "vocabulary" ? item.quiz.type : "meaning_recall",
          level: item.level,
          status: item.status,
          enabled: item.enabled,
        })),
      );
    },
  );

content
  .command("show")
  .description("Hiển thị một content đã normalize")
  .requiredOption("--id <id>", "Content id")
  .option("--excel <path>", "Đường dẫn Excel", excelDefault)
  .option("--json", "Xuất JSON machine-readable")
  .action(async (options: { id: string; excel: string; json?: boolean }) => {
    const { content: item } = await findContent(options.excel, options.id);
    if (options.json) console.log(JSON.stringify(item, null, 2));
    else console.dir(item, { depth: null });
  });

const blueprint = program.command("blueprints").description("Danh mục fixed blueprints");
blueprint.command("list").description("Liệt kê vocabulary blueprints").action(() => {
  console.table(
    listAllBlueprints().map((item) => ({
      id: item.id,
      type: item.contentType,
      quiz_type: "quizType" in item ? item.quizType : "meaning_recall",
      scenes: item.scenes.map((scene) => scene.templateId).join(" → "),
    })),
  );
});

const script = program.command("script").description("Tạo và validate script JSON");
script
  .command("create")
  .description("Tạo script.base.json và script.json từ content id")
  .requiredOption("--id <id>", "Content id")
  .option("--excel <path>", "Đường dẫn Excel", excelDefault)
  .option("--output <dir>", "Thư mục output", outputDefault)
  .option("--blueprint <id>", "Override blueprint; phải khớp quiz_type")
  .option("--force", "Ghi đè script.json đã được improve")
  .action(
    async (options: {
      id: string;
      excel: string;
      output: string;
      blueprint?: string;
      force?: boolean;
    }) => {
      const { content: item, contents } = await findContent(options.excel, options.id);
      await createScriptFiles({
        content: item,
        allContents: contents,
        excelPath: options.excel,
        outputDir: options.output,
        blueprintId: options.blueprint,
        force: options.force,
      });
    },
  );

script
  .command("validate")
  .description("Validate schema, blueprint, scene contract và phạm vi import-script/improve-script-all")
  .requiredOption("--script <path>", "Đường dẫn script.json")
  .option("--base <path>", "Đường dẫn script.base.json; mặc định cùng thư mục")
  .action(async (options: { script: string; base?: string }) => {
    const raw = await readJson(options.script);
    const parsed = await validateScript(raw);
    const renderer = new HyperframesRenderer();
    for (const scene of parsed.scenes) {
      await renderer.validateTemplate(scene.templateId, parsed.video.aspect);
    }
    const basePath = options.base ?? join(dirname(options.script), "script.base.json");
    if (await exists(basePath)) {
      const report = await validateImprovedScript(await readJson(basePath), raw);
      console.log(
        `✓ Script hợp lệ: ${parsed.scenes.length} scenes; ${report.changedSegments} câu được rewrite`,
      );
      return;
    }
    console.log(`✓ Script hợp lệ: ${parsed.scenes.length} scenes; không có base để kiểm tra diff`);
  });

const scripts = program.command("scripts").description("Tạo hoặc validate nhiều script");
scripts
  .command("create-all")
  .description("Tạo script cho toàn bộ vocabulary enabled")
  .option("--excel <path>", "Đường dẫn Excel", excelDefault)
  .option("--output <dir>", "Thư mục output", outputDefault)
  .option("--quiz-type <type>", "Lọc quiz_type")
  .option("--force", "Ghi đè script.json đã được improve")
  .action(
    async (options: {
      excel: string;
      output: string;
      quizType?: string;
      force?: boolean;
    }) => {
      let contents = (await readContentsFromExcel(options.excel)).filter((item) => item.enabled);
      if (options.quizType) {
        contents = contents.filter(
          (item) => item.contentType === "vocabulary" && item.quiz.type === options.quizType,
        );
      }
      for (const item of contents) {
        await createScriptFiles({
          content: item,
          allContents: contents,
          excelPath: options.excel,
          outputDir: options.output,
          force: options.force,
        });
      }
    },
  );

scripts
  .command("validate-all")
  .description("Validate tất cả output/*/script.json sau khi chạy skill")
  .option("--output <dir>", "Thư mục output", outputDefault)
  .action(async (options: { output: string }) => {
    const root = resolve(options.output);
    const entries = await readdir(root, { withFileTypes: true });
    let count = 0;
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const working = join(root, entry.name, "script.json");
      const base = join(root, entry.name, "script.base.json");
      if (!(await exists(working))) continue;
      const raw = await readJson(working);
      await validateScript(raw);
      if (await exists(base)) await validateImprovedScript(await readJson(base), raw);
      console.log(`✓ ${working}`);
      count += 1;
    }
    if (!count) throw new Error(`Không tìm thấy script.json trong ${root}`);
    console.log(`✓ Đã validate ${count} scripts`);
  });

const qualityOption = new Option("--quality <quality>", "HyperFrames quality")
  .choices(["draft", "standard", "high"])
  .default(process.env.HYPERFRAMES_QUALITY ?? "standard");

const video = program.command("video").description("Tạo hoặc render một video");
video
  .command("render")
  .description("Render script.json đã tạo hoặc đã được improve")
  .requiredOption("--script <path>", "Đường dẫn script.json")
  .option("--output <dir>", "Thư mục output", outputDefault)
  .option("--scene <id>", "Chỉ render một scene preview")
  .option("--force", "Tạo lại audio và clip")
  .option("--no-sfx", "Tắt SFX")
  .addOption(qualityOption)
  .action(
    async (options: {
      script: string;
      output: string;
      scene?: string;
      force?: boolean;
      sfx: boolean;
      quality: RenderQuality;
    }) => {
      const basePath = join(dirname(options.script), "script.base.json");
      const raw = await readJson(options.script);
      if (await exists(basePath)) await validateImprovedScript(await readJson(basePath), raw);
      const path = await renderVideo(raw, {
        outputDir: options.output,
        sceneId: options.scene,
        force: Boolean(options.force),
        sfx: options.sfx,
        quality: options.quality,
      });
      console.log(`✓ ${path}`);
    },
  );

video
  .command("create")
  .description("Tạo script deterministic rồi render một video")
  .requiredOption("--id <id>", "Content id")
  .option("--excel <path>", "Đường dẫn Excel", excelDefault)
  .option("--output <dir>", "Thư mục output", outputDefault)
  .option("--blueprint <id>", "Override blueprint; phải khớp quiz_type")
  .option("--force", "Ghi đè script và tạo lại cache")
  .option("--no-sfx", "Tắt SFX")
  .addOption(
    new Option("--quality <quality>", "HyperFrames quality")
      .choices(["draft", "standard", "high"])
      .default(process.env.HYPERFRAMES_QUALITY ?? "standard"),
  )
  .action(
    async (options: {
      id: string;
      excel: string;
      output: string;
      blueprint?: string;
      force?: boolean;
      sfx: boolean;
      quality: RenderQuality;
    }) => {
      const { content: item, contents } = await findContent(options.excel, options.id);
      const created = await createScriptFiles({
        content: item,
        allContents: contents,
        excelPath: options.excel,
        outputDir: options.output,
        blueprintId: options.blueprint,
        force: options.force,
      });
      const raw = await readJson(created.workingPath);
      await validateImprovedScript(await readJson(created.basePath), raw);
      const path = await renderVideo(raw, {
        outputDir: options.output,
        force: Boolean(options.force),
        sfx: options.sfx,
        quality: options.quality,
      });
      console.log(`✓ ${path}`);
    },
  );

const videos = program.command("videos").description("Render nhiều video");
videos
  .command("render-all")
  .description("Render tất cả output/*/script.json")
  .option("--output <dir>", "Thư mục output", outputDefault)
  .option("--force", "Tạo lại audio và clip")
  .option("--continue-on-error", "Tiếp tục khi một video lỗi")
  .option("--no-sfx", "Tắt SFX")
  .addOption(
    new Option("--quality <quality>", "HyperFrames quality")
      .choices(["draft", "standard", "high"])
      .default(process.env.HYPERFRAMES_QUALITY ?? "standard"),
  )
  .action(
    async (options: {
      output: string;
      force?: boolean;
      continueOnError?: boolean;
      sfx: boolean;
      quality: RenderQuality;
    }) => {
      const root = resolve(options.output);
      const entries = await readdir(root, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const working = join(root, entry.name, "script.json");
        const base = join(root, entry.name, "script.base.json");
        if (!(await exists(working))) continue;
        try {
          const raw = await readJson(working);
          if (await exists(base)) await validateImprovedScript(await readJson(base), raw);
          await renderVideo(raw, {
            outputDir: options.output,
            force: Boolean(options.force),
            sfx: options.sfx,
            quality: options.quality,
          });
        } catch (error) {
          console.error(`✗ ${entry.name}: ${error instanceof Error ? error.message : error}`);
          if (!options.continueOnError) throw error;
        }
      }
    },
  );

const templates = program.command("templates").description("Quản lý scene templates");
templates.command("list").description("Liệt kê scene templates đã đăng ký").action(async () => {
  const rendererTemplates = new Map(
    (await new HyperframesRenderer().listTemplates()).map((item) => [item.id, item]),
  );
  console.table(
    listSceneTemplateContracts().map((contract) => ({
      id: contract.id,
      kind: contract.kind,
      role: contract.role,
      exists: rendererTemplates.has(contract.id),
      duration: `${contract.recommendedDurationSec.min}-${contract.recommendedDurationSec.max}s`,
    })),
  );
});

templates
  .command("validate")
  .description("Kiểm tra toàn bộ scene templates đã đăng ký")
  .option("--id <id>", "Chỉ kiểm tra một template")
  .option("--lint", "Chạy hyperframes lint")
  .action(async (options: { id?: string; lint?: boolean }) => {
    const renderer = new HyperframesRenderer();
    const contracts = options.id
      ? listSceneTemplateContracts().filter((item) => item.id === options.id)
      : listSceneTemplateContracts();
    if (!contracts.length) throw new Error(`Không tìm thấy template '${options.id}'`);
    for (const contract of contracts) {
      await renderer.validateTemplate(contract.id);
      validateTemplateTheme(
        await readFile(resolve(renderer.templatesDir, contract.id, "index.html"), "utf8"),
        contract.id,
      );
      if (options.lint) await renderer.lint(contract.id);
      console.log(`✓ ${contract.id}`);
    }
  });

const cache = program.command("cache").description("Quản lý cache output");
cache
  .command("clean")
  .description("Xóa cache của một video hoặc toàn bộ output")
  .option("--id <id>", "Video id")
  .option("--output <dir>", "Thư mục output", outputDefault)
  .option("--all", "Xóa toàn bộ output")
  .action(async (options: { id?: string; output: string; all?: boolean }) => {
    if (!options.all && !options.id) throw new Error("Cần --id <id> hoặc --all");
    const target = options.all ? resolve(options.output) : resolve(options.output, options.id!);
    await rm(target, { recursive: true, force: true });
    console.log(`✓ Đã xóa ${target}`);
  });

try {
  await program.parseAsync(normalizeUserArgs(), { from: "user" });
} catch (error) {
  console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
