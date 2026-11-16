import { describe, expect, it } from 'vitest';
import {
  drawRandom,
  fillCertificateText,
  parseCsv,
  parseQuestionBank,
  QUESTION_CSV_TEMPLATE,
  sheetToQuestions,
  shuffle,
} from './assessment.js';

describe('parseQuestionBank', () => {
  it('reads the marker style with topics and explanations', () => {
    const { questions, errors } = parseQuestionBank(`
# Module 1
Q: NT is measured when CRL is:
* 45–84 mm
- 20–40 mm
Explanation: ISUOG range.

Q: Which are free of ionising radiation?
+ Ultrasound
+ MRI
- CT
# Entrance
Q: Lambda sign means:
* Dichorionic
- Monochorionic
`);
    expect(errors).toEqual([]);
    expect(questions).toHaveLength(3);
    expect(questions[0]).toMatchObject({ topic: 'Module 1', explanation: 'ISUOG range.' });
    expect(questions[1]!.options.filter((o) => o.isCorrect)).toHaveLength(2);
    expect(questions[2]!.topic).toBe('Entrance');
  });

  it('reads the lettered style with an Answer line', () => {
    const { questions, errors } = parseQuestionBank(`1. Most accurate first-trimester dating?
a) BPD
b) CRL
c) FL
Answer: b

2) Choose two
(a) one
(b) two
(c) three
Ans: a, c`);
    expect(errors).toEqual([]);
    expect(questions[0]!.options.map((o) => o.isCorrect)).toEqual([false, true, false]);
    expect(questions[1]!.options.map((o) => o.isCorrect)).toEqual([true, false, true]);
  });

  it('joins multi-line question text', () => {
    const { questions } = parseQuestionBank('Q: A long question\nthat wraps\n* yes\n- no');
    expect(questions[0]!.text).toBe('A long question that wraps');
  });

  it('reports questions without a correct answer and stray lines', () => {
    const { questions, errors } = parseQuestionBank('stray text\nQ: No answer\n- a\n- b');
    expect(questions).toHaveLength(0);
    expect(errors.map((e) => e.line)).toEqual([1, 2]);
    expect(errors[1]!.message).toContain('correct answer');
  });
});

describe('shuffle / drawRandom', () => {
  const seq = (values: number[]) => () => values.shift() ?? 0;
  it('keeps every item exactly once', () => {
    const out = shuffle([1, 2, 3, 4, 5]);
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
  });
  it('is deterministic with a seeded random', () => {
    expect(shuffle(['a', 'b', 'c'], seq([0, 0]))).toEqual(['b', 'c', 'a']);
  });
  it('draws distinct items and caps at the pool size', () => {
    const drawn = drawRandom([1, 2, 3, 4, 5, 6], 4);
    expect(new Set(drawn).size).toBe(4);
    expect(drawRandom([1, 2], 10)).toHaveLength(2);
  });
});

describe('fillCertificateText', () => {
  it('fills known placeholders only', () => {
    expect(
      fillCertificateText('{learnerName} completed {courseTitle} on {issuedDate} ({serial}) {unknown}', {
        learnerName: 'Dr A',
        courseTitle: 'Fetal Medicine',
        issuedDate: '1 Jan 2027',
        serial: 'OBG-1',
      }),
    ).toBe('Dr A completed Fetal Medicine on 1 Jan 2027 (OBG-1) {unknown}');
  });
});

describe('parseCsv', () => {
  it('handles quotes, escaped quotes, commas and line breaks in cells', () => {
    expect(parseCsv('a,"b, c","say ""hi""","two\nlines"\r\n1,2,3,4\n')).toEqual([
      ['a', 'b, c', 'say "hi"', 'two\nlines'],
      ['1', '2', '3', '4'],
    ]);
  });
  it('detects semicolon and tab delimiters and strips the BOM', () => {
    expect(parseCsv('\uFEFFQuestion;Option A\nQ1;yes')).toEqual([['Question', 'Option A'], ['Q1', 'yes']]);
    expect(parseCsv('a\tb\n1\t2')).toEqual([['a', 'b'], ['1', '2']]);
  });
});

describe('sheetToQuestions', () => {
  it('reads the template', () => {
    const { questions, errors } = sheetToQuestions(parseCsv(QUESTION_CSV_TEMPLATE));
    expect(errors).toEqual([]);
    expect(questions).toHaveLength(2);
    expect(questions[0]).toMatchObject({ topic: 'Module 1', explanation: 'ISUOG first-trimester guideline.' });
    expect(questions[0]!.options.map((o) => o.isCorrect)).toEqual([true, false, false]);
    expect(questions[1]!.options.map((o) => o.isCorrect)).toEqual([true, true, false, false]);
  });

  it('accepts Excel-style rows, numbered answers and alternative headers', () => {
    const { questions, errors } = sheetToQuestions([
      ['Module', 'Question text', 'A', 'B', 'C', 'Answer'],
      ['M2', 'Dating?', 'BPD', 'CRL', 'FL', 2],
      [null, null, null, null, null, null],
      ['M2', 'Two right', 'x', 'y', 'z', 'a & c'],
    ]);
    expect(errors).toEqual([]);
    expect(questions[0]!.options.map((o) => o.isCorrect)).toEqual([false, true, false]);
    expect(questions[1]!.options.map((o) => o.isCorrect)).toEqual([true, false, true]);
  });

  it('reports rows with problems by spreadsheet row number', () => {
    const { questions, errors } = sheetToQuestions([
      ['Question', 'Option A', 'Option B', 'Correct'],
      ['Ok', 'a', 'b', 'A'],
      ['No answer', 'a', 'b', ''],
      ['One option', 'a', '', 'A'],
    ]);
    expect(questions).toHaveLength(1);
    expect(errors.map((e) => e.line)).toEqual([3, 4]);
  });

  it('explains a wrong header row', () => {
    expect(sheetToQuestions([['foo', 'bar']]).errors[0]!.message).toContain('Header row');
  });
});
