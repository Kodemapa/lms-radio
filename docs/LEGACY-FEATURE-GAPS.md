# LMS features from the previous version: what's still pending

This document compares the old platform (`lms.kodemapa.com` Laravel API + admin, and `lmsweb.kodemapa.com` Next.js site) with the new monorepo, as of 16 Nov 2026. It covers LMS features only. Imaging, DRM and simulators are tracked in `IMAGE-TASKS-GAP-ANALYSIS.md` and `PROGRESS.md`.

Legend: ✅ in the new platform · 🟡 partly · ❌ missing · ⛔ deliberately not ported (conflicts with content protection or compliance).

## 1. Learner (website and apps)

| Feature (old) | New | Notes / what's needed |
|---|---|---|
| Catalogue, categories, search, filters (level, language, price), sort | ✅ | Missing: the **sub-category** tree (`courses/[main]/[sub]`) and **search suggestions** (type-ahead) |
| Course details, instructor pages | ✅ | |
| Enrol (free) | ✅ | Paid enrolment needs checkout (§3) |
| My learning, progress, resume | ✅ | |
| Wishlist | ✅ | |
| Quizzes, assignments, certificates | ✅ | Plus in-video questions, entrance test and DICOM cases (new) |
| **Paid certificate** ("purchase certificate") | 🟡 | The fee field exists; payment flow missing (§3) |
| **Exam certificate** (separate from course certificate) | ❌ | Certificate for a final exam result |
| Course reviews and ratings | ✅ | |
| Edit profile, account security (devices) | ✅ | |
| **Notifications** (bell, mark read / all read) | ❌ | In-app notifications + email; push later (§5) |
| **Delete account** | ❌ | Also a DPDP Act right: delete or anonymise, keep audit logs |
| **Billing details, transaction history, invoices (PDF)** | ❌ | With checkout (§3) |
| **Wallet / store credit**, refund requests ("my refunds") | ❌ | With checkout (§3) |
| **Live classes** (list, detail, join) | ❌ | Phase 4: Zoom Meeting SDK inside our apps (docs/04) |
| **Course discussion / Q&A** (questions, replies, report abuse) | ❌ | Phase 4 |
| **Help & support groups** (join request, approval, group chat) | ❌ | Phase 4 help desk |
| **Teams** (team accounts, invitations, accept invite) | ❌ | Corporate/institute bulk seats |
| Lesson **resources** (downloadable files) | 🟡 | Possible as protected PDFs; raw downloads ⛔ (rule 2) |
| Course **download for offline** | ⛔ | Only via DRM offline licences in the mobile app (later) |
| Email + password login, password reset | ⛔ / 🟡 | OTP login by design; email + password exists in dev only |
| Contact us, FAQs, policy pages (CMS), home sliders, "why choose us" | ❌ | Admin-managed content pages (§4) |

## 2. Instructor

| Feature (old) | New | Notes / what's needed |
|---|---|---|
| Dashboard | 🟡 | ✅ enrolment chart, active learners, completions, pending reviews, invitations; **sales/revenue** waits for commerce |
| Create / edit course, curriculum, quizzes, assignments | ✅ | Plus question bank, entrance test, certificate designer, DICOM cases |
| Curriculum **trash / restore**, permanent delete | ✅ | Soft delete, 30-day purge |
| Assignment review | ✅ | |
| **Student quiz reports** (per-student attempt details) | ✅ | Quizzes, DICOM cases, entrance test; item analysis |
| **Enrolled students** list per course, course analytics | ✅ | Students tab + CSV; Analytics tab |
| Reviews of my courses (reply / report) | ✅ | Reply publicly, report to admins |
| **Coupons / promo codes** | ❌ | §3 |
| **Earnings, commission, withdrawal requests, wallet** | ❌ | §3 (needs payouts policy) |
| **Refund requests** (respond) | ❌ | §3 |
| **Team members** (co-instructors, team vs individual instructor) | ✅ | Editor / grader roles, invitations |
| **Live classes** (schedule, schedule now) | ❌ | Phase 4 |
| Notifications | ❌ | §5 |

## 3. Commerce (Phase 3, not started)

| Feature (old) | New |
|---|---|
| Cart, checkout, payment status page | ❌ |
| Payment gateways: Razorpay, Stripe, PayPal, Flutterwave, Apple IAP | ❌ (Razorpay first; **needs a paid-service decision and keys**, CLAUDE.md rule 10) |
| Promo codes (admin + instructor), apply/remove at checkout | ❌ |
| Taxes (GST), invoices (PDF), invoice download | ❌ |
| Orders, transaction history | ❌ |
| Refund settings, refund requests and decisions | ❌ |
| Commission (platform share), instructor earnings, withdrawals, wallet | ❌ |
| Store credit (wallet top-up) | ❌ |
| Paid certificate fee | 🟡 (field only) |

## 4. Admin

| Feature (old) | New | Notes |
|---|---|---|
| Instructor applications approve/reject | ✅ | **Custom form fields** for the application ❌ |
| Course review / publish / reject | ✅ | |
| **Admin dashboard** (statistics, charts) | ❌ | |
| **Users management** (list, search, block, delete, change role) | ❌ | |
| **Categories CRUD + ordering** | ❌ | Categories are seeded, read-only today |
| Course list / enrolments / instructors with **CSV export** | ❌ | |
| Revenue, sales, commission reports + export | ❌ | With §3 |
| Withdrawal requests, refund settings, taxes, promo codes | ❌ | With §3 |
| Payment gateway settings | ❌ | With §3 (secrets in env/secret manager, not in the DB UI) |
| **CMS**: pages, FAQs, sliders, feature sections, "why choose us", SEO settings | ❌ | |
| App / web settings, mail settings (+ test), Firebase push settings | ❌ | |
| **Languages**: JSON editor, auto-translate | ❌ | Hindi exists as files; admin editing is missing |
| **Discussions moderation**, content reports, report reasons | ❌ | Phase 4 |
| **Groups / group requests** | ❌ | Phase 4 |
| Video encoding queue (encode, re-encode, retry) | 🟡 | DRM packaging runs automatically; no admin status/retry screen |
| Roles list | 🟡 | Fixed roles (learner, faculty, admin) |
| Certificate templates | ✅ | Per course (instructor) |
| System update / migrate / seed endpoints | ⛔ | Replaced by deployments and migrations |

## 5. Cross-cutting

| Feature | New |
|---|---|
| Notifications service (in-app + email; SMS for OTP exists) | ❌ |
| Email templates (enrolment, certificate, assignment graded, payment) | ❌ |
| Audit log | ✅ (writes); admin viewer ❌ |
| Mobile app parity (Expo app exists as a shell) | 🟡 |

## Suggested order

1. **Admin essentials:** user management; categories CRUD with sub-categories; admin dashboard; CSV exports.
2. **Notifications:** in-app bell plus email for key events (enrolment, assignment graded, certificate, new reply).
3. **Instructor insight:** enrolled students, quiz reports, course analytics, curriculum trash/restore.
4. **Commerce (Phase 3):**
   - Razorpay checkout, orders, GST invoices, transaction history;
   - promo codes;
   - refunds;
   - commission, earnings and withdrawals.

   **Needs:** a gateway decision and keys.
5. **Community & live (Phase 4):** live classes (Zoom SDK), course Q&A/discussion with reporting, help-desk groups.
6. **CMS & settings:** pages, FAQs, home sliders, SEO, mail settings, language editor.
7. **Teams:** institute bulk seats, invitations, co-instructors.
8. **Account deletion** (DPDP) and **exam certificates**.

## Decisions needed

- **Payment gateway(s):** Razorpay only, or also Stripe/PayPal? (Paid service, rule 10.) Invoice format and GST registration details.
- **Commission model** and **payout** schedule for instructors.
- Keep **email + password** login for production, or OTP only?
- Are **teams** (institutional seats) in scope for the fetal-medicine course?
- **Offline download** in the mobile app (needs DRM offline licences) — wanted?
