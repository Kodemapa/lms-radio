import { z } from 'zod';

// ---- Question bank ------------------------------------------------------------

export const BankOptionSchema = z.object({ text: z.string().trim().min(1).max(500), isCorrect: z.boolean() });

export const BankQuestionInputSchema = z
  .object({
    topic: z.string().trim().max(80).nullable(),
    text: z.string().trim().min(1).max(1000),
    explanation: z.string().trim().max(2000).nullable(),
    options: z.array(BankOptionSchema).min(2, 'Needs at least two options').max(8, 'At most eight options'),
  })
  .refine((q) => q.options.some((o) => o.isCorrect), { message: 'Mark at least one correct answer', path: ['options'] });
export type BankQuestionInput = z.infer<typeof BankQuestionInputSchema>;

/** Import: topics are given by name and created when they don't exist yet. */
export const BankImportSchema = z.object({ questions: z.array(BankQuestionInputSchema).min(1).max(1000) });

/** Create or edit one bank question; the topic is picked from the course's topics. */
export const BankQuestionSaveSchema = z
  .object({
    topicId: z.string().uuid().nullable(),
    text: z.string().trim().min(1).max(1000),
    explanation: z.string().trim().max(2000).nullable(),
    options: z.array(BankOptionSchema).min(2, 'Needs at least two options').max(8, 'At most eight options'),
  })
  .refine((q) => q.options.some((o) => o.isCorrect), { message: 'Mark at least one correct answer', path: ['options'] });
export type BankQuestionSave = z.infer<typeof BankQuestionSaveSchema>;

/** Bulk actions on selected bank questions. `topicId: null` moves them to "No topic". */
export const BankBulkSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('move'), ids: z.array(z.string().uuid()).min(1).max(1000), topicId: z.string().uuid().nullable() }),
  z.object({ action: z.literal('delete'), ids: z.array(z.string().uuid()).min(1).max(1000) }),
]);
export type BankBulk = z.infer<typeof BankBulkSchema>;

// ---- Question topics ------------------------------------------------------------

export const TopicInputSchema = z.object({
  name: z.string().trim().min(1, 'Name the topic').max(80),
  description: z.string().trim().max(300).nullable(),
});
export type TopicInput = z.infer<typeof TopicInputSchema>;

export const TopicOrderSchema = z.object({ ids: z.array(z.string().uuid()).max(500) });

export const QuestionTopicSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  position: z.number().int(),
  /** Bank questions in this topic. */
  bankCount: z.number().int(),
  /** Quiz and in-video questions tagged with this topic. */
  lessonCount: z.number().int(),
});
export type QuestionTopic = z.infer<typeof QuestionTopicSchema>;

export const BankQuestionSchema = z.object({
  id: z.string().uuid(),
  topicId: z.string().uuid().nullable(),
  /** Topic name, for display. */
  topic: z.string().nullable(),
  text: z.string(),
  explanation: z.string().nullable(),
  allowMultiple: z.boolean(),
  options: z.array(z.object({ text: z.string(), isCorrect: z.boolean() })),
  /** How many quizzes / in-video questions use it. */
  usedCount: z.number().int(),
});
export type BankQuestion = z.infer<typeof BankQuestionSchema>;

export interface ParsedBank {
  questions: BankQuestionInput[];
  errors: { line: number; message: string }[];
}

const TOPIC = /^#\s*(.+)$/;
const QUESTION = /^(?:q\s*\d*\s*[:.)-]|\d+\s*[.)]|question\s*\d*\s*[:.)-])\s*(.+)$/i;
const MARKED_OPTION = /^([*+-])\s+(.+)$/;
const LETTER_OPTION = /^\(?([a-h])[).:]\s+(.+)$/i;
const ANSWER = /^(?:answer|ans|correct)\s*[:.-]\s*(.+)$/i;
const EXPLANATION = /^(?:explanation|exp|reason)\s*[:.-]\s*(.+)$/i;

/**
 * Parses pasted questions. Two styles are accepted, and can be mixed:
 *
 *   # Module 1                       (sets the topic for what follows)
 *   Q: Question text                 (or "1." / "1)" / "Question 1:")
 *   * correct option                 (+ also marks correct)
 *   - wrong option
 *   Explanation: why
 *
 *   2. Question text
 *   a) option   b) option ...        (one per line)
 *   Answer: b                        (several: "a, c")
 */
export function parseQuestionBank(input: string): ParsedBank {
  const questions: BankQuestionInput[] = [];
  const errors: ParsedBank['errors'] = [];
  let topic: string | null = null;
  type Draft = { line: number; text: string; options: { text: string; isCorrect: boolean; letter?: string }[]; answer?: string; explanation: string | null; topic: string | null };
  let draft: Draft | null = null;

  const finish = () => {
    if (!draft) return;
    const current: Draft = draft;
    draft = null;
    if (current.answer) {
      const letters = current.answer.toLowerCase().split(/[\s,;&/]+|and/).map((x) => x.replace(/[^a-h]/g, '')).filter(Boolean);
      for (const option of current.options) if (option.letter && letters.includes(option.letter)) option.isCorrect = true;
    }
    const candidate = {
      topic: current.topic,
      text: current.text,
      explanation: current.explanation,
      options: current.options.map(({ text, isCorrect }) => ({ text, isCorrect })),
    };
    const parsed = BankQuestionInputSchema.safeParse(candidate);
    if (parsed.success) questions.push(parsed.data);
    else errors.push({ line: current.line, message: `“${current.text.slice(0, 60)}”: ${parsed.error.issues[0]?.message}` });
  };

  input.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    const lineNo = index + 1;
    if (!line) return;
    let m: RegExpExecArray | null;
    if ((m = TOPIC.exec(line))) {
      finish();
      topic = m[1]!.trim();
    } else if ((m = MARKED_OPTION.exec(line)) && draft) {
      draft.options.push({ text: m[2]!.trim(), isCorrect: m[1] !== '-' });
    } else if ((m = LETTER_OPTION.exec(line)) && draft) {
      draft.options.push({ text: m[2]!.trim(), isCorrect: false, letter: m[1]!.toLowerCase() });
    } else if ((m = ANSWER.exec(line)) && draft) {
      draft.answer = m[1]!;
    } else if ((m = EXPLANATION.exec(line)) && draft) {
      draft.explanation = m[1]!.trim();
    } else if ((m = QUESTION.exec(line))) {
      finish();
      draft = { line: lineNo, text: m[1]!.trim(), options: [], explanation: null, topic };
    } else if (draft && draft.options.length === 0) {
      draft.text = `${draft.text} ${line}`; // question text over several lines
    } else if (draft?.explanation) {
      draft.explanation = `${draft.explanation} ${line}`;
    } else {
      errors.push({ line: lineNo, message: `Couldn't read “${line.slice(0, 60)}”. Start questions with “Q:” or “1.”` });
    }
  });
  finish();
  return { questions, errors };
}

// ---- Random papers --------------------------------------------------------------

/** Fisher–Yates shuffle (pure; `random` returns [0, 1)). */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Picks `count` distinct items at random (all of them if fewer). */
export function drawRandom<T>(items: readonly T[], count: number, random: () => number = Math.random): T[] {
  return shuffle(items, random).slice(0, Math.max(0, count));
}

// ---- Entrance test ----------------------------------------------------------------

export const EntranceSettingsSchema = z.object({
  enabled: z.boolean(),
  questionCount: z.number().int().min(1).max(100),
  passPercent: z.number().int().min(1).max(100),
  maxAttempts: z.number().int().min(1).max(20).nullable(),
  /** Draw only from this topic (null = whole bank). */
  topicId: z.string().uuid().nullable(),
});
export type EntranceSettings = z.infer<typeof EntranceSettingsSchema>;

export const EntranceStatusSchema = z.object({
  required: z.boolean(),
  passed: z.boolean(),
  attemptsUsed: z.number().int(),
  maxAttempts: z.number().int().nullable(),
  questionCount: z.number().int(),
  passPercent: z.number().int(),
  lastScore: z.number().int().nullable(),
  /** An unfinished attempt to resume. */
  openAttemptId: z.string().uuid().nullable(),
});
export type EntranceStatus = z.infer<typeof EntranceStatusSchema>;

export const EntrancePaperSchema = z.object({
  attemptId: z.string().uuid(),
  passPercent: z.number().int(),
  questions: z.array(
    z.object({
      id: z.string().uuid(),
      text: z.string(),
      allowMultiple: z.boolean(),
      /** `key` is the option's original index; order is already shuffled. */
      options: z.array(z.object({ key: z.number().int(), text: z.string() })),
    }),
  ),
});
export type EntrancePaper = z.infer<typeof EntrancePaperSchema>;

export const EntranceSubmitSchema = z.object({
  answers: z.record(z.string().uuid(), z.array(z.number().int().min(0).max(7)).max(8)),
});

export const EntranceResultSchema = z.object({
  scorePercent: z.number().int(),
  passed: z.boolean(),
  passPercent: z.number().int(),
  attemptsUsed: z.number().int(),
  maxAttempts: z.number().int().nullable(),
  correctCount: z.number().int(),
  total: z.number().int(),
});
export type EntranceResult = z.infer<typeof EntranceResultSchema>;

// ---- Certificate template ---------------------------------------------------------

export const SignatorySchema = z.object({
  name: z.string().trim().min(1).max(80),
  designation: z.string().trim().max(120),
  signatureAssetId: z.string().uuid().nullable(),
});
export type Signatory = z.infer<typeof SignatorySchema>;

export const CertificateTemplateSchema = z.object({
  heading: z.string().trim().min(1).max(80),
  preamble: z.string().trim().max(200),
  body: z.string().trim().max(400),
  issuerName: z.string().trim().max(120).nullable(),
  issuerTagline: z.string().trim().max(200).nullable(),
  logoAssetId: z.string().uuid().nullable(),
  accentColor: z.string().regex(/^#[0-9a-f]{6}$/i, 'Use a colour like #5a5bb5'),
  signatories: z.array(SignatorySchema).max(3),
  footerNote: z.string().trim().max(300).nullable(),
});
export type CertificateTemplate = z.infer<typeof CertificateTemplateSchema>;

export const DEFAULT_CERTIFICATE_TEMPLATE: CertificateTemplate = {
  heading: 'Certificate of Completion',
  preamble: 'This is to certify that',
  body: 'has successfully completed the course',
  issuerName: null,
  issuerTagline: null,
  logoAssetId: null,
  accentColor: '#5a5bb5',
  signatories: [],
  footerNote: null,
};

export interface CertificateVars {
  learnerName: string;
  courseTitle: string;
  issuedDate: string;
  serial: string;
}

/** Fills {learnerName}, {courseTitle}, {issuedDate}, {serial}; unknown tokens stay as typed. */
export function fillCertificateText(text: string, vars: CertificateVars): string {
  return text.replace(/\{(learnerName|courseTitle|issuedDate|serial)\}/g, (_, key: keyof CertificateVars) => vars[key]);
}

// ---- Spreadsheet import (CSV / Excel) ---------------------------------------------------

/** Anything a spreadsheet library hands back for a cell. */
export type SheetCell = unknown;

/** Columns understood by the spreadsheet import (case-insensitive; extra columns are ignored). */
export const QUESTION_SHEET_COLUMNS = [
  'Topic',
  'Question',
  'Option A',
  'Option B',
  'Option C',
  'Option D',
  'Option E',
  'Correct',
  'Explanation',
] as const;

/** Template learners/instructors can open in Excel, Google Sheets or Numbers. */
export const QUESTION_CSV_TEMPLATE = [
  QUESTION_SHEET_COLUMNS.join(','),
  'Module 1,"Nuchal translucency is measured when CRL is:",45–84 mm,20–40 mm,85–100 mm,,,A,ISUOG first-trimester guideline.',
  'Entrance,Which imaging methods use no ionising radiation?,Ultrasound,MRI,CT,X-ray,,"A, B",',
].join('\n');

/**
 * RFC 4180 CSV reader: quoted fields, escaped quotes, commas and line breaks
 * inside quotes, BOM. The delimiter (comma, semicolon or tab, as some Excel
 * locales export) is detected from the first line.
 */
export function parseCsv(text: string): string[][] {
  // Strip the byte-order mark Excel adds to CSV exports.
  const input = text.replace(/^\uFEFF/, '');
  const firstLine = input.split(/\r?\n/, 1)[0] ?? '';
  const counts = { ',': 0, ';': 0, '\t': 0 } as Record<string, number>;
  let quoted = false;
  for (const ch of firstLine) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && ch in counts) counts[ch]! += 1;
  }
  const delimiter = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]![1] > 0
    ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0]![0]
    : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    if (inQuotes) {
      if (ch === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

const cellText = (cell: SheetCell): string =>
  cell === null || cell === undefined
    ? ''
    : cell instanceof Date
      ? cell.toISOString().slice(0, 10)
      : String(cell).trim();

/**
 * Turns spreadsheet rows (header row first) into bank questions. Options are
 * the "Option A…H" columns (or "A…H" / "Option 1…8"); "Correct" holds letters
 * or numbers, e.g. "B" or "A, C" or "2".
 */
export function sheetToQuestions(rows: ReadonlyArray<ReadonlyArray<SheetCell>>): ParsedBank {
  const questions: BankQuestionInput[] = [];
  const errors: ParsedBank['errors'] = [];
  if (rows.length === 0) return { questions, errors: [{ line: 1, message: 'The file is empty.' }] };

  const header = rows[0]!.map((cell) => cellText(cell).toLowerCase().replace(/\s+/g, ' '));
  const find = (...names: string[]) => header.findIndex((h) => names.includes(h));
  const col = {
    topic: find('topic', 'module', 'section'),
    question: find('question', 'questions', 'question text'),
    correct: find('correct', 'answer', 'correct answer', 'correct option', 'answers'),
    explanation: find('explanation', 'reason', 'rationale'),
  };
  const optionCols: number[] = [];
  for (let i = 0; i < 8; i++) {
    const letter = String.fromCharCode(97 + i);
    const index = find(`option ${letter}`, letter, `option ${i + 1}`, `option${letter}`, `opt ${letter}`);
    if (index >= 0) optionCols.push(index);
  }
  if (col.question < 0 || optionCols.length < 2 || col.correct < 0) {
    return {
      questions,
      errors: [{ line: 1, message: 'Header row needs "Question", at least "Option A" and "Option B", and "Correct" columns.' }],
    };
  }

  rows.slice(1).forEach((row, index) => {
    const line = index + 2;
    const text = cellText(row[col.question]);
    if (!text && row.every((cell) => !cellText(cell))) return; // blank row
    const options = optionCols.map((c, i) => ({ letter: String.fromCharCode(97 + i), text: cellText(row[c]) })).filter((o) => o.text);
    const tokens = cellText(row[col.correct]).toLowerCase().split(/[\s,;&/]+|and/).filter(Boolean);
    const correct = new Set(
      tokens.map((tok) => (/^\d+$/.test(tok) ? String.fromCharCode(96 + Number(tok)) : tok.replace(/^option\s*/, ''))),
    );
    const candidate = {
      topic: col.topic >= 0 ? cellText(row[col.topic]) || null : null,
      text,
      explanation: col.explanation >= 0 ? cellText(row[col.explanation]) || null : null,
      options: options.map((o) => ({ text: o.text, isCorrect: correct.has(o.letter) })),
    };
    const parsed = BankQuestionInputSchema.safeParse(candidate);
    if (parsed.success) questions.push(parsed.data);
    else errors.push({ line, message: `“${text.slice(0, 50) || '(no question)'}”: ${parsed.error.issues[0]?.message}` });
  });
  return { questions, errors };
}
