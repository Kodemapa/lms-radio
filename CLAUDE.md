# CLAUDE.md — GIFS e-LMS + Simulator Platform

This file is the entry point for Claude Code. Read it fully before generating any code,
then read the relevant file in `docs/` for the task at hand.

## 1. What we are building

A secure, India-first **e-Learning Management System (e-LMS) for Obstetrics & Gynaecology**
with built-in **browser-based simulators** (fetal/gynae ultrasound, fetal biometry, Doppler,
CTG interpretation, labour-ward emergencies) plus **integrations** with commercial hardware
simulators (ScanTrainer, VirtaMed GynoS, SonoSim, birthing manikins).

Learners: MBBS students, OBG residents (MS/MD/DNB), sonologists, nurses/midwives, faculty.
Delivery: Web, Android, iOS, Desktop (Windows/macOS).

Core differentiators:
1. Content cannot be easily downloaded, screenshotted or screen-recorded (DRM + in-app capture blocking + forensic watermark).
2. Live classes (Zoom Meeting SDK) run **inside our own apps** with capture blocking.
3. Simulators are web-based (no expensive hardware needed) and score learners automatically.
4. **PC-PNDT compliant by design** — the platform never reveals or teaches fetal sex determination.

## 2. Documentation map

| File | Read it when you are working on |
|---|---|
| `docs/01-PRD.md` | Any feature — personas, user stories, acceptance criteria |
| `docs/02-ARCHITECTURE.md` | Repo layout, services, tech stack, deployment |
| `docs/03-CONTENT-PROTECTION.md` | Video DRM, PDF protection, watermarking, capture blocking |
| `docs/04-LIVE-CLASSES.md` | Zoom Meeting SDK integration in mobile/desktop apps |
| `docs/05-SIMULATORS.md` | Ultrasound, biometry, Doppler, CTG, labour-ward, surgical skills |
| `docs/06-INTEGRATIONS.md` | LTI 1.3, xAPI/LRS, hardware simulator vendors, DICOM |
| `docs/07-DATA-MODEL.md` | Database schema |
| `docs/08-API.md` | REST API contracts |
| `docs/09-COMPLIANCE.md` | PC-PNDT, DPDP Act, clinical content governance, audit |
| `docs/10-ROADMAP.md` | Phases, epics, build order, definition of done |
| `reference/` | Starter code for capture blocking (Android, iOS, Electron) |

## 3. Tech stack (decided — do not change without asking)

- **Monorepo:** pnpm + Turborepo, TypeScript everywhere except AI service (Python).
- **Web:** Next.js (App Router) + React + Tailwind + shadcn/ui.
- **API:** NestJS (REST + OpenAPI), Prisma ORM, PostgreSQL, Redis (cache, queues via BullMQ).
- **Mobile:** React Native (Expo dev-client / bare workflow — native modules are required).
- **Desktop:** Electron wrapping the web app with `setContentProtection(true)`.
- **Media:** Shaka Packager (packaging/encryption), Shaka Player (playback), multi-DRM licence provider.
- **Imaging:** Orthanc (DICOM archive, DICOMweb) + OHIF Viewer / Cornerstone3D.
- **AI:** Python FastAPI + PyTorch/MONAI (plane classification, biometry landmarking), LLM tutor.
- **Learning records:** xAPI → open-source LRS (Yet Analytics SQL LRS or Learning Locker).
- **Storage:** S3-compatible (AWS S3 ap-south-1 or MinIO). Data must stay in India.
- **Auth:** NestJS auth module — JWT access + rotating refresh tokens, device binding, OTP login.

## 4. Non-negotiable rules for generated code

1. **PC-PNDT:** never create any field, label, quiz, AI output, annotation tool or dataset
   class that identifies fetal sex. AI models must not be trained to predict it. Any imported
   case containing sex information must be stripped (see `docs/09-COMPLIANCE.md`).
2. **No raw media URLs.** Video, PDFs, DICOM and simulator volumes are served only through
   short-lived signed URLs (≤ 5 min) bound to the user session.
3. **Every protected view shows the dynamic user watermark** (name/ID/timestamp, moving).
4. **Mobile and desktop apps enable capture blocking globally** (see `reference/`).
5. **Clinical numbers are content, not code.** Drug doses, protocols, CTG criteria, centile
   tables live in versioned, faculty-reviewed content records — never hard-coded in UI logic.
6. **Patient data is de-identified before upload**; DICOM tags scrubbed server-side as well.
7. **Accessibility:** WCAG 2.1 AA for web; all simulators keyboard-operable where feasible.
8. **i18n from day one:** English first, Hindi + regional languages via `next-intl` / i18next.
9. Write tests: unit (Vitest/Jest), API e2e (Supertest), web e2e (Playwright).
10. Ask before adding a new paid third-party service.

## 5. Coding conventions

- Strict TypeScript, ESLint + Prettier, conventional commits.
- Feature-folder structure; shared types in `packages/types`; shared UI in `packages/ui`.
- All API inputs validated with `zod` (web) / `class-validator` (Nest).
- Env vars documented in `.env.example`; secrets never committed.
- Every new module ships with: README section, OpenAPI annotations, tests, seed data.

## 6. How to work with these docs

- Start each task by stating which doc sections you are implementing.
- If docs conflict, priority is: `09-COMPLIANCE` > `03-CONTENT-PROTECTION` > `01-PRD` > others.
- If something is undefined, propose a decision, add it to the relevant doc under
  "Decisions log", then implement.
