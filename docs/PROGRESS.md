# Progress & handoff

Test accounts and the dev login: see [DEV-LOGINS.md](DEV-LOGINS.md).

## Homepage redesign — 2026-11-16

- Audience clarified: fetal ultrasound courses for radiology postgraduates and residents.
- Rebuilt homepage using supplied visual references: lavender/plum/apricot palette, rounded editorial hero, layered illustrative imaging card, compact navigation and warm specialty cards.
- Replaced general ObGyn category navigation with fetal ultrasound foundations, anatomy, biometry/growth and Doppler course-search links. Existing catalogue and faculty records remain unchanged.
- Updated English/Hindi homepage and footer copy. Schematic preview is labelled; no clinical reference values or commercial simulator integration claims added.
- Verified web typecheck, 55 web tests, lint (two existing configuration warnings), diff whitespace and homepage HTTP 200. Browser visual QA remains outstanding because the browser execution tool was unavailable.

### Design system rolled out app-wide (same day)

- **Decisions log — "soft clinical" design system** is now the global default (`apps/web/src/app/globals.css`), not just the landing page:
  - Warm palette (cream paper, lavender/plum primary, apricot accent) with a matching warm dark mode; tokens `--accent`, `--accent-deep`, `--accent-light` added.
  - Headings use the display face (`--display-stack`, Bricolage Grotesque); Tailwind radius scale raised (`rounded-md/lg/xl` are rounder) and `shadow-*` map to soft layered shadows.
  - Utilities: `surface` / `surface-sm` (replace bordered boxes), `soft-wash` (grainy lavender→peach), `kicker`, `.page-hero` (+ `.page-hero-orb`), `.page-glow` (layout backgrounds), `.lift` (hover).
- Shared primitives (`packages/ui`): pill buttons, 24px cards, rounded inputs with focus halo, segmented pill tabs, blurred dialog overlay, gradient progress.
- Layout: single sticky translucent header (Categories row removed — filtering lives on `/courses`; search is a pill, in the menu drawer on phones), plum grain footer panel, shared `PageHero` (`components/layout/page-hero.tsx`).
- Pages: courses (search + filter pills in one bar, `course-filter-bar.tsx`; sidebar removed, grid full width; `AutoSubmitForm` now auto-submits only on select/radio/checkbox changes and re-enables fields on back/forward cache restore), course detail (light hero, floating enrol card), instructors, simulators, login (photo panel), become-instructor, account, instructor area, lesson player.
- Codemod: 4px corners → pills/rounded fields (36); bordered boxes → `surface`/`surface-sm` (53); dashed empty states → `soft-wash` (11). `categories-menu.tsx` deleted (unused).
- Verified in Chrome at 1440 and 390 px across 11 pages, light and dark: zero horizontal overflow (fixed pre-existing 34 px / 248 px overflow on course detail and account via `minmax(0,1fr)` grid columns).

### Second pass (same day): playful landing page with real photos

- New sections: hero (arched photo, floating scan card + 3D render), topic marquee, image pathway cards, pinned scroll-told "How you'll learn" (`learning-journey.tsx`), dark practice band (browser practice formats; hardware simulators named only as "designed to sit alongside"), faculty CTA, FAQ with photo, image credits.
- Motion: `Reveal` (IntersectionObserver) for scroll-in, CSS scroll-timeline reading-progress bar, morphing blob, marquee. All disabled under `prefers-reduced-motion`; content stays visible without JS.
- Styles moved out of `globals.css` into `src/components/home/home.css`; Bricolage Grotesque added as `--font-display` via `next/font` (self-hosted).
- **Decisions log — landing imagery:** photos come from Wikimedia Commons (CC0 / CC BY / CC BY-SA), stored in `src/components/home/images/` and credited in `image-credits.tsx`. Crops remove exam IDs, dates and — on the 3D render — the on-screen sex field (PC-PNDT). Marketing images are not protected content, so the signed-URL rule doesn't apply; replace with faculty-supplied images when available.
- Visual QA done in Chrome at 1440px and 390px (no horizontal overflow, no runtime errors; only the pre-existing missing `favicon.ico` 404).
- Responsive pass, measured at 2560/1920/1440/1024/768/390/360: container widens to 1400px (≥1600) and 1560px (≥2000) with the header; hero fills the first screen on desktop (capped at 1080px); journey steps use px-capped heights with a vertically centred pinned stage; pathway cards and practice tasks become scroll-snap swipe rails under 768px; header Register button moves into the menu drawer under 640px (it overflowed at 360px). Mobile page length went from 11.6 to 8.6 screens at 390px; zero horizontal overflow at every size.
- Content pass: home copy now describes shipped features only (from this file and `TODO.md`).
  - "How you'll learn" = video with in-video questions → measure on DICOM → instant grading vs faculty reference (result mock-up) → progress report with topic strengths (report mock-up). Both mock-ups are labelled "Illustrative example".
  - New trust strip: protected content, de-identified scans, PC-PNDT, English/Hindi.
  - Dark band = the real imaging toolkit (calipers/ellipses, landmarks/outlines, findings + SR, calculators + working) plus an "On the way" row for planned work only: LIV-1, COMM-1, IMG-5, IMG-9, IMG-6. Hardware-simulator names removed (no integration exists yet).
  - Faculty CTA lists real instructor tools (INS-1…INS-9); two FAQs added (how grading works, de-identification).
  - **Keep in sync:** when an "On the way" item ships, move it out of `Home.practice.soon` in `messages/*.json`.
- "Why it's different" section (`difference.tsx`, after the topic ribbon): typical LMS vs. here across images, practice, assessment, feedback, reasoning and progress (every "here" claim is a shipped feature), then "the understanding loop" (see it → do it → find out why → try again). On mobile the table becomes one card per row.

## Update 2026-11-16 (later): instructor speed, topics, progress reports, calculators

All verified in real Chrome against the dev database. Typecheck, lint and tests are green (API 124, web 55, types 81).

- **Instructor dashboard speed** (TODO PERF-1):
  - `instructor/loading.tsx` plus a spinner on the clicked sidebar link: navigation gives feedback while a page compiles or renders.
  - Imaging UI is lazy-loaded. First-load JS: course editor 452 → 242 kB, lesson page 425 → ~206 kB.
  - Cause of "tabs don't respond": clicks made before the 9.7 MB dev editor chunk hydrated were dropped. Fixed by the smaller chunk.
  - The DICOM workspace lays out by its own width (CSS container query), so it stacks cleanly beside the calculator panel.
- **Question topics** (INS-7): topics are records now. Side panel to create, rename, reorder and delete; add single questions; bulk move / delete; import picks a default topic; quiz and in-video questions take a topic. The migration converted the old free-text topics (11 in the dev DB) and tagged bank-copied quiz questions.
- **Progress reports** (INS-8):
  - Students tab: "Current lesson" column (also in the CSV) and a report link per student.
  - Report: last / next lesson, views, video watch time and furthest point, in-video question tries, quiz and DICOM attempt history, strengths and weaknesses per topic.
  - Learners see the same report under **My learning → Progress report**.
  - Watch time and views are recorded from this release on; older activity shows 0.
- **DICOM calculators and working** (INS-9):
  - Case editor: "Calculators and resources" (FMF, perinatology.com suggestions), a calculator per report field, and learners' working Off / Optional / Required with a prompt.
  - Learner: calculator opens beside the case; working = explanation + up to 6 photos/PDFs.
  - Reports tab: "Check working", then Verify or Return (feedback required). The learner sees the verdict.
- **Migrations** (run `pnpm --filter @obgyn/api db:deploy`):
  - `20261116120000_question_topics_and_progress`: `QuestionTopic`; `topicId` on bank and quiz questions; `Course.entranceTopicId` (replaces `entranceTopic`); `LessonProgress.furthestSec / watchedSec / views`. Data-preserving.
  - `20261116140000_calculation_working`: `Lesson.resources`; working fields and `WorkingStatus` on `ImagingAttempt`.
- **Reseed note:** a fresh seed names topics after the modules ("Dating and Doppler", …). The migrated dev DB still has "Module 1" … "Module 10" (instructors can rename them).
- **Next:** INS-10 to INS-16 and CALC-1 in `docs/TODO.md`; PERF-2 to PERF-4 unchanged.

## Update 2026-11-16: DICOM imaging tests working end to end

- **Verified in real Chrome with a scratchpad fixture:**
  - Faculty uploaded a DICOM. Patient details were stripped on the server (byte-checked) and the calibration was read.
  - Faculty drew the reference ellipse and caliper: HC 164.33 mm and BPD 44.00 mm, exactly matching the fixture's geometry. They set tolerances and a finding, and saved; the reference SR parses back with TID 1500.
  - Learner, outside the range: failed at 0%, with reasons (VALUE, POSITION, WRONG).
  - Learner, inside the range: passed at 100%, and the lesson was marked complete. The reference overlay and SR download work.
- **Fixes made today:**
  - **Web dev now uses webpack (`next dev`, no `--turbopack`).** Turbopack deadlocked compiling Cornerstone's worker and WASM `new URL()` imports.
  - `next.config.ts` webpack fallbacks `fs/path/crypto: false` for the Emscripten codecs.
  - Uploaders can open their own assets: faculty draw on a DICOM before the case is saved.
  - Cornerstone `getViewport` typing.
  - The reference label no longer overlaps the learner's.
- **Authentication update (2026-11-17):** fixed development credentials and the
  `dev-login` endpoint are removed. OTP codes are random and printed only by the
  development API console sender. Sign-up verifies an email OTP; existing accounts
  can use OTP or a password they have set.
- **Start command:** run `corepack enable` once, then `pnpm turbo run dev --filter=@obgyn/web --filter=@obgyn/api`. Turbo needs `pnpm` on the PATH; `corepack pnpm turbo …` fails with "Unable to find package manager binary".
- **Checks:** typecheck, lint and test are all green (21/21 tasks).
- **Still open:**
  - DRM provider choice and the Chrome-desktop policy (section 1).
  - Decisions-log entries.
  - Phase 3: TID 5000 import, Orthanc/cine, compressed transfer syntaxes.
  - A test case is in the course: chapter "DICOM practice (test)", lesson "Measure the ring (DICOM test)". Delete it when no longer needed.

## Status on 2026-11-15

Two pieces of work are in flight:

- **Video DRM:** working end to end with a free development licence mode (ClearKey). ClearKey encrypts the video but does **not** block screenshots or recordings; that needs a paid licence provider, which is still to be chosen.
- **DICOM imaging tests:**
  - **Done:** shared package, API, viewer, learner lesson, faculty editor, translations.
  - **Not done:** web typecheck, the browser test, docs.

---

## 1. Video DRM (content protection)

### Done and verified

| Piece | Where |
|---|---|
| Encrypted packaging: ffmpeg (H.264/AAC ≤720p), then Shaka Packager v3.9.3. One CMAF set, cbcs, DASH + HLS, PSSH for Widevine, PlayReady, FairPlay and ClearKey. | `apps/api/src/drm/` (`packaging.ts`, `drm-packager.service.ts`) |
| Per-video content keys, wrapped at rest with AES-256-GCM (`DRM_KEY_ENCRYPTION_KEY`) | `apps/api/src/drm/content-keys.ts`, `DrmPackage` model |
| Auto-package on video upload; resume after restart; CLI for existing videos (`pnpm --filter @obgyn/api drm:package [--force]`, runs from `dist`) | `drm-packager.service.ts`, `package-cli.ts` |
| Playback session `GET /media/:id/playback`, session-bound grant (≤5 min) in every manifest, segment and licence path | `apps/api/src/media/media.service.ts`, `media.controller.ts` |
| Licence provider interface plus the **ClearKey dev adapter** (refused in production by env validation) | `apps/api/src/drm/providers/` |
| Shaka Player 5.3.2 in `ProtectedPlayer`: refreshes the grant before expiry without interrupting playback, prefers hardware key systems, and `DRM_REQUIRE_HARDWARE` refuses software DRM | `apps/web/src/components/protected-player.tsx`, `apps/web/src/lib/drm.ts` |
| Capture shield on every protected view. It blanks content when the window loses focus, on PrintScreen and ⌘⇧ shortcuts (until the learner clicks), and when printing. It also pauses the video. | `packages/ui/src/components/protected-surface.tsx` |
| Media tools installer | `tools/install-media-tools.sh` (`tools/bin/` is git-ignored; ffmpeg via Homebrew) |

What was verified:
- **curl, end to end:**
  - Manifests, segments and the licence all serve.
  - A tampered token gets 403 and path traversal gets 404.
  - A wrong key ID gets 400.
  - Segments and the licence get 403 after logout.
- **Real Chrome:** the video decrypts and plays, and the shield works.

Fixes made along the way:
- Error 6012: Shaka was picking Widevine, which has no licence server in dev. It now only ranks key systems that have a server.
- Only *critical* Shaka errors stop playback.
- The dev DRM badge was removed at the user's request. That info now goes to the console and the `data-drm` attribute.

### DRM: open items

1. **Pick a paid multi-DRM provider** (CLAUDE.md rule 10: ask first). Candidates: DoveRunner/PallyCon, EZDRM (~$199.99/mo Universal + FairPlay $99.99/mo, verify), VdoCipher (hosted; replaces our pipeline).
   - Then implement a `DrmProvider` adapter: licence URLs, a token per user and session, and `registerKey`.
   - **The question to the user was interrupted.**
2. Decide on Chrome desktop. It only has software Widevine (L3), so captures are *not* blocked there. Options: allow it and rely on the watermark, or set `DRM_REQUIRE_HARDWARE=true`.
3. **Grant-refresh check over 5 minutes was not finished.** Shortening the TTL to 30 s, to test faster, broke the user's playback, and the `.env` was restored.
   - To finish it, log in once and **reuse the token** (OTP request is rate-limited). Don't edit `.env`.
4. Electron: stock Electron has no Widevine. Use castLabs ECS if desktop needs commercial DRM. `setContentProtection(true)` already blacks out the window.
5. Write `docs/03-CONTENT-PROTECTION.md`: a capability matrix of what blocks capture where, plus the decisions. Add the DRM decisions to the `02-ARCHITECTURE.md` decisions log.

---

## 2. DICOM imaging tests (Phase 1 + 2)

The goal comes from the user: faculty upload a DICOM and draw reference measurements with an **allowed deviation**. Students measure the same image with the same tools and generate a **DICOM SR**. The server grades the SR: within range passes, otherwise fails.

> User feedback: keep it **generic**. No dataset- or measurement-specific scripts. An HC18-specific converter was started, then deleted at the user's request. HC18 itself is CC BY 4.0 and the download sits in the scratchpad only.

### Done

**Shared package `packages/dicom` (`@obgyn/dicom`, depends on `dcmjs@0.52.2`)**, built and tested (8 tests):

- `geometry.ts`:
  - caliper length
  - ellipse circumference (Ramanujan II)
  - placement error (endpoints, ellipse centre and axes)
  - helpers that build and decompose the stored ellipse points
- `image.ts`:
  - header facts and calibration (ultrasound regions first, then Pixel Spacing)
  - **server-side de-identification**: a PS3.15 basic-profile subset, private, overlay and comment tags removed, UIDs replaced
- `sr.ts`: `buildMeasurementReport` and `parseMeasurementReport`.
  - Comprehensive SR built on TID 1500.
  - Each measurement is a LOINC-coded NUM with the drawing (POLYLINE or ELLIPSE) and a reference to its image and frame.
  - Findings and report values are stored under the local coding scheme `99OBGLMS`.
  - Works in both browser and Node.

**Shared types** in `packages/types/src/imaging.ts`:
- 15 measurement concepts, with LOINC codes verified against DICOM CID 12005, 12006, 12009 and 12011. Nuchal translucency is **33069-6**.
- Calibration and image metadata.
- Answer-key schema: per measurement, value tolerance in mm **or** %, whichever is larger, plus optional placement tolerance in mm and marks.
- Findings (multiple choice) and report fields (number with unit and tolerance).
- The learner's public view, the result, the submission, and `dicomPseudonym()`.
- Lesson kind `IMAGING` and upload kind `DICOM` (200 MB).

**API** (`apps/api/src/imaging/`, migration `20261115174304_imaging_cases`):
- Models: `ImagingCase` (holds the key as JSON and the reference SR asset), `ImagingImage`, `ImagingAttempt`, and `MediaAsset.dicomMeta`.
- Upload completion for DICOM de-identifies the file, overwrites the stored copy, records its header facts, and returns them (`uploads.service.ts`).
- `GET/PUT /instructor/lessons/:id/imaging` saves a case. On save it:
  - validates with zod
  - requires calibration and in-bounds drawings
  - screens text for PC-PNDT terms
  - computes the reference values
  - regenerates the reference SR
- `POST /learn/lessons/:id/imaging/attempts` takes `{ sr: base64 }` and:
  - parses the SR and screens it for PC-PNDT terms
  - grades it
  - stores the SR as an asset
  - marks the lesson complete on pass
- `grading.ts` recomputes every value from the SR's own drawings and the image calibration. A typed value that doesn't match the drawing fails (`MISMATCH`). Reasons: MISSING, VALUE, POSITION, MISMATCH, WRONG. 7 tests.
- Asset access (`access.service.ts`):
  - case images follow the same rules as lesson media
  - a learner's SR is visible to that learner and course staff
  - the reference SR is staff only
- Lesson detail returns `imaging`. Authoring treats IMAGING as gated, with a pass percentage.
- `common/zod.ts` (`zodOrThrow`) is now shared with the bank service.
- **API typecheck clean, 96 tests pass.**

**Web**:
- `components/imaging/cornerstone.ts`: lazy Cornerstone3D 5.13.2 init (core, tools, dicom-image-loader).
- `components/imaging/dicom-viewer.tsx`:
  - stack viewport with pan, zoom, contrast and frame scroll
  - **our own SVG measurement layer**: caliper and rotatable ellipse, editable handles, move, Delete key
- `components/imaging/imaging-workspace.tsx`: the shared workspace.
  - Image tabs, toolbar and frame slider.
  - Measurement list where each drawing gets a label.
  - Signed-URL cache, and the protected surface (watermark and shield).
- `components/player/imaging-lesson.tsx`: the learner's lesson.
  - Task checklist, findings, report values.
  - **Builds the SR in the browser** and submits it.
  - Results table, a reference-overlay toggle, and SR download.
- `components/instructor/editor/imaging-case-dialog.tsx`: the faculty editor.
  - Upload images, draw reference measurements, set tolerances per item with a live "Accepted: min–max mm" range.
  - Findings, report values, instructions.
  - Save, and download the reference SR.
- Curriculum tab: a "DICOM case" lesson type and an **Edit case** button. Lesson view dispatch; nav icon.
- `file-upload.tsx`: DICOM MIME handling and server error messages, and returns `dicom` metadata.
- Messages: the `Imaging` namespace plus `Common.kind.IMAGING` and `Instructor.editor.editCase`, in **en and hi** (saved).

### Imaging: next steps (tomorrow)

1. `pnpm --filter @obgyn/web typecheck && lint && test`. Expect a few type fixes, e.g. Cornerstone viewport typings in `dicom-viewer.tsx` and Button `size`/`variant` props. Run the message parity test.
2. **Restart the dev servers** (TaskStop the old one first). New package `@obgyn/dicom`; `turbo dev` builds it through `^build`.
3. Check that Cornerstone runs under **Turbopack** (`next dev --turbopack`): web workers through `new URL(..., import.meta.url)` and the WASM codecs. If they fail, run webpack dev for now (`next dev`) or copy the codecs to `public/` and call `setWasmBasePath`.
4. End-to-end test (Playwright with `channel: 'chrome'`). Use throwaway DICOM fixtures in the scratchpad, **not** in the repo; the test helper `packages/dicom/src/test-image.ts` can make one.
   - **As instructor:** add a DICOM case lesson, upload a DICOM, draw and label measurements, set tolerances, add a finding, save. Then download the reference SR and parse it.
   - **As learner:** measure inside the range → pass; outside → fail with a reason; a typed value that doesn't match the drawing → MISMATCH. Download "my SR".
5. Update `docs/02-ARCHITECTURE.md` decisions log:
   - Cornerstone3D embedded instead of full OHIF.
   - Our own measurement layer, because Cornerstone's ellipse is axis-aligned and reports area, not circumference.
   - DICOM served through the signed gateway with `wadouri`.
   - SR built on TID 1500.
   - Grading recomputes values from the drawings.
   - Orthanc deferred to Phase 3.
6. Then Phase 3 (not started):
   - import TID 5000 OB-GYN SRs from ultrasound machines as the answer key
   - Orthanc/DICOMweb for multi-frame and cine studies
   - test compressed transfer syntaxes (JPEG baseline) through the de-identify round trip

---

## How to run (dev)

- **Start the dev servers:**
  ```
  export PATH=<scratchpad>/bin:$PATH TURBO_TELEMETRY_DISABLED=1
  pnpm turbo run dev --filter=@obgyn/web --filter=@obgyn/api --ui=stream
  ```
- **Web and API:** web on http://localhost:3000, API on :4000.
- **Database:** `postgresql://elms:elms@localhost:5432/elms`.
- **Login:** use the seeded account emails in `DEV-LOGINS.md`; the random OTP is
  printed in the development API output. New accounts verify email during sign-up.

| Account | Notes |
|---|---|
| `kodemapa.tutor@gmail.com` | The user's learner account |
| `skip.check@example.com` | Test learner |
| `instructor@example.com` | Course owner |
| `admin@example.com` | Already at its 2-device limit |

- **Gotcha:** OTP request is rate-limited. In scripts, log in once and reuse the token or cookies.
- **DRM dev env** (`apps/api/.env`): `DRM_PROVIDER=clearkey`, `DRM_KEY_ENCRYPTION_KEY` (generated), `SHAKA_PACKAGER_PATH=../../tools/bin/packager`.

## Still pending from earlier

- Phase 3: cart & payments (Razorpay, keys needed).
- Phase 4: live classes, help desk, course Q&A.
