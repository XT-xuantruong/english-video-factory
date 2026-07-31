import type { AudioSegment, TtsManifest } from "../../domain/src/index.js";

export class PythonTtsClient {
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs = Number(process.env.TTS_TIMEOUT_MS ?? 180_000),
  ) {}

  private async request(path: string, init?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await fetch(`${this.baseUrl.replace(/\/$/, "")}${path}`, {
        ...init,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async health(): Promise<boolean> {
    try {
      const response = await this.request("/health");
      return response.ok;
    } catch {
      return false;
    }
  }

  async voices(): Promise<unknown> {
    const response = await this.request("/voices");
    if (!response.ok) throw new Error(`TTS voices failed: HTTP ${response.status}`);
    return await response.json();
  }

  async synthesizeBatch(
    segments: AudioSegment[],
    outputDir: string,
  ): Promise<TtsManifest> {
    const response = await this.request("/v1/synthesize/batch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        outputDir,
        segments: segments.map((segment) => ({
          id: segment.id,
          language: segment.language,
          text: segment.text,
          voice: segment.voice,
          style: segment.style,
          rate: segment.rate,
          pitch: segment.pitch,
        })),
      }),
    });
    if (!response.ok) {
      throw new Error(`Python TTS service lỗi ${response.status}: ${await response.text()}`);
    }
    return (await response.json()) as TtsManifest;
  }
}
