import { spawn } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, parse, resolve } from "node:path";

export interface RunCommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  stdio?: "inherit" | "pipe";
  timeoutMs?: number;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  code: number;
}

export async function runCommand(
  command: string,
  args: string[],
  options: RunCommandOptions = {},
): Promise<CommandResult> {
  return await new Promise<CommandResult>((resolvePromise, reject) => {
    const stdio = options.stdio ?? "pipe";
    let settled = false;
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: stdio === "inherit" ? "inherit" : ["ignore", "pipe", "pipe"],
      windowsHide: true,
      shell: false,
    });

    let stdout = "";
    let stderr = "";
    if (stdio === "pipe") {
      child.stdout?.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });
    }

    const finishError = (error: Error): void => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      reject(error);
    };

    const timer = options.timeoutMs
      ? setTimeout(() => {
          child.kill("SIGTERM");
          finishError(
            new Error(`Command timed out after ${options.timeoutMs}ms: ${command}`),
          );
        }, options.timeoutMs)
      : undefined;

    child.once("error", (error) => finishError(error));
    child.once("close", (code) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      const exitCode = code ?? 1;
      if (exitCode === 0) {
        resolvePromise({ stdout, stderr, code: exitCode });
        return;
      }
      const tail = stderr.trim().slice(-2400);
      reject(
        new Error(
          `${command} failed with exit code ${exitCode}${tail ? `\n${tail}` : ""}`,
        ),
      );
    });
  });
}

const require = createRequire(import.meta.url);

async function locatePackageJson(packageName: string): Promise<string> {
  try {
    return require.resolve(`${packageName}/package.json`);
  } catch {
    // Some packages hide package.json through package exports. Resolve the main
    // module, then walk upward until the matching package.json is found.
    let cursor = dirname(require.resolve(packageName));
    const root = parse(cursor).root;
    while (cursor !== root) {
      const candidate = join(cursor, "package.json");
      try {
        await access(candidate);
        const parsed = JSON.parse(await readFile(candidate, "utf8")) as {
          name?: string;
        };
        if (parsed.name === packageName) return candidate;
      } catch {
        // Continue upward.
      }
      cursor = dirname(cursor);
    }
    throw new Error(`Không tìm thấy package.json của ${packageName}`);
  }
}

export async function resolvePackageBin(
  packageName: string,
  binName = packageName,
): Promise<string> {
  const packageJsonPath = await locatePackageJson(packageName);
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
    bin?: string | Record<string, string>;
  };
  const bin =
    typeof packageJson.bin === "string"
      ? packageJson.bin
      : packageJson.bin?.[binName] ?? Object.values(packageJson.bin ?? {})[0];
  if (!bin) throw new Error(`Package ${packageName} không khai báo executable`);
  return resolve(dirname(packageJsonPath), bin);
}

export async function runPackageBin(
  packageName: string,
  binName: string,
  args: string[],
  options: RunCommandOptions = {},
): Promise<CommandResult> {
  const binPath = await resolvePackageBin(packageName, binName);
  return await runCommand(process.execPath, [binPath, ...args], options);
}
