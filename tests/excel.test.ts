import { describe, expect, it } from "vitest";
import {
  readContentsFromExcel,
  readVocabularyFromExcel,
  readVocabularyRecallFromExcel,
} from "../packages/excel/src/index.js";
import { listVocabularyBlueprints } from "../packages/blueprints/src/index.js";

describe("sample Excel workbook", () => {
  it("loads one vocabulary row for every registered quiz blueprint", async () => {
    const rows = await readVocabularyFromExcel("data/content.xlsx");
    expect(rows).toHaveLength(6);
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
    expect(new Set(rows.map((row) => row.quiz.type))).toEqual(
      new Set(listVocabularyBlueprints().map((blueprint) => blueprint.quizType)),
    );
    expect(rows.every((row) => row.examples.length >= 2 && row.examples.length <= 3)).toBe(
      true,
    );
    expect(
      rows.every((row) => row.quiz.countdownSec >= 5 && row.quiz.countdownSec <= 10),
    ).toBe(true);
  });

  it("loads a fixed five-word vocabulary recall video", async () => {
    const recall = await readVocabularyRecallFromExcel("data/content.xlsx");
    expect(recall).toHaveLength(1);
    expect(recall[0]?.id).toBe("daily-recall-01");
    expect(recall[0]?.wordIds).toHaveLength(5);
    expect(recall[0]?.countdownSec).toBe(7);

    const all = await readContentsFromExcel("data/content.xlsx");
    expect(all).toHaveLength(7);
  });
});
