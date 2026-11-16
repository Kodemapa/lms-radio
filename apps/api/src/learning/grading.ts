export interface GradableQuestion {
  id: string;
  explanation: string | null;
  options: { id: string; isCorrect: boolean }[];
}

/** Default pass mark when an instructor doesn't set one. */
export const DEFAULT_PASS_PERCENT = 60;

/**
 * A question is correct only if the learner picked exactly the correct
 * options. Unknown option ids are ignored.
 */
export function gradeQuiz(
  questions: GradableQuestion[],
  answers: Record<string, string[]>,
  passPercent: number,
) {
  const results = questions.map((question) => {
    const valid = new Set(question.options.map((o) => o.id));
    const selected = [...new Set(answers[question.id] ?? [])].filter((id) => valid.has(id));
    const correctIds = question.options.filter((o) => o.isCorrect).map((o) => o.id);
    const correct =
      selected.length === correctIds.length && correctIds.every((id) => selected.includes(id));
    return {
      questionId: question.id,
      correct,
      selectedOptionIds: selected,
      correctOptionIds: correctIds,
      explanation: question.explanation,
    };
  });
  const right = results.filter((r) => r.correct).length;
  const scorePercent = questions.length ? Math.round((right / questions.length) * 100) : 0;
  return { scorePercent, passed: scorePercent >= passPercent, questions: results };
}

const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // no 0/O/1/I

/** e.g. OBG-2026-7K3QX9 */
export function certificateSerial(random: (n: number) => number, year = new Date().getFullYear()): string {
  let code = '';
  for (let i = 0; i < 6; i++) code += ALPHABET[random(ALPHABET.length)];
  return `OBG-${year}-${code}`;
}
