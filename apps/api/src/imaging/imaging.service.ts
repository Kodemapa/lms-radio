import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { buildMeasurementReport, DicomError, deidentifyImage, measureMm, parseMeasurementReport, setPixelSpacing, SrError } from '@obgyn/dicom';
import {
  AnnotationDictionarySchema,
  dicomPseudonym,
  DicomImageMetaSchema,
  findFetalSexDeterminationText,
  ImagingCaseInputSchema,
  ImagingSubmitSchema,
  isMeasuringTool,
  labelCode,
  normalizeLabel,
  type AnnotationTerm,
  type AnnotationTool,
  type DicomImageMeta,
  type ImagingCasePublic,
  type ImagingImage,
  type ImagingResult,
  type ImagingResultItem,
  type InstructorImagingCase,
} from '@obgyn/types';
import { type ImagingAttempt, type Lesson, type MediaAsset } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { type AuthUser } from '../auth/auth-user';
import { zodOrThrow } from '../common/zod';
import { AccessService } from '../courses/access.service';
import { DEFAULT_PASS_PERCENT } from '../learning/grading';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { gradeImaging, readKey, type CaseKey, type GradingImage, type KeyAnnotation } from './grading';
import { RasterError, rasterToDicom } from './raster';

const DICOM_MIME = 'application/dicom';
const MAX_SR_BYTES = 3 * 1024 * 1024;

/** Learner-facing messages for files we can't use. */
const DICOM_PROBLEMS: Record<DicomError['code'], string> = {
  NOT_DICOM: 'This is not a DICOM file',
  NOT_IMAGE: 'This DICOM file has no image (structured reports and other objects cannot be used as case images)',
  UNSUPPORTED: 'This DICOM file uses an unsupported format',
};

/** PC-PNDT: case text, dictionary and learner reports must never refer to fetal sex. */
function assertNoFetalSex(texts: (string | null | undefined)[], what: string): void {
  const hits = texts.flatMap((text) => (text ? findFetalSexDeterminationText(text) : []));
  if (hits.length) throw new BadRequestException({ code: 'PCPNDT_BLOCKED', message: `${what} refers to fetal sex`, terms: [...new Set(hits)] });
}

/**
 * IMAGING lessons: faculty upload DICOM images, draw the answer (landmark
 * pins, regions, calipers, ellipses) with tolerances, and set findings and
 * report values; learners annotate the same images using the course's
 * shorthand dictionary and submit a DICOM SR that is graded against the key.
 */
@Injectable()
export class ImagingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
  ) {}

  // ---- Upload processing -------------------------------------------------------

  /**
   * Runs when a DICOM upload completes: de-identifies it server-side (rule 6),
   * overwrites the stored file and records its header facts. Rejects files
   * that are not DICOM images.
   */
  async processUpload(asset: MediaAsset): Promise<DicomImageMeta> {
    const original = await this.storage.readBuffer(asset.storageKey);
    let result;
    try {
      // PNG/JPEG screenshots are wrapped as DICOM Secondary Capture first.
      const dicom = asset.mimeType === 'image/png' || asset.mimeType === 'image/jpeg' ? rasterToDicom(original, asset.mimeType) : original;
      result = deidentifyImage(dicom, dicomPseudonym(asset.id).id);
    } catch (error) {
      if (error instanceof DicomError || error instanceof RasterError) {
        await this.prisma.mediaAsset.delete({ where: { id: asset.id } });
        const message = error instanceof RasterError ? (error.code === 'TOO_LARGE' ? 'Image is larger than 8000 × 8000 pixels' : 'This image could not be read') : DICOM_PROBLEMS[error.code];
        throw new BadRequestException({ code: error instanceof RasterError ? `IMAGE_${error.code}` : `DICOM_${error.code}`, message });
      }
      throw error;
    }
    const bytes = new Uint8Array(result.bytes);
    await this.storage.putBuffer(asset.storageKey, bytes, DICOM_MIME);
    await this.prisma.mediaAsset.update({
      where: { id: asset.id },
      data: { dicomMeta: result.meta, sizeBytes: bytes.byteLength, mimeType: DICOM_MIME },
    });
    return result.meta;
  }

  /**
   * Sets the scale of a case image the uploader owns (screenshots and other
   * images without pixel spacing): rewrites Pixel Spacing in the file.
   */
  async setCalibration(user: AuthUser, assetId: string, mmPerPx: unknown): Promise<DicomImageMeta> {
    const value = Number(mmPerPx);
    if (!(value > 0 && value < 100)) throw new BadRequestException('mm per pixel must be between 0 and 100');
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id: assetId } });
    if (!asset || asset.kind !== 'DICOM' || !asset.dicomMeta) throw new NotFoundException();
    if (asset.ownerId !== user.userId && user.role !== 'ADMIN') throw new ForbiddenException();
    const { bytes, meta } = setPixelSpacing(await this.storage.readBuffer(asset.storageKey), value);
    const body = new Uint8Array(bytes);
    await this.storage.putBuffer(asset.storageKey, body, DICOM_MIME);
    await this.prisma.mediaAsset.update({ where: { id: assetId }, data: { dicomMeta: meta, sizeBytes: body.byteLength } });
    await this.audit.log({ actorId: user.userId, action: 'imaging.scale_set', resource: 'media_asset', resourceId: assetId, metadata: { mmPerPx: value } });
    return meta;
  }

  // ---- Annotation dictionary (course-level) ---------------------------------------

  async dictionary(courseId: string): Promise<AnnotationTerm[]> {
    const rows = await this.prisma.annotationTerm.findMany({ where: { courseId }, orderBy: { position: 'asc' } });
    return rows.map((row) => ({
      abbr: row.abbr,
      name: row.name,
      description: row.description,
      loinc: row.loinc,
      tools: row.tools as AnnotationTool[],
    }));
  }

  async instructorDictionary(user: AuthUser, courseId: string): Promise<AnnotationTerm[]> {
    await this.ownedCourse(user, courseId);
    return this.dictionary(courseId);
  }

  /** Replaces the course dictionary. Cases keep their labels; unknown labels simply stop matching new terms. */
  async saveDictionary(user: AuthUser, courseId: string, body: unknown): Promise<AnnotationTerm[]> {
    await this.ownedCourse(user, courseId, { editable: true });
    const terms = zodOrThrow(AnnotationDictionarySchema, body);
    assertNoFetalSex(terms.flatMap((t) => [t.abbr, t.name, t.description]), 'The dictionary');
    await this.prisma.$transaction([
      this.prisma.annotationTerm.deleteMany({ where: { courseId } }),
      this.prisma.annotationTerm.createMany({
        data: terms.map((term, index) => ({
          courseId,
          position: index + 1,
          abbr: term.abbr,
          abbrKey: normalizeLabel(term.abbr),
          name: term.name,
          description: term.description,
          loinc: term.loinc,
          tools: term.tools,
        })),
      }),
    ]);
    await this.audit.log({ actorId: user.userId, action: 'imaging.dictionary_saved', resource: 'course', resourceId: courseId, metadata: { terms: terms.length } });
    return this.dictionary(courseId);
  }

  // ---- Faculty -------------------------------------------------------------------

  async instructorCase(user: AuthUser, lessonId: string): Promise<InstructorImagingCase> {
    await this.ownedLesson(user, lessonId);
    const [row, images] = await Promise.all([this.prisma.imagingCase.findUnique({ where: { lessonId } }), this.images(lessonId)]);
    const key = readKey(row?.key);
    return {
      instructions: row?.instructions ?? '',
      images,
      annotations: key.annotations,
      findings: key.findings,
      reportFields: key.reportFields,
      referenceSrAssetId: row?.referenceSrAssetId ?? null,
    };
  }

  async saveCase(user: AuthUser, lessonId: string, body: unknown): Promise<InstructorImagingCase> {
    const lesson = await this.ownedLesson(user, lessonId, { editable: true });
    const input = zodOrThrow(ImagingCaseInputSchema, body);
    const dictionary = await this.dictionary(lesson.courseId);

    const assets = await this.prisma.mediaAsset.findMany({ where: { id: { in: input.images.map((i) => i.assetId) } } });
    const metaById = new Map<string, DicomImageMeta>();
    for (const image of input.images) {
      const asset = assets.find((a) => a.id === image.assetId);
      if (!asset || asset.kind !== 'DICOM' || asset.status !== 'READY' || !asset.dicomMeta) {
        throw new BadRequestException({ code: 'NOT_A_DICOM_IMAGE', message: `"${image.label}" is not an uploaded DICOM image` });
      }
      if (asset.ownerId !== user.userId && user.role !== 'ADMIN') throw new ForbiddenException();
      metaById.set(asset.id, DicomImageMetaSchema.parse(asset.dicomMeta));
    }

    const annotations: KeyAnnotation[] = input.annotations.map((a) => {
      const meta = metaById.get(a.assetId)!;
      const needsCalibration = isMeasuringTool(a.tool) || (a.tool === 'POINT' && a.radiusPercent === null);
      if (needsCalibration && !meta.calibration) {
        throw new BadRequestException({
          code: 'UNCALIBRATED',
          message: `${a.label}: this image has no pixel spacing, so it can't be measured in mm${a.tool === 'POINT' ? ' (use a radius in % of width instead)' : ''}`,
        });
      }
      if (a.frame > meta.frames) throw new BadRequestException(`${a.label}: frame ${a.frame} does not exist`);
      const outside = a.coords.some(([x, y]) => x < -1 || y < -1 || x > meta.columns + 1 || y > meta.rows + 1);
      if (outside) throw new BadRequestException(`${a.label}: the drawing is outside the image`);
      const referenceMm = isMeasuringTool(a.tool) ? Math.round(measureMm(a.tool, a.coords, meta.calibration!) * 100) / 100 : null;
      return { ...a, referenceMm };
    });

    assertNoFetalSex(
      [
        input.instructions,
        ...input.images.map((i) => i.label),
        ...input.annotations.flatMap((a) => [a.label, a.teachingPoint]),
        ...input.findings.flatMap((f) => [f.label, f.teachingPoint, ...f.options.map((o) => o.label)]),
        ...input.reportFields.flatMap((f) => [f.label, f.teachingPoint]),
      ],
      'Case text',
    );

    const key: CaseKey = { annotations, findings: input.findings, reportFields: input.reportFields };
    const reference = buildMeasurementReport({
      images: input.images.map((i) => metaById.get(i.assetId)!),
      patient: dicomPseudonym(input.images[0]!.assetId),
      observer: 'Faculty^Reference',
      title: `Reference: ${lesson.title}`,
      annotations: annotations.map((a) => ({
        trackingId: a.id,
        code: labelCode(a.label, dictionary),
        tool: a.tool,
        valueMm: a.referenceMm,
        coords: a.coords,
        image: metaById.get(a.assetId)!,
        frame: a.frame,
      })),
      findings: input.findings.flatMap((f) =>
        f.correctOptionIds.map((id) => ({ id: f.id, label: f.label, optionId: id, optionLabel: f.options.find((o) => o.id === id)!.label })),
      ),
      reportFields: input.reportFields.map((f) => ({ id: f.id, label: f.label, unit: f.unit, value: f.value })),
    });
    const referenceAsset = await this.storeSr(`imaging/${lessonId}/reference-${randomUUID()}.dcm`, reference, user.userId, `${lesson.title} (reference).dcm`);

    const previous = await this.prisma.imagingCase.findUnique({ where: { lessonId }, select: { referenceSrAssetId: true } });
    await this.prisma.$transaction([
      this.prisma.imagingCase.upsert({
        where: { lessonId },
        create: { lessonId, instructions: input.instructions, key: key as object, referenceSrAssetId: referenceAsset.id },
        update: { instructions: input.instructions, key: key as object, referenceSrAssetId: referenceAsset.id },
      }),
      this.prisma.imagingImage.deleteMany({ where: { lessonId } }),
      this.prisma.imagingImage.createMany({
        data: input.images.map((image, index) => ({ lessonId, assetId: image.assetId, label: image.label, position: index + 1 })),
      }),
      ...(previous?.referenceSrAssetId ? [this.prisma.mediaAsset.delete({ where: { id: previous.referenceSrAssetId } })] : []),
    ]);
    await this.audit.log({
      actorId: user.userId,
      action: 'imaging.case_saved',
      resource: 'lesson',
      resourceId: lessonId,
      metadata: { images: input.images.length, annotations: annotations.length, findings: input.findings.length, reportFields: input.reportFields.length },
    });
    return this.instructorCase(user, lessonId);
  }

  // ---- Learner -------------------------------------------------------------------

  /** What a learner sees: images, tasks and the dictionary — never the answers (until they submit). */
  async publicCase(user: AuthUser, lesson: Pick<Lesson, 'id' | 'passPercent' | 'courseId'>): Promise<ImagingCasePublic | null> {
    const [row, images, attempt, dictionary] = await Promise.all([
      this.prisma.imagingCase.findUnique({ where: { lessonId: lesson.id } }),
      this.images(lesson.id),
      this.prisma.imagingAttempt.findFirst({ where: { lessonId: lesson.id, userId: user.userId }, orderBy: { createdAt: 'desc' } }),
      this.dictionary(lesson.courseId),
    ]);
    if (!row) return null;
    const key = readKey(row.key);
    const passPercent = lesson.passPercent ?? DEFAULT_PASS_PERCENT;
    return {
      instructions: row.instructions,
      passPercent,
      images,
      dictionary,
      tasks: key.annotations.map((a) => ({ id: a.id, label: a.label, tool: a.tool, assetId: a.assetId })),
      findings: key.findings.map((f) => ({
        id: f.id,
        label: f.label,
        multiple: f.multiple,
        options: f.options.map((o) => ({ id: o.id, label: o.label, assetId: o.assetId })),
      })),
      reportFields: key.reportFields.map((f) => ({ id: f.id, label: f.label, unit: f.unit })),
      lastResult: attempt ? this.toResult(attempt, passPercent) : null,
    };
  }

  async submit(user: AuthUser, lessonId: string, body: unknown): Promise<ImagingResult> {
    const { lesson, enrolled, manager } = await this.access.getAccessibleLesson(user, lessonId);
    if (lesson.kind !== 'IMAGING') throw new BadRequestException('Not an imaging case');
    if (!enrolled && !manager) throw new ForbiddenException({ code: 'NOT_ENROLLED' });
    const { sr } = zodOrThrow(ImagingSubmitSchema, body);
    const bytes = Buffer.from(sr, 'base64');
    if (bytes.byteLength > MAX_SR_BYTES) throw new BadRequestException({ code: 'SR_TOO_LARGE' });

    const row = await this.prisma.imagingCase.findUnique({ where: { lessonId } });
    if (!row) throw new ConflictException({ code: 'CASE_EMPTY' });
    let report;
    try {
      report = parseMeasurementReport(bytes);
    } catch (error) {
      if (error instanceof SrError) throw new BadRequestException({ code: 'INVALID_SR', message: 'The report is not a valid DICOM SR' });
      throw error;
    }
    assertNoFetalSex(report.texts, 'The report');

    const [images, dictionary] = await Promise.all([this.images(lessonId), this.dictionary(lesson.courseId)]);
    const gradingImages = new Map<string, GradingImage>(
      images.map((i) => [i.assetId, { sopInstanceUID: i.sopInstanceUID, calibration: i.calibration, columns: i.columns }]),
    );
    const passPercent = lesson.passPercent ?? DEFAULT_PASS_PERCENT;
    const graded = gradeImaging(readKey(row.key), gradingImages, report, passPercent, dictionary);

    const srAsset = await this.storeSr(`imaging/${lessonId}/${user.userId}/${randomUUID()}.dcm`, bytes, user.userId, `${lesson.title} (my report).dcm`);
    const attempt = await this.prisma.imagingAttempt.create({
      data: {
        lessonId,
        userId: user.userId,
        srAssetId: srAsset.id,
        scorePercent: graded.scorePercent,
        passed: graded.passed,
        result: graded.items as object[],
      },
    });
    if (graded.passed) {
      await this.prisma.lessonProgress.upsert({
        where: { userId_lessonId: { userId: user.userId, lessonId } },
        create: { userId: user.userId, lessonId, courseId: lesson.courseId, completedAt: new Date() },
        update: { completedAt: new Date(), skipped: false },
      });
    }
    await this.audit.log({
      actorId: user.userId,
      action: 'imaging.attempt_graded',
      resource: 'lesson',
      resourceId: lessonId,
      metadata: { scorePercent: graded.scorePercent, passed: graded.passed },
    });
    return this.toResult(attempt, passPercent);
  }

  // ---- Helpers -----------------------------------------------------------------------

  private async images(lessonId: string): Promise<ImagingImage[]> {
    const rows = await this.prisma.imagingImage.findMany({
      where: { lessonId },
      orderBy: { position: 'asc' },
      include: { asset: { select: { dicomMeta: true } } },
    });
    return rows.map((row) => ({ assetId: row.assetId, label: row.label, ...DicomImageMetaSchema.parse(row.asset.dicomMeta) }));
  }

  private async storeSr(key: string, bytes: ArrayBuffer | Uint8Array, ownerId: string, name: string) {
    const body = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    await this.storage.putBuffer(key, body, DICOM_MIME);
    return this.prisma.mediaAsset.create({
      data: {
        kind: 'DICOM',
        status: 'READY',
        storageKey: key,
        mimeType: DICOM_MIME,
        sizeBytes: body.byteLength,
        originalName: name.slice(0, 200),
        deidentified: true,
        ownerId,
      },
    });
  }

  private toResult(attempt: ImagingAttempt, passPercent: number): ImagingResult {
    return {
      attemptId: attempt.id,
      scorePercent: attempt.scorePercent,
      passed: attempt.passed,
      passPercent,
      createdAt: attempt.createdAt.toISOString(),
      srAssetId: attempt.srAssetId,
      items: attempt.result as unknown as ImagingResultItem[],
    };
  }

  private async ownedCourse(user: AuthUser, courseId: string, { editable = false } = {}) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId }, select: { instructorId: true, status: true } });
    if (!course) throw new NotFoundException();
    if (course.instructorId !== user.userId && user.role !== 'ADMIN') throw new ForbiddenException();
    if (editable && course.status === 'IN_REVIEW') throw new ConflictException({ code: 'LOCKED' });
    return course;
  }

  private async ownedLesson(user: AuthUser, lessonId: string, { editable = false } = {}) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { course: { select: { instructorId: true, status: true } } },
    });
    if (!lesson || lesson.kind !== 'IMAGING') throw new NotFoundException();
    if (lesson.course.instructorId !== user.userId && user.role !== 'ADMIN') throw new ForbiddenException();
    if (editable && lesson.course.status === 'IN_REVIEW') throw new ConflictException({ code: 'LOCKED' });
    return lesson;
  }
}
