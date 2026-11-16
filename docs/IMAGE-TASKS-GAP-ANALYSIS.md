# Image annotation assignments: gap analysis

This document compares the plan "Fetal Medicine Course — Image Annotation Assignments & Interactive Features" (16 Nov 2026) against what the platform has today, and sets the order to close the gaps.

**Today (IMAGING lessons):**
- DICOM upload with server-side de-identification and calibration.
- Cornerstone viewer: pan, zoom, contrast, frames.
- Caliper and rotatable-ellipse tools.
- A faculty answer key with value and placement tolerances.
- Multiple-choice findings and numeric report values.
- A learner DICOM SR (TID 1500) graded on the server.
- A result table with the reference overlay; the lesson completes on pass.

Legend: ✅ done · 🟡 partial · ❌ missing · 🔨 this iteration.

## Task types (T1–T8)

| Code | Need | Status | Gap → work |
|---|---|---|---|
| T1 Find the organ | Box / freehand polygon, scored by IoU (≥0.5 full, 0.3–0.5 half) | ✅ | Box and polygon tools; rasterised IoU; half marks |
| T2 Landmark points | Pins on named landmarks within a radius (mm or % of image width); wrong structure scores 0 | ✅ | Point tool; radius check; matching by label |
| T3 Measure | Calipers and ellipse, ±% or ±mm (NT ±0.3 mm), placement | ✅ | Already supported (mm or %, plus placement) |
| T4 Pick the plane | Pick the correct images from a grid / name the plane; ≤N wrong picks | 🟡 (logic ✅, grid UI next) | Multi-select findings with "≤ N wrong"; options can point at a case image. A thumbnail grid UI comes later. |
| T5 Classify | Label from a list, partial credit for clinically close answers | ✅ | Per-option partial credit (%) |
| T6 Spot the anomaly | Region + diagnosis + accepted differentials | ✅ (region + single + multi-select) | Region (T1) + single-choice diagnosis + multi-select differentials |
| T7 Own-scan submission | Learner uploads own scan, labels it, writes a report; faculty checklist; review queue | 🟡 | Assignments take file uploads with approve/reject. **Missing:** annotate own image, 6-item checklist scoring, drawing corrections, resubmit, exemplar flag. JPG/PNG support needed (see Images) |
| T8 Cine / sweep | Pause on the right frame, annotate | 🟡 | Multi-frame DICOM and frame slider exist, and the key stores a frame. **Missing:** an accepted frame *range*; MP4 → frames |

## Annotation, labels and feedback

| Need | Status | Work |
|---|---|---|
| Tools: box, polygon, point, caliper, ellipse | ✅ | Add point, box, polygon (caliper and ellipse exist) |
| Arrow, text label | ❌ | Ungraded teaching aids; later |
| **Instructor shorthand dictionary**, learners use its abbreviations; free labels allowed | ✅ | Course-level dictionary (abbreviation, full name, optional LOINC code, suggested tools). Learners see a searchable list and type any label; labels not in the dictionary are flagged and can't match the key. Standard biometry terms can be imported. |
| Learner blue / faculty green, overlap shown | ✅ | Recolour; the reference overlay already exists |
| Teaching point + link to class per item | 🟡 (teaching point ✅; class link next) | Teaching-point text per key item, shown after submission (link to class later) |
| Second-faculty key review before going live | ❌ | Key status draft → reviewed |
| Image tags (module, class, trimester, system, plane, normal/abnormal, difficulty) | ❌ | Image library with filters |

## Assessment rules

| Need | Status | Work |
|---|---|---|
| Up to 3 retries, best score counts | 🟡 | Unlimited retries today; add a per-lesson max attempts setting and best-score display |
| Random image from a pool of 3–5 per task | ❌ | Task pools: case variants drawn per attempt |
| Answers hidden until the deadline | ❌ | Deadlines on lessons; hide the reference until then |
| Timed / full-screen exam mode (M10 OSCE) | ❌ | Timer, auto-submit, full screen |
| Module score: MCQ 40% + image tasks 35% + own scan 25%, ≥50% and all T7 submitted | ❌ | Module gate configuration and calculation |

## Images and privacy

| Need | Status | Work |
|---|---|---|
| DICOM header de-identification | ✅ | Done (PS3.15 subset, UIDs replaced, private tags dropped) |
| JPG/PNG screenshots (with manual calibration) | ✅ (converted to DICOM Secondary Capture; faculty set mm/pixel) | Convert to DICOM Secondary Capture on upload; faculty set mm/px or draw a known length |
| Burned-in text OCR + black-out + human check | ❌ | OCR service (Tesseract in the AI service) plus a redaction tool |
| Crop/blank regions revealing fetal sex (PC-PNDT) | 🟡 | Uploader attestation only; add a redaction-rectangle tool |
| Hashed case ID, consent record (DPDP) | 🟡 | A pseudonymous case ID exists; consent record still to do |
| ~400 images + 30 cine clips | ❌ | Content work by faculty |

## Interactive features (plan items 1–14)

| # | Feature | Status |
|---|---|---|
| 3 | In-video checkpoints | 🟡 Text questions exist in videos; image questions in videos later |
| 14 | Discussion threads on images | ❌ (Phase 4 course Q&A) |
| 1, 2, 4–13 | Live annotate-along, Plane of the Day, spot-the-difference, case of the week, gallery, peer review, skills dashboard, report builder, calculators, mock practical, role-play, AI pre-check | ❌ Later phases, all built on the same viewer and grader |

## Done on 2026-11-16 (verified in Chrome with the synthetic M2-A2 head image)

- Course dictionary editor, which can import standard biometry or common fetal landmarks. Learners label freely; labels not in the dictionary are flagged and don't score.
- Pin, box and outline tools alongside the caliper and ellipse. Drawing inside an outline works; shapes move only in Pan mode.
- Scoring:
  - pins by radius (mm or % of width);
  - regions by IoU, with full or half marks;
  - multi-select questions with "≤ N wrong";
  - per-option partial credit;
  - teaching points.
- PNG/JPG case images, with a scale set per image.
- Learner test: 90% with partial credit (pin 0.7 mm off, skull outline 76% overlap, BPD 61.6 mm, HC 227.1 mm). The server's reference values match the dataset key exactly.

## Build order

1. **Now (🔨):**
   - annotation dictionary and free labels
   - point, box and polygon tools
   - IoU and radius scoring with half marks
   - multi-select and partial-credit findings, with image options
   - teaching points
   - blue/green feedback
2. **Next:**
   - JPG/PNG upload with calibration
   - T7 own-scan annotation with a checklist review queue
   - max attempts and best score
   - task pools (random variant)
   - frame ranges for cine
3. **Then:**
   - deadlines and hidden answers
   - exam mode
   - module score gate
   - key review workflow
   - image library tags
   - OCR redaction
4. **Interactive features**, in plan order: Plane of the Day, spot-the-difference, case of the week, gallery, annotate-along, dashboard, and so on.

## Open questions (from the plan)

- **LMS:** this platform; the viewer is built in.
- **DICOM vs screenshots:** both. DICOM keeps calibration; screenshots need manual calibration (next step).
- **Faculty review hours for T7:** product decision for the institute.
