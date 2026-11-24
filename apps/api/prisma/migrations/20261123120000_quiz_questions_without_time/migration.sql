-- Quiz lessons that were converted from videos kept their in-video question times,
-- which hid those questions from learners (quizzes show questions without a time).
-- Make them ordinary quiz questions. Data repair only; no schema change.
UPDATE "QuizQuestion" q
SET "atSec" = NULL
FROM "Lesson" l
WHERE q."lessonId" = l."id"
  AND l."kind" = 'QUIZ'
  AND q."atSec" IS NOT NULL;
