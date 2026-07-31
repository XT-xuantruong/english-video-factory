import { afterEach, describe, expect, it, vi } from "vitest";
import type { AudioSegment } from "../packages/domain/src/index.js";
import { PythonTtsClient } from "../packages/tts-client/src/index.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PythonTtsClient", () => {
  it("keeps pauses in the Node timeline and does not send them to the TTS API", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        outputDir: string;
        segments: Array<Record<string, unknown>>;
      };
      expect(body.outputDir).toBe("output/audio");
      expect(body.segments).toHaveLength(1);
      expect(body.segments[0]).not.toHaveProperty("pauseAfterMs");
      expect(body.segments[0]).not.toHaveProperty("pauseBeforeMs");
      expect(body.segments[0]).toMatchObject({
        id: "quiz-prompt",
        language: "vi",
        text: "Hãy bình luận đáp án trước khi xem kết quả nhé.",
      });

      return new Response(
        JSON.stringify({
          items: [
            {
              id: "quiz-prompt",
              outputPath: "output/audio/quiz-prompt.wav",
              durationMs: 1200,
              contentHash: "hash",
              cached: false,
              provider: "vieneu",
              voice: "Trúc Ly",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const segment: AudioSegment = {
      id: "quiz-prompt",
      language: "vi",
      text: "Hãy bình luận đáp án trước khi xem kết quả nhé.",
      pauseBeforeMs: 7_000,
      pauseAfterMs: 10_000,
      rewritable: true,
    };

    const client = new PythonTtsClient("http://127.0.0.1:8124");
    const result = await client.synthesizeBatch([segment], "output/audio");

    expect(result.items).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
