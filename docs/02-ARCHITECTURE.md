# 02 · Architecture

> The other `docs/` files that CLAUDE.md lists (PRD, content protection, data model, …)
> don't exist yet. This file records what has actually been built.

## Services

```
 Browser ──► apps/web (Next.js) ──BFF──► apps/api (NestJS) ──► PostgreSQL
   │            │  httpOnly cookies         │  Prisma            Redis (planned: cache, BullMQ)
   │            │                           ├─► S3 ap-south-1 / MinIO (media)
   │            │                           └─► services/ai (FastAPI, planned)
 Desktop (Electron) and Mobile (Expo) ──────┘
```

## Authentication

1. `POST /auth/otp/request` sends a 6-digit OTP (HMAC-hashed at rest, 5-minute TTL,
   5 attempts, 5 requests per 10 min per target).
2. `POST /auth/otp/verify` finds or creates the user, **binds the device** (at most
   `MAX_DEVICES_PER_USER`, default 2), creates a `Session` and returns:
   - an access JWT (15 min) with `sub`, `sid`, `role`
   - a refresh token `<sessionId>.<secret>`; only a SHA-256 of the secret is stored
3. `POST /auth/refresh` rotates the refresh token. It only works with the device id it
   was issued to. Replaying the previous token after a 10-second grace window revokes
   the session (theft detection).
4. `JwtAuthGuard` checks the JWT **and** that the session is live and the account is
   neither blocked nor deleted, so logout, device removal, blocking, and deletion take
   effect immediately.

On the web, tokens never reach page JavaScript: the BFF sets them as httpOnly,
`SameSite=Strict` cookies, and middleware refreshes them for protected pages.

## Protected media (CLAUDE.md rule 2)

```
player ─► GET /media/:id/url (JWT) ─► { url: /media/stream?a&s&e&sig, watermark }
player ─► GET /media/stream?… ─► check HMAC, expiry ≤ 300 s, session live
                                ─► 302 to a 60-second S3 presigned URL
```

The grant names the asset and session and is HMAC-signed, so it can't be moved to
another asset or used after logout. The player fetches a new URL when one expires.

## Course authoring (Phase 1)

```
Instructor ─► POST /instructor/courses ─► DRAFT
           ─► details · chapters · lessons · pricing (PATCH/POST /instructor/...)
           ─► POST /instructor/uploads ─► signed PUT URL ─► browser uploads file
                                       ─► POST /instructor/uploads/:id/complete
           ─► POST /instructor/courses/:id/submit ─► IN_REVIEW
Admin      ─► POST /admin/courses/:id/publish ─► PUBLISHED (or /reject ─► DRAFT + note)
```

Submission is blocked until the shared checklist in `@obgyn/types` (`submissionProblems`)
passes: title, short description, category, thumbnail, at least one learning outcome, at
least one lesson, every video/PDF uploaded and de-identified, valid pricing, and **no text
about determining fetal sex** (PC-PNDT). The web editor runs the same checklist.

Learners become instructors by applying (`POST /instructor-applications`); an admin
approves the application, which sets their role to `FACULTY`.

## Admin section (ADM-1–ADM-7, CMS-1/3/4/5)

The web admin area has its own layout and admin-only route check under `/admin`. Course
review and instructor-application pages live there; their previous instructor URLs redirect
to the admin routes. The instructor sidebar links to the admin area.

User management provides URL-backed search, filters, sorting and pagination; the list masks
email and phone numbers. Admins can inspect a user's profile, enrolments, devices and recent
activity, and block/unblock, change roles, or soft-delete with a required reason. Mutations
are audit-logged and revoke sessions where needed. Admin self-management and removing the
last active admin are prevented.

The admin tools also provide:

- category CRUD, two-level parent/sub-category relationships and keyboard-accessible ordering;
- dashboard totals, 30-day enrolment/sign-up charts and links to pending application, course,
  review-moderation and DRM queues (commerce totals are not available before checkout exists);
- streamed CSV exports for courses, enrolments, instructors, quiz attempts and imaging attempts,
  with contact details masked by default and each export audit-logged;
- audit filtering, keyset paging and CSV export;
- reported/hidden review moderation and video DRM status/retry/re-package actions;
- admin-defined instructor application fields, client/server answer validation, PC-PNDT screening
  and reviewer display of saved answers;
- CMS page and FAQ editors, published public pages/FAQ, English fallback, legal footer links,
  and non-secret SEO/contact settings used by page metadata and the footer.

The migrations for user management and admin content/fields are in
`apps/api/prisma/migrations/`; the local database was verified up to date on 16 Nov 2026.
- a public contact form (`/contact` → BFF `/api/contact` → `POST /content/contact`, consent
  required, honeypot, 5/min per IP) feeding the admin inbox at `/admin/messages`;
- SEO: Open Graph/Twitter image and a search-indexing switch in Site settings, `app/robots.ts`
  and `app/sitemap.ts` (base URL from `NEXT_PUBLIC_WEB_URL`);
- a language editor at `/admin/languages`: `MessageOverride` rows are fetched by
  `i18n/request.ts` (60 s cache) and merged over `messages/*.json` with
  `applyMessageOverrides`, which drops unknown keys and edits that change ICU arguments.

If the API is unreachable, public settings and text overrides fall back to defaults, so
the site keeps rendering. Home-page CMS sections (content schema not agreed), mail/push
settings and auto-translate (providers not chosen, rule 10) remain unimplemented.

## Learning area (Phase 2)

- **Player** (`/learn/:slug/:lessonId`): outline with per-lesson progress, resume point and
  sequential locks (`GET /learn/courses/:slug`); lesson detail with prev/next
  (`GET /learn/lessons/:id`). Videos save their position about every 15 s and complete
  automatically at 90% watched; PDFs, simulators and live classes are marked complete by hand.
- **Quizzes** are marked on the server. Correct answers are never sent before an attempt; a
  question counts only if exactly the correct options are picked. Passing completes the lesson.
- **Assignments**: one live submission per learner (resubmitting replaces it). Submitting
  completes the lesson; if the instructor requests changes, the lesson is reopened.
- **Certificates** are issued once every lesson is complete (skipped lessons count). The
  public page `/certificates/:serial` is both the printable certificate and its verification link.
- **Learner uploads** (`POST /uploads`) are images/PDFs up to 20 MB, always private and
  always need the de-identification confirmation. Only instructor-uploaded images are public.

## Progress reports

`ReportsService` (`apps/api/src/reports/`) builds one learner's report for one course; the
learner (`GET /learn/courses/:slug/report`, page `/account/learning/:slug`) and the course team
(`GET /instructor/courses/:id/students/:userId/report`, linked from the Students tab) see the
same numbers:

- **Where they are:** last lesson visited, next unfinished lesson, lessons done.
- **Per lesson:** status, times opened (`LessonProgress.views`), video watch time
  (`watchedSec`, forward playback capped by real time) and furthest point (`furthestSec`),
  in-video question tries (`CheckpointAnswer.attempts`), quiz / DICOM attempt history,
  assignment status.
- **Per topic:** `topicMastery()` in `@obgyn/types` groups each quiz's latest attempt, in-video
  questions (right first try) and the latest entrance test by topic; thresholds in `MASTERY`.

## Calculators and learners' working (DICOM cases)

- **Lesson resources** (`Lesson.resources`, `ResourceLinkSchema`): https links such as online
  calculators. The player lists them and opens one in a sandboxed iframe panel beside the lesson
  (`components/player/resources.tsx`), with a new-tab fallback. A DICOM report field can name
  its calculator (`ReportFieldKey.resourceId`) to show a "Calculate with …" button.
- **Working** (`ImagingAttempt.explanation`, `workingAssetIds`): per case Off / Optional /
  Required (`CaseKey.working`). Files are the learner's own IMAGE/PDF uploads, readable by the
  learner and course staff through signed URLs (`AccessService.assertAssetAccess`). Graders
  verify or return it (`PUT /instructor/imaging-attempts/:id/working`) from the Reports tab.

## In-video questions

Video lessons can have questions pinned to a time (`QuizQuestion.atSec`). The player pauses
at the first unanswered one and won't seek past it; only an exactly-correct answer unlocks
the next part. The server enforces the same rule (`unlockedUntilSec` in `@obgyn/types`): saved
positions are clamped to the lock point and the lesson can't be completed until every
question is passed. Wrong answers never reveal the solution. Instructors add them from
**Curriculum → In-video questions** on any video lesson.

## Question bank, entrance test, certificate design

- **Question topics** (`QuestionTopic`, per course, ordered): bank questions, quiz questions and
  in-video questions each point to one (`topicId`). Topics are created, renamed, reordered and
  deleted in the bank's side panel (`/instructor/courses/:id/topics`); deleting one keeps its
  questions under "No topic". Imports create missing topics by name. Topics drive the
  strengths / weaknesses in progress reports.
- **Question bank** (`BankQuestion`, per course): instructors import many questions at once
  (`parseQuestionBank` in `@obgyn/types` accepts `*`/`-` markers or `a) b) … Answer: b`, with
  `# Topic` headers; or a CSV / Excel file), add single questions, and move or delete selected
  questions in bulk (`POST …/bank/bulk`). Then they pick them into quizzes or in-video questions. Picking **copies** the
  question (`QuizQuestion.bankQuestionId` remembers the source), so editing the bank never
  silently changes a live quiz.
- **Entrance test**: when enabled, each attempt draws `entranceQuestionCount` random bank
  questions (optionally from one topic) and shuffles their options. The drawn paper is stored
  on `EntranceAttempt`, so marking uses exactly what the learner saw, and an unfinished attempt
  resumes instead of re-drawing. Passing enrols the learner (free courses); enrolment and
  auto-enrolment are refused until then. Staff skip it.
- **Certificate design** (`CertificateTemplate`): heading, wording with `{learnerName}`,
  `{courseTitle}`, `{issuedDate}`, `{serial}`, issuer, logo, up to 3 signatories, accent colour.
  The same `CertificateView` component renders the instructor's live preview and the public
  certificate.

## Decisions log

| Date | Decision | Why |
|---|---|---|
| 2026-11-15 | Pinned stable majors: Next 15.5, NestJS 11, Prisma 6, TypeScript 5.9, Zod 3, Expo SDK 54, Electron 38 | Newer majors (TS 7, Prisma 7/8, Nest 12, Zod 4) are too recent to trust their tooling together; upgrade one at a time |
| 2026-11-15 | Web uses a BFF with httpOnly cookies, not tokens in browser storage | XSS can't steal tokens |
| 2026-11-15 | Media served through an API gateway that redirects to 60-second storage URLs | Lets URLs be bound to a session (S3 presigning can't do that alone) |
| 2026-11-15 | Progressive MP4 for now; Shaka Player + multi-DRM later | DRM licence provider not chosen (paid service, rule 10) |
| 2026-11-15 | OTP delivery logs to the console in development; production refuses to send | The SMS/email provider is a paid service, so it needs sign-off (rule 10) |
| 2026-11-15 | Enrolment is free for now (`POST /courses/:slug/enroll`) | Payments not specified yet |
| 2026-11-15 | Legacy Laravel/Next.js folders are git-ignored and untouched | They contain production secrets; used as reference only |
| 2026-11-15 | Bundle ids and app ids are placeholders (`com.example.obgynelms`) | Real ids depend on the publishing organisation |
| 2026-11-15 | Web UI ported from the previous lmsweb site (palette, header/footer, course cards, course page, instructor dashboard) and rebuilt on NestJS | User chose "port UI, rebuild on NestJS" over reusing Laravel |
| 2026-11-15 | Phased delivery: 1) look + public pages + course creation, 2) student learning area, 3) cart & payments, 4) live classes & help desk | Each phase is usable on its own |
| 2026-11-15 | YouTube lessons from the old course builder are **not** supported | YouTube can't do signed URLs or watermarking (CLAUDE.md rules 2–3) |
| 2026-11-15 | Instructors can edit PUBLISHED courses directly (audited); IN_REVIEW is locked until withdrawn | Matches the old site; a review step for edits to live clinical content should be added once docs/09-COMPLIANCE.md defines it |
| 2026-11-15 | Uploading a video or PDF requires the uploader to confirm it is de-identified | CLAUDE.md rule 6; server-side DICOM/metadata scrubbing still to come |
| 2026-11-15 | `STORAGE_DRIVER=local` stores uploads on disk in development; production must use `s3` (enforced at startup) | Development works without MinIO/Docker |
| 2026-11-15 | Quizzes and assignments in the curriculum moved to Phase 2 | They need learner attempts and grading, which belong with the learning area |
| 2026-11-15 | Paid courses return 402 on enrol until checkout exists | Phase 3 (cart & payments) |
| 2026-11-15 | Rich-text course descriptions are plain text for now | Avoids pulling in an editor before the content model is agreed |
| 2026-11-15 | Preview visitors can open the player; non-preview lessons show as locked | Lets free previews work in the same player without enrolling |
| 2026-11-15 | Quiz pass mark defaults to 60% when the instructor leaves it empty | Matches the old builder's default |
| 2026-11-15 | An assignment counts as complete on submission, and reopens if changes are requested | Learners aren't blocked waiting for review; rejections still have to be redone |
| 2026-11-15 | Certificates are printable web pages (browser "Save as PDF"), not server-generated PDFs | No PDF dependency; the page doubles as public verification |
| 2026-11-15 | Courses with a certificate fee return 402 when claiming, until checkout exists | Phase 3 (payments) |
| 2026-11-15 | Account deletion erases personal fields, reviews and wishlist, and revokes all sessions/devices; progress stays, anonymised | DPDP Act right to erasure while keeping course statistics correct. Instructors with live courses are blocked until courses are handed over |
| 2026-11-15 | PDFs are shown in the browser's viewer under the watermark for now | TODO: render with pdf.js to canvas so the browser's download button is never exposed |
| 2026-11-15 | Course discussion (Q&A) moves to Phase 4 with the help desk | Same moderation and reporting needs |
| 2026-11-15 | `DEV_FIXED_OTP` gives a fixed sign-in code in development; the API refuses to start with it in production | Easier manual testing |
| 2026-11-15 | Demo catalogue replaced by the Certificate Course in Fetal Medicine (GIFS brochure): 10 modules, 120 classes, an MCQ test and a scan-image submission per module | Requested by the user |
| 2026-11-15 | Test videos are openly licensed Wikimedia Commons clips (DW "The Placenta", CC BY-SA 4.0; CDC "Prenatal Radiation Exposure", public domain) played through our protected player, not YouTube embeds | YouTube can't do signed URLs or watermarking, and the "can't skip past an unanswered question" lock only holds on a player we control. Download with `apps/api/prisma/fetch-sample-media.sh` |
| 2026-11-15 | In-video question locks are enforced on the client (no seeking) and the server (position clamp, completion refused); bytes past the lock aren't withheld | Progressive video can't be cut by time. HLS segment gating can come with the DRM work |
| 2026-11-15 | The fetal medicine course is free for now | So it can be tested end to end before checkout (Phase 3) |
| 2026-11-15 | Bank questions are copied into quizzes, not linked | A published quiz must not change because someone edited the bank |
| 2026-11-15 | Entrance and bank payloads are validated with the shared zod schemas on the API (not class-validator) | Nested arrays of options; one schema for the import preview and the server |
| 2026-11-15 | The fetal medicine course has an entrance test (5 random questions from a 15-question pool, 60% to pass, 3 attempts) | Brochure: "Selection by online MCQ-based entrance exam" |
| 2026-11-16 | Question topics are records (`QuestionTopic`), not free text. Bank questions, quiz questions and in-video questions each point to one; questions copied from the bank keep its topic. Deleting a topic keeps its questions, which become "No topic". Imports create missing topics by name | Free text couldn't be renamed or reordered safely, and quiz questions had no topic, so reports couldn't group answers by topic |
| 2026-11-16 | Topic strength: ≥ 80% Strong, 60–79% Developing, < 60% Needs work, fewer than 3 answers "Not enough data" (`MASTERY` in `packages/types/src/progress.ts`) | Teaching thresholds, not clinical content. Could become a per-course setting later |
| 2026-11-16 | Answers counted per topic: each quiz's latest attempt, in-video questions right on the first try, and the latest entrance test | The latest attempt shows current knowledge. In-video questions can be retried until right, so only the first try shows what the learner knew |
| 2026-11-16 | Video watch time (`LessonProgress.watchedSec`) only adds forward playback, capped at the real time between progress reports plus 5 s; `views` counts lesson opens | Skipping ahead must not count as watching. Uses existing progress reports, so no extra requests |
| 2026-11-16 | Learners and the course team see the same progress report (`/learn/courses/:slug/report`, `/instructor/courses/:id/students/:userId/report`) | One source of truth; what the instructor discusses with the student is exactly what the student sees |
| 2026-11-16 | Lessons have resource links (`Lesson.resources`, https only), e.g. FMF / perinatology.com calculators. Each opens in a sandboxed iframe panel beside the lesson (no referrer, no access to our page), with a "New tab" fallback; a DICOM report field can name the calculator to use | Learners calculate without leaving the case. We don't copy third-party calculators: their formulas are clinical content we'd have to version and review (CLAUDE.md rule 5). Building our own reviewed calculators is a later option |
| 2026-11-16 | DICOM attempts can carry the learner's working (explanation + up to 6 photos/PDFs of their own uploads), per-case Off / Optional / Required. Course graders mark it Verified or Returned (feedback required); this doesn't change the auto score | The score checks the final value within the tolerance ("buffer"); the working check confirms the method. Files are served only through signed URLs to the learner and course staff |
| 2026-11-16 | `DEV_UNLOCK_LESSONS=true` turns off sequential lesson locks (`AccessService.lockedLessonIds` returns none). Off by default, set in local `.env`; refused at start-up in production and ignored there anyway. In-video question gates stay on | Lets the team review later lessons without finishing earlier ones. An explicit switch, not `NODE_ENV`, so the unit/e2e tests (and anyone testing locks locally) keep the real behaviour |
