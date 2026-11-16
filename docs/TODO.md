# Team to-do list

The working backlog for the GIFS e-LMS. Read `CLAUDE.md` first: the stack, the non-negotiable rules (PC-PNDT, signed media URLs, watermark, i18n, tests) and the doc-priority order. Background: `docs/LEGACY-FEATURE-GAPS.md` (old platform vs new), `docs/IMAGE-TASKS-GAP-ANALYSIS.md` (image assignments), `docs/PROGRESS.md` (state and how to run).

**How to use this list**
- Take a task by putting your name and branch next to it, e.g. `[ ] PERF-1 … — @name, feat/perf-lazy-imaging`. Tick it when merged.
- One branch per task, conventional commits, a PR with tests. Definition of done is at the bottom.
- Priorities: **P0** now · **P1** next · **P2** later · **P3** nice to have. Sizes: **S** ≤ 1 day · **M** 2–4 days · **L** 1–2 weeks.
- Items marked **DECISION** need the product owner before work starts.

---

## P0 — Performance (the app got slow after the DICOM feature)

**Measured 16 Nov 2026** (production build, `NEXT_DIST_DIR=.next-analyze pnpm --filter @obgyn/web exec next build`):

| Page | First-load JS | Typical page |
|---|---|---|
| `/learn/[slug]/[lessonId]` (every lesson, even video/PDF) | **425 kB** | ~195 kB |
| `/instructor/courses/[id]` (course editor) | **452 kB** | ~195 kB |

Lazy chunks:
- Cornerstone + vtk.js ≈ **3.5 MB** raw.
- dcmjs ≈ **690 kB**.
- Shaka Player ≈ 845 kB.
- WASM codecs 176 kB – 1 MB each (fetched only when needed).

In dev, a lesson page took **8.4 s** to compile on first load. The web dev server runs on webpack because Turbopack deadlocked on Cornerstone's worker/WASM imports.

- [ ] **PERF-1 Lazy-load imaging UI** · P0 · S
  - Load `ImagingLesson` (`components/player/lesson-view.tsx`) and `ImagingCaseDialog` (`components/instructor/editor/curriculum-tab.tsx`) with `next/dynamic({ ssr: false })` and a skeleton.
  - **Accept:** the lesson page and course editor first-load JS are back to ~200 kB. The DICOM case still works (the e2e flow below passes).
  - **16 Nov 2026:** done in code. First-load JS: course editor 452 → 242 kB, lesson page 425 → ~206 kB. The instructor case dialog was smoke-tested (it opens and renders the viewer). Still to do before ticking: run the full DICOM e2e flow.
  - Also added `instructor/loading.tsx` and a pending spinner on sidebar links. Before this, a click during a cold dev compile showed no feedback, and editor tab clicks made before hydration were dropped.
  - Not yet: `loading.tsx` for the learner area (`/learn`, `/account`) — same cold-compile symptom there.
- [ ] **PERF-2 Keep dcmjs out of the viewer and workspace** · P0 · M
  - Split `@obgyn/dicom` into entry points: `@obgyn/dicom/geometry` (pure maths, no dcmjs) and `@obgyn/dicom/sr` (dcmjs).
  - The viewer and workspace import only geometry. Load `buildMeasurementReport` with `await import()` at submit time; consider a Web Worker.
  - **Accept:** no `dcmjs` in any chunk loaded before the learner presses Submit, verified with the bundle analyser.
- [ ] **PERF-3 Shrink or defer Cornerstone** · P1 · M
  - Start loading Cornerstone when a DICOM lesson is opened or hovered in the curriculum (`loadCornerstone()` prefetch), not on first paint.
  - Restrict the image loader to the codecs we need (JPEG baseline, RLE, uncompressed) if the loader allows it.
  - Evaluate whether vtk.js can be avoided for 2D stack viewing.
  - **Accept:** documented size before/after; viewer ready in < 2 s on a 10 Mbps connection.
- [ ] **PERF-4 Bring Turbopack back for dev** · P1 · M
  - Options:
    - wrap Cornerstone in a pre-built ESM bundle (e.g. a `packages/viewer` built with tsup) that Turbopack can consume;
    - serve codecs from `public/` with `setWasmBasePath`;
    - or upgrade when Next/Turbopack supports `new Worker(new URL(…))` for these packages.
  - **Accept:** `next dev --turbopack` loads the DICOM lesson without hanging; dev first compile < 3 s.
  - **Seen 16 Nov:** the webpack dev server restarts itself with "approaching the used memory threshold" after many routes are compiled; another reason to move off webpack in dev.
- [ ] **PERF-5 Bundle analysis in CI** · P1 · S
  - Add `@next/bundle-analyzer` behind `ANALYZE=1`.
  - Add a CI step that fails if any route's first-load JS grows > 10% over the committed baseline (`docs/perf-baseline.json`).
- [ ] **PERF-6 Big curriculum lists** · P1 · S
  - The course editor renders 140+ lessons with buttons; the learner sidebar renders all lessons.
  - Virtualise (e.g. `@tanstack/react-virtual`) or collapse chapters by default.
  - **Accept:** editor interaction stays smooth (no long tasks > 100 ms in the Performance panel) with 300 lessons.
- [ ] **PERF-7 API hot paths** · P1 · M
  - DRM segment requests (`MediaService.packageFile`) do 2 DB reads per segment. Cache session validity and package lookups (in-memory LRU, 30 s, or Redis).
  - Add DB indexes found via `EXPLAIN` on outline/lesson queries.
  - **Accept:** p95 segment response < 30 ms locally under 50 concurrent players (k6 script in `tools/`).
- [ ] **PERF-8 Caching headers** · P2 · S
  - Long-term immutable caching for `/_next/static` and WASM.
  - Make sure the signed media gateway stays `no-store`.

---

## P0 — Imaging (finish the core of the image-assignment plan)

Plan: `docs/IMAGE-TASKS-GAP-ANALYSIS.md`. Done: dictionary, pin/box/outline/caliper/ellipse, IoU/radius/value scoring, partial credit, multi-select, teaching points, PNG/JPG + scale.

- [ ] **IMG-1 Answer-key import (JSON)** · P0 · M
  - In the case editor, upload an image plus a key JSON and pre-draw the answers.
  - Support the format of the synthetic dataset (`keys/*.json`: `structures` → POLYGON, `landmarks` → POINT with `tolerance_px`, `measurements` → LENGTH/ELLIPSE, `targets` (circle) → POINT radius, `mm_per_px` → scale).
  - Generic: no dataset-specific code paths.
  - **Accept:** importing `M2A2_01_head.json` reproduces BPD 61.6 mm and HC 227.1 mm.
- [ ] **IMG-2 Plane-picker grid (T4)** · P0 · M
  - Findings whose options link to images render as a thumbnail grid; click to select.
  - Thumbnails are generated server-side from the DICOM, served through signed URLs, and watermarked.
  - **Accept:** M1-A1 "Build the anomaly scan" (20 images, ≤ 2 wrong) can be authored and passed.
- [ ] **IMG-3 Attempts limit + best score** · P0 · S
  - Per-lesson `maxAttempts` (default 3 per the plan).
  - Show "attempt n of N"; the best score drives completion.
  - The API rejects attempts past the limit (`ATTEMPTS_EXHAUSTED`).
- [ ] **IMG-4 Task pools (random variant)** · P1 · L
  - A lesson has 3–5 case variants; each attempt draws one (no repeat until exhausted).
  - Learners can't see other variants' answers.
- [ ] **IMG-5 Own-scan submission (T7) + faculty checklist** · P1 · L
  - Learner uploads their own scan(s) (DICOM or PNG/JPG; de-identification attestation + server scrubbing) and labels the landmarks with the dictionary.
  - Learner writes a short structured report.
  - Faculty review queue with the 6-item checklist from the plan:
    - plane
    - landmarks
    - optimisation
    - calipers
    - de-identification
    - report
  - Faculty can draw corrections, return the scan for resubmission, or mark it as an exemplar.
  - **Accept:** the checklist % becomes the score; resubmission keeps history.
- [ ] **IMG-6 Cine frame ranges (T8)** · P1 · M
  - The key accepts a frame range for each annotation; frame scrubbing is shown in the task.
  - Convert MP4 sweeps to multi-frame DICOM on upload (ffmpeg is already available server-side).
- [ ] **IMG-7 Teaching-point link to class** · P1 · S — Optional `linkLessonId` per key item, rendered as "See class 19".
- [ ] **IMG-8 Deadlines + hidden answers** · P2 · M — The reference overlay is hidden until the lesson deadline passes.
- [ ] **IMG-9 Exam mode (M10 OSCE)** · P2 · L
  - Timer, auto-submit, full-screen, randomised order.
  - No reference shown until results are released.
- [ ] **IMG-10 Module score gate** · P2 · M
  - Module score = MCQ 40% + image tasks 35% + own-scan 25%.
  - A learner passes the module at ≥ 50% with all T7 submitted (configurable per course).
- [ ] **IMG-11 Key review workflow** · P2 · M — Key status draft → reviewed (second faculty) → live.
- [ ] **IMG-12 Image library + tags** · P2 · L
  - Tags: module, class, trimester, system, plane, normal/abnormal, difficulty.
  - Build pools by filter.
- [ ] **IMG-13 Burned-in text redaction** · P1 · L
  - OCR (Tesseract in `services/ai`), then an editor to black out regions, plus a human confirmation.
  - Also used to remove areas that reveal fetal sex (PC-PNDT).
  - **Accept:** the upload is blocked until the faculty confirms.
- [ ] **IMG-14 Arrow + text annotations** · P3 · S — Ungraded teaching aids in the viewer.
- [ ] **IMG-15 TID 5000 import** · P3 · M — Import OB-GYN SR reports from ultrasound machines as answer keys.
- [ ] **IMG-16 Move test content out of the live course** · P0 · S
  - The chapter "DICOM practice (test)" (2 lessons) and the 19-term dictionary are in the seeded course.
  - Move them to a demo course, or delete them before the first cohort.

---

## P1 — Admin essentials

- [ ] **ADM-1 Users management** · M
  - List, search, filter by role; view a user's enrolments and devices.
  - Block/unblock (revokes sessions); change role; soft-delete.
  - Every change is audit-logged.
- [ ] **ADM-2 Categories CRUD + sub-categories + ordering** · M
  - Today categories are seeded and read-only. Add `parentId`; enable the catalogue routes `courses/[main]/[sub]`.
- [ ] **ADM-3 Admin dashboard** · M
  - Counts: learners, instructors, courses by status, enrolments, completions, revenue (after COM-*).
  - 30-day charts; pending queues (applications, course reviews, refunds).
- [ ] **ADM-4 CSV exports** · S — Courses, enrolments, instructors, imaging/quiz results (streamed; exports audit-logged).
- [ ] **ADM-5 Instructor application custom fields** · S — The admin defines extra fields shown on Become instructor.
- [ ] **ADM-6 Audit log viewer** · S — Filter by actor, action and resource; export.
- [ ] **ADM-7 DRM packaging status** · S — Per video: queued/packaging/ready/failed, error text, retry button (`DrmPackagerService.enqueue(force)`).

## P1 — Notifications

- [ ] **NOT-1 Notification service** · M
  - Table + API: list, unread count, mark read, mark all read.
  - Bell in the header; preferences per type.
- [ ] **NOT-2 Email** · M
  - Provider adapter (SES ap-south-1 or SMTP) with templates (en/hi).
  - Events: enrolment, assignment graded, imaging result, certificate issued, course approved/rejected, new Q&A reply.
  - **DECISION:** email provider (paid service, rule 10).
- [ ] **NOT-3 Push** · P2 · M — Expo push for mobile.

## P1 — Instructor insight

**Also fixed on 2026-11-16 (security):** any faculty account could previously act as manager of every course: drafts, media, other courses' learners' files, and the entrance bypass. Course rights now come from one place, `CoursePermissions` (owner, accepted co-instructor or admin).

PC-PNDT text screening now also blocks disclosures ("baby is a boy", "male fetus", Hindi equivalents).

Still open from the old instructor area:
- coupons, earnings, refunds and withdrawals (COM-*);
- live classes (LIV-1);
- notifications (NOT-*);
- admin hide/unhide of reported reviews (ADM).

- [x] **INS-1 Enrolled students** · S (done 2026-11-16: Students tab, search/sort/paging, masked emails, CSV; course team excluded) — Per course: student, enrolled date, progress %, last activity, certificate.
- [x] **INS-2 Quiz & imaging reports** · M (done: Reports tab for quizzes, DICOM cases and entrance test; item analysis; attempt detail)
  - Per-student attempts with answers.
  - Item analysis: % correct per question/annotation, most common wrong option.
- [x] **INS-3 Course analytics** · M (done: funnel, 30-day enrolments chart, completion per lesson; dashboard activity + chart) — Funnel: enrolled → started → per-lesson completion → certificate; video watch-through.
- [x] **INS-4 Curriculum trash / restore** · S (done: soft delete, Trash tab, restore, permanent delete, 30-day purge) — Soft-delete chapters and lessons; restore within 30 days.
- [x] **INS-5 Reviews management** · S (done: /instructor/reviews, public replies, report to admin; admin hide UI is ADM work) — Instructor replies to reviews; reports abusive reviews to admin.
- [x] **INS-6 Co-instructors (team members)** · M (done: Team tab, editor/grader roles, invitations on dashboard) — Invite by email, roles (editor, grader); grading access to submissions.
- [x] **INS-7 Question topics + bank redesign** · M (done 2026-11-16) — `QuestionTopic` records (create, rename, describe, reorder, delete); topic side panel; add single question; bulk move / delete; import picks a default topic; quiz and in-video questions take a topic. Migration carried the old free-text topics over.
- [x] **INS-8 Student progress report** · M (done 2026-11-16) — Students tab shows the current lesson and links to a per-student report: where they are, views, video watch time, in-video tries, quiz/DICOM attempt history, strengths per topic. Learners see the same report from My learning.
- [x] **INS-9 DICOM calculators + learners' working** · M (done 2026-11-16) — Calculator links per lesson (open beside the case, sandboxed), "Calculate with" on report fields, working (explanation + photos/PDFs) Off/Optional/Required, faculty verify/return with feedback in Reports.
- [ ] **INS-10 Tag existing in-video questions with topics** · P1 · S — Content task: the seeded videos' in-video questions have no topic, so reports show them under "Questions without a topic". Set topics in each video's question editor (or a one-off script outside the repo).
- [ ] **INS-11 Calculator links on every lesson type** · P1 · S — Resources are stored on `Lesson` and shown for any kind, but only the DICOM case editor can edit them. Add `ResourceLinksEditor` to the lesson dialog in `curriculum-tab.tsx` (validate with `ResourceLinksSchema` in the lesson DTO).
- [ ] **INS-12 Working review queue** · P1 · S — Pending DICOM working appears only per case in Reports. Add it to `/instructor/submissions` (Assignments) with a count on the dashboard; notify the learner on verify/return (NOT-*).
- [ ] **INS-13 Weak-topic recommendations** · P2 · M — In the report, list lessons whose questions carry each "Needs work" topic ("Revise: class 7, Module 2 MCQ").
- [ ] **INS-14 Report export** · P2 · S — Print-friendly / PDF progress report for sharing with the learner; course-wide topic heatmap (students × topics).
- [ ] **INS-15 Per-course mastery thresholds** · P2 · S — `MASTERY` (80 / 60 / min 3 answers) is global; make it a course setting if faculty ask.
- [ ] **INS-16 Imaging working in the progress report** · P2 · S — Show each DICOM attempt's working status in the lesson-by-lesson report.
- [ ] **CALC-1 Built-in calculators** · P2 · L · **DECISION** — Our own EFW / centile / GA calculators as versioned, faculty-reviewed content records (CLAUDE.md rule 5), so results can be checked automatically against the learner's inputs. Needs the formulas and reference tables chosen and signed off by faculty.

## P1 — Commerce (Phase 3)

**DECISION** before starting:
- payment gateway(s): Razorpay only, or also others? (paid, rule 10)
- GST registration and invoice format
- platform commission %
- payout schedule
- refund policy

- [ ] **COM-1 Checkout** · L
  - Cart (or direct "Buy"), Razorpay Orders API, payment-status page.
  - Webhook verification (signature), idempotent enrolment on capture.
- [ ] **COM-2 Orders, invoices, transaction history** · M — GST invoice PDF (server-rendered), learner history page, admin orders list.
- [ ] **COM-3 Promo codes** · M
  - Admin- and instructor-scoped codes: percent/flat, limits, expiry, course scope.
  - Apply/remove at checkout.
- [ ] **COM-4 Refunds** · M — Learner request → instructor/admin decision → Razorpay refund API; refund settings (window, %).
- [ ] **COM-5 Paid certificate** · S — Use the existing `certificateFeePaise`: pay, then the certificate is issued.
- [ ] **COM-6 Earnings, commission, withdrawals** · L — Ledger per instructor, commission rules, withdrawal requests + admin approval, payout export.
- [ ] **COM-7 Wallet / store credit** · P3 · M — Only if needed (refunds to wallet).

## P2 — Community & live (Phase 4)

- [ ] **LIV-1 Live classes** · L
  - Schedule (instructor), list/detail (learner).
  - Zoom Meeting SDK inside our apps with capture blocking (`docs/04-LIVE-CLASSES.md`); attendance; recordings through DRM.
  - **DECISION:** Zoom account/SDK licence.
- [ ] **COMM-1 Course Q&A / discussion** · L — Threads per course or lesson, replies, instructor badge, mark answered, report abuse.
- [ ] **COMM-2 Moderation** · M — Report reasons, admin queue, hide/restore, ban.
- [ ] **COMM-3 Help-desk / support groups** · M — Groups with join requests and approval, or tickets.
- [ ] **COMM-4 Image discussion threads** · M — Comments pinned to a point or region on a case image (plan feature 14).

## P2 — Content pages & settings

- [ ] **CMS-1 Pages** · M — Policy pages, About, Contact (form → email/ticket), FAQs; Markdown with preview; en/hi.
- [ ] **CMS-2 Home sections** · M — Sliders/banners, feature sections, "why choose us"; ordering.
- [ ] **CMS-3 SEO settings** · S — Default meta, OG image, sitemap/robots.
- [ ] **CMS-4 Mail & app settings** · S — Non-secret settings in the DB; secrets stay in env/secret manager.
- [ ] **CMS-5 Language editor** · M — Admin editor for `messages/*.json` (or DB overrides); missing-key report; add regional languages.

## P2 — Accounts & teams

- [ ] **ACC-1 Delete account (DPDP)** · M
  - Learner-initiated: confirm via OTP, then anonymise personal data.
  - Keep financial and audit records as required; export my data.
- [ ] **ACC-2 Teams / institutional seats** · L
  - Organisation, seat purchase, invite learners, admin view of progress.
  - **DECISION:** in scope?
- [ ] **ACC-3 Exam certificates** · S — A certificate tied to a final exam result (separate template/serial).
- [ ] **ACC-4 Production login policy** · S
  - **DECISION:** OTP only, or also email + password?
  - Today email + password is dev-only (`/auth/dev-login`, 404 in production).

## P1 — Platform & quality

- [ ] **QA-1 E2E suite in the repo** · M
  - Move the Playwright flows used so far (login via dev-login, DRM playback, DICOM case authoring and learner pass/fail, entrance test) into `apps/web/e2e/`.
  - Generate fixtures at test time; no patient images.
- [ ] **QA-2 CI** · M — GitHub Actions: install, typecheck, lint, unit tests, Prisma migrate on a Postgres service, e2e on PRs.
- [ ] **QA-3 Pre-commit** · S — lint-staged + Prettier.
- [ ] **OPS-1 Deployment** · L
  - Containers for web/api, AWS ap-south-1 (data in India).
  - S3/MinIO, managed Postgres, secrets manager, migrations on deploy, backups.
- [ ] **OPS-2 Observability** · M — Structured logs, error tracking, uptime, slow-query log.
- [ ] **DRM-1 Commercial DRM provider** · L
  - **DECISION:** DoveRunner/PallyCon, EZDRM, or other (paid).
  - Implement the `DrmProvider` adapter: licence URLs, per-session licence token, `registerKey`.
  - Decide the Chrome-desktop policy (`DRM_REQUIRE_HARDWARE`).
- [ ] **DRM-2 Grant-refresh test over 5 minutes** · S — Finish the long-playback check noted in `PROGRESS.md`.
- [ ] **DOC-1 Decisions log** · S
  - Record in `docs/02-ARCHITECTURE.md`:
    - Cornerstone embedded (not OHIF);
    - our own annotation layer;
    - TID 1500 SR;
    - grading recomputed from drawings;
    - webpack dev;
    - dev-login;
    - PNG/JPG to Secondary Capture.
- [ ] **DOC-2 Missing docs** · M — `docs/01-PRD.md` and `03`–`10` are referenced by `CLAUDE.md` but don't exist yet.

---

## Definition of done (every task)

- Typecheck, lint and unit tests pass: `pnpm turbo run typecheck lint test`.
- API inputs validated (zod / class-validator); OpenAPI annotations on new endpoints.
- New UI text in **en and hi** (`apps/web/messages`, parity test passes); keyboard-accessible (WCAG 2.1 AA).
- Media only through signed URLs; protected views keep the watermark/shield; no fetal-sex content (PC-PNDT screening on any new free text).
- Audit-log for admin/financial actions; migrations included; `.env.example` updated for new variables.
- PR description says which doc section it implements; screenshots for UI changes.
