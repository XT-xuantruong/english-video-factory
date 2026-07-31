import JSZip from "jszip";
import { readFile } from "node:fs/promises";
import { posix } from "node:path";
import {
  VocabularyContentSchema,
  VocabularyRecallContentSchema,
  type ContentInput,
  type VocabularyContent,
  type VocabularyExample,
  type VocabularyRecallContent,
} from "../../domain/src/index.js";

interface WorkbookSheet {
  name: string;
  relationshipId: string;
  path: string;
}

interface ParsedWorkbook {
  zip: JSZip;
  sheets: WorkbookSheet[];
  sharedStrings: string[];
}

type ParsedRows = Map<number, Map<number, unknown>>;

function stripTagPrefixes(xml: string): string {
  return xml.replace(/<\/?[A-Za-z_][\w.-]*:/g, (tag) =>
    tag.startsWith("</") ? "</" : "<",
  );
}

function xmlDecode(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#([0-9]+);/g, (_, decimal: string) =>
      String.fromCodePoint(Number.parseInt(decimal, 10)),
    )
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function attributesOf(source: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const expression = /([A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  for (const match of source.matchAll(expression)) {
    const name = match[1];
    if (!name) continue;
    attributes[name] = xmlDecode(match[2] ?? match[3] ?? "");
  }
  return attributes;
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function booleanValue(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const normalized = text(value).toLowerCase();
  if (!normalized) return true;
  return !["0", "false", "no", "off", "disabled", "không"].includes(normalized);
}

function integerValue(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function splitList(value: unknown): string[] {
  return text(value)
    .split(/\r?\n|\|/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseExamples(value: unknown, rowNumber: number): VocabularyExample[] {
  const lines = text(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.map((line, index) => {
    const [sentenceEn = "", meaningVi = "", explanationVi = ""] = line
      .split("||")
      .map((part) => part.trim());
    if (!sentenceEn || !meaningVi) {
      throw new Error(
        `examples dòng ${rowNumber}, mục ${index + 1} phải có dạng: sentence_en || meaning_vi || explanation_vi`,
      );
    }
    return { sentenceEn, meaningVi, explanationVi };
  });
}

function columnIndex(reference: string): number {
  const letters = reference.match(/^[A-Za-z]+/)?.[0]?.toUpperCase();
  if (!letters) throw new Error(`Cell reference không hợp lệ: '${reference}'`);
  let result = 0;
  for (const character of letters) {
    result = result * 26 + character.charCodeAt(0) - 64;
  }
  return result;
}

function resolveSheetPath(target: string): string {
  const clean = target.replace(/\\/g, "/").replace(/^\//, "");
  return posix.normalize(clean.startsWith("xl/") ? clean : posix.join("xl", clean));
}

async function readZipText(zip: JSZip, path: string, required = true): Promise<string> {
  const entry = zip.file(path);
  if (!entry) {
    if (!required) return "";
    throw new Error(`XLSX thiếu part '${path}'`);
  }
  return await entry.async("string");
}

function parseRelationships(xml: string): Map<string, string> {
  const relationships = new Map<string, string>();
  const normalized = stripTagPrefixes(xml);
  for (const match of normalized.matchAll(/<Relationship\b([^>]*?)\/?\s*>/gi)) {
    const attributes = attributesOf(match[1] ?? "");
    const id = attributes.Id ?? attributes.id;
    const target = attributes.Target ?? attributes.target;
    if (id && target) relationships.set(id, target);
  }
  return relationships;
}

function parseSharedStrings(xml: string): string[] {
  if (!xml) return [];
  const normalized = stripTagPrefixes(xml);
  const values: string[] = [];
  for (const match of normalized.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/gi)) {
    const item = match[1] ?? "";
    const fragments = [...item.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)].map((part) =>
      xmlDecode(part[1] ?? ""),
    );
    values.push(fragments.join(""));
  }
  return values;
}

async function openWorkbook(filePath: string): Promise<ParsedWorkbook> {
  try {
    const zip = await JSZip.loadAsync(await readFile(filePath));
    const workbookXml = stripTagPrefixes(await readZipText(zip, "xl/workbook.xml"));
    const relationshipXml = await readZipText(zip, "xl/_rels/workbook.xml.rels");
    const relationships = parseRelationships(relationshipXml);
    const sheets: WorkbookSheet[] = [];

    for (const match of workbookXml.matchAll(/<sheet\b([^>]*?)\/?\s*>/gi)) {
      const attributes = attributesOf(match[1] ?? "");
      const name = attributes.name;
      const relationshipId = attributes["r:id"] ?? attributes.id;
      if (!name || !relationshipId) continue;
      const target = relationships.get(relationshipId);
      if (!target) {
        throw new Error(`Sheet '${name}' không có worksheet relationship '${relationshipId}'`);
      }
      sheets.push({ name, relationshipId, path: resolveSheetPath(target) });
    }

    if (!sheets.length) throw new Error("Workbook không chứa sheet nào");
    const sharedStrings = parseSharedStrings(
      await readZipText(zip, "xl/sharedStrings.xml", false),
    );
    return { zip, sheets, sharedStrings };
  } catch (error) {
    throw new Error(
      `Không đọc được Excel ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function cellValue(
  attributes: Record<string, string>,
  body: string,
  sharedStrings: string[],
): unknown {
  const type = attributes.t ?? "";
  if (type === "inlineStr") {
    return [...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)]
      .map((match) => xmlDecode(match[1] ?? ""))
      .join("");
  }

  const value = xmlDecode(body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i)?.[1] ?? "");
  if (type === "s") return sharedStrings[Number(value)] ?? "";
  if (type === "b") return value === "1" || value.toLowerCase() === "true";
  if (["str", "e", "d"].includes(type)) return value;
  if (!value) return "";
  const number = Number(value);
  return Number.isFinite(number) ? number : value;
}

function parseWorksheet(xml: string, sharedStrings: string[]): ParsedRows {
  const normalized = stripTagPrefixes(xml);
  const rows: ParsedRows = new Map();

  for (const rowMatch of normalized.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/gi)) {
    const rowAttributes = attributesOf(rowMatch[1] ?? "");
    const rowNumber = Number(rowAttributes.r);
    if (!Number.isInteger(rowNumber) || rowNumber < 1) continue;
    const cells = new Map<number, unknown>();
    const rowBody = rowMatch[2] ?? "";

    for (const cellMatch of rowBody.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/gi)) {
      const attributes = attributesOf(cellMatch[1] ?? "");
      const reference = attributes.r;
      if (!reference) continue;
      cells.set(columnIndex(reference), cellValue(attributes, cellMatch[2] ?? "", sharedStrings));
    }
    rows.set(rowNumber, cells);
  }
  return rows;
}

function headersOf(rows: ParsedRows, sheetName: string): Map<number, string> {
  const firstRow = rows.get(1);
  if (!firstRow) throw new Error(`Sheet '${sheetName}' không có header ở dòng 1`);
  const headers = new Map<number, string>();
  for (const [column, value] of firstRow) {
    const header = text(value).toLowerCase();
    if (header) headers.set(column, header);
  }
  if (!headers.size) throw new Error(`Sheet '${sheetName}' không có header ở dòng 1`);
  return headers;
}

function rowRecord(
  row: Map<number, unknown> | undefined,
  headers: Map<number, string>,
): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  for (const [column, key] of headers) record[key] = row?.get(column);
  return record;
}

const REQUIRED_VOCABULARY_HEADERS = [
  "id",
  "enabled",
  "status",
  "level",
  "topic",
  "word",
  "ipa",
  "part_of_speech",
  "meaning_vi",
  "usage_vi",
  "examples",
  "quiz_type",
  "quiz_question",
  "quiz_options",
  "quiz_answer",
  "quiz_explanation_vi",
  "countdown_sec",
] as const;

const REQUIRED_RECALL_HEADERS = [
  "id",
  "enabled",
  "status",
  "level",
  "topic",
  "word_ids",
  "countdown_sec",
] as const;

function validateHeaders(
  headers: Map<number, string>,
  sheetName: string,
  required: readonly string[],
): void {
  const available = new Set(headers.values());
  const missing = required.filter((header) => !available.has(header));
  if (missing.length) {
    throw new Error(`Sheet '${sheetName}' thiếu cột: ${missing.join(", ")}`);
  }
}

function vocabularySheet(workbook: ParsedWorkbook): WorkbookSheet {
  const sheet = workbook.sheets.find(
    (candidate) => candidate.name.trim().toLowerCase() === "vocabulary",
  );
  if (!sheet) {
    throw new Error(
      "Không tìm thấy sheet 'vocabulary'. Mỗi loại content phải nằm trong sheet riêng và release hiện tại hỗ trợ vocabulary.",
    );
  }
  return sheet;
}

export async function readVocabularyFromExcel(filePath: string): Promise<VocabularyContent[]> {
  const workbook = await openWorkbook(filePath);
  const sheet = vocabularySheet(workbook);
  const rows = parseWorksheet(
    await readZipText(workbook.zip, sheet.path),
    workbook.sharedStrings,
  );
  const headers = headersOf(rows, sheet.name);
  validateHeaders(headers, sheet.name, REQUIRED_VOCABULARY_HEADERS);
  const contents: VocabularyContent[] = [];
  const seenIds = new Set<string>();
  const lastRow = Math.max(1, ...rows.keys());

  for (let rowNumber = 2; rowNumber <= lastRow; rowNumber += 1) {
    const record = rowRecord(rows.get(rowNumber), headers);
    if (!text(record.id)) continue;

    try {
      const content = VocabularyContentSchema.parse({
        id: text(record.id),
        contentType: "vocabulary",
        enabled: booleanValue(record.enabled),
        status: text(record.status) || "draft",
        level: text(record.level) || "A1",
        topic: text(record.topic) || "Vocabulary",
        word: text(record.word),
        ipa: text(record.ipa),
        partOfSpeech: text(record.part_of_speech),
        meaningVi: text(record.meaning_vi),
        usageVi: text(record.usage_vi),
        examples: parseExamples(record.examples, rowNumber),
        quiz: {
          type: text(record.quiz_type),
          question: text(record.quiz_question),
          options: splitList(record.quiz_options),
          answer: text(record.quiz_answer),
          explanationVi: text(record.quiz_explanation_vi),
          countdownSec: integerValue(record.countdown_sec, 7),
        },
      });

      if (seenIds.has(content.id)) throw new Error(`Trùng id '${content.id}'`);
      seenIds.add(content.id);
      contents.push(content);
    } catch (error) {
      throw new Error(
        `Excel không hợp lệ tại sheet '${sheet.name}', dòng ${rowNumber}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  if (!contents.length) throw new Error(`Sheet '${sheet.name}' không có nội dung`);
  return contents;
}

function optionalSheet(workbook: ParsedWorkbook, name: string): WorkbookSheet | undefined {
  return workbook.sheets.find(
    (candidate) => candidate.name.trim().toLowerCase() === name.toLowerCase(),
  );
}

export async function readVocabularyRecallFromExcel(
  filePath: string,
): Promise<VocabularyRecallContent[]> {
  const workbook = await openWorkbook(filePath);
  const sheet = optionalSheet(workbook, "vocabulary_recall");
  if (!sheet) return [];

  const rows = parseWorksheet(
    await readZipText(workbook.zip, sheet.path),
    workbook.sharedStrings,
  );
  const headers = headersOf(rows, sheet.name);
  validateHeaders(headers, sheet.name, REQUIRED_RECALL_HEADERS);
  const contents: VocabularyRecallContent[] = [];
  const seenIds = new Set<string>();
  const lastRow = Math.max(1, ...rows.keys());

  for (let rowNumber = 2; rowNumber <= lastRow; rowNumber += 1) {
    const record = rowRecord(rows.get(rowNumber), headers);
    if (!text(record.id)) continue;

    try {
      const content = VocabularyRecallContentSchema.parse({
        id: text(record.id),
        contentType: "vocabulary_recall",
        enabled: booleanValue(record.enabled),
        status: text(record.status) || "draft",
        level: text(record.level) || "A1",
        topic: text(record.topic) || "Vocabulary recall",
        wordIds: splitList(record.word_ids),
        countdownSec: integerValue(record.countdown_sec, 7),
      });
      if (seenIds.has(content.id)) throw new Error(`Trùng id '${content.id}'`);
      seenIds.add(content.id);
      contents.push(content);
    } catch (error) {
      throw new Error(
        `Excel không hợp lệ tại sheet '${sheet.name}', dòng ${rowNumber}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  return contents;
}

export async function readContentsFromExcel(filePath: string): Promise<ContentInput[]> {
  const [vocabulary, recall] = await Promise.all([
    readVocabularyFromExcel(filePath),
    readVocabularyRecallFromExcel(filePath),
  ]);
  const ids = new Set<string>();
  for (const item of [...vocabulary, ...recall]) {
    if (ids.has(item.id)) throw new Error(`Trùng content id '${item.id}' giữa các sheet`);
    ids.add(item.id);
  }
  return [...vocabulary, ...recall];
}

export async function listExcelSheets(filePath: string): Promise<string[]> {
  return (await openWorkbook(filePath)).sheets.map((sheet) => sheet.name);
}
