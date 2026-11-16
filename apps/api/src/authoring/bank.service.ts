import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BankBulkSchema,
  BankImportSchema,
  BankQuestionSaveSchema,
  TopicInputSchema,
  TopicOrderSchema,
  type QuestionTopic,
  CertificateTemplateSchema,
  DEFAULT_CERTIFICATE_TEMPLATE,
  EntranceSettingsSchema,
  type BankQuestion,
  type CertificateTemplate,
  type EntranceSettings,
  type InstructorQuestion,
} from '@obgyn/types';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { type AuthUser } from '../auth/auth-user';
import { zodOrThrow } from '../common/zod';
import { CoursePermissions } from '../courses/course-permissions';
import { PrismaService } from '../prisma/prisma.service';
import { AssessmentsService } from './assessments.service';

type StoredOption = { text: string; isCorrect: boolean };


/** Question bank, entrance test settings and certificate design for a course. */
@Injectable()
export class BankService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly assessments: AssessmentsService,
    private readonly permissions: CoursePermissions,
  ) {}

  // ---- Bank ---------------------------------------------------------------------

  async list(user: AuthUser, courseId: string): Promise<BankQuestion[]> {
    await this.ownedCourse(user, courseId);
    const [rows, usage] = await Promise.all([
      this.prisma.bankQuestion.findMany({
        where: { courseId },
        orderBy: [{ topic: { position: 'asc' } }, { createdAt: 'asc' }],
        include: { topic: { select: { name: true } } },
      }),
      this.prisma.quizQuestion.groupBy({
        by: ['bankQuestionId'],
        where: { bankQuestionId: { not: null }, lesson: { courseId } },
        _count: { _all: true },
      }),
    ]);
    const used = new Map(usage.map((u) => [u.bankQuestionId, u._count._all]));
    return rows.map((row) => {
      const options = row.options as StoredOption[];
      return {
        id: row.id,
        topicId: row.topicId,
        topic: row.topic?.name ?? null,
        text: row.text,
        explanation: row.explanation,
        allowMultiple: options.filter((o) => o.isCorrect).length > 1,
        options,
        usedCount: used.get(row.id) ?? 0,
      };
    });
  }

  /** Bulk import (the instructor pastes everything at once). */
  async import(user: AuthUser, courseId: string, body: unknown): Promise<BankQuestion[]> {
    await this.ownedCourse(user, courseId, { editable: true });
    const { questions } = zodOrThrow(BankImportSchema, body);
    const topicIds = await this.ensureTopics(courseId, questions.map((q) => q.topic?.trim() ?? '').filter(Boolean));
    await this.prisma.bankQuestion.createMany({
      data: questions.map((q) => ({
        courseId,
        topicId: q.topic?.trim() ? (topicIds.get(q.topic.trim().toLowerCase()) ?? null) : null,
        text: q.text,
        explanation: q.explanation || null,
        allowMultiple: q.options.filter((o) => o.isCorrect).length > 1,
        options: q.options,
      })),
    });
    await this.audit.log({
      actorId: user.userId,
      action: 'bank.imported',
      resource: 'course',
      resourceId: courseId,
      metadata: { count: questions.length },
    });
    return this.list(user, courseId);
  }

  async update(user: AuthUser, questionId: string, body: unknown): Promise<BankQuestion[]> {
    const row = await this.ownedBankQuestion(user, questionId);
    const q = zodOrThrow(BankQuestionSaveSchema, body);
    await this.assertTopic(row.courseId, q.topicId);
    await this.prisma.bankQuestion.update({
      where: { id: questionId },
      data: {
        topicId: q.topicId,
        text: q.text,
        explanation: q.explanation || null,
        allowMultiple: q.options.filter((o) => o.isCorrect).length > 1,
        options: q.options,
      },
    });
    return this.list(user, row.courseId);
  }

  async remove(user: AuthUser, questionId: string): Promise<BankQuestion[]> {
    const row = await this.ownedBankQuestion(user, questionId);
    await this.prisma.bankQuestion.delete({ where: { id: questionId } });
    return this.list(user, row.courseId);
  }

  /** Write one question straight into the bank. */
  async create(user: AuthUser, courseId: string, body: unknown): Promise<BankQuestion[]> {
    await this.ownedCourse(user, courseId, { editable: true });
    const q = zodOrThrow(BankQuestionSaveSchema, body);
    await this.assertTopic(courseId, q.topicId);
    await this.prisma.bankQuestion.create({
      data: {
        courseId,
        topicId: q.topicId,
        text: q.text,
        explanation: q.explanation || null,
        allowMultiple: q.options.filter((o) => o.isCorrect).length > 1,
        options: q.options,
      },
    });
    return this.list(user, courseId);
  }

  /** Move selected questions to a topic, or delete them. */
  async bulk(user: AuthUser, courseId: string, body: unknown): Promise<BankQuestion[]> {
    await this.ownedCourse(user, courseId, { editable: true });
    const action = zodOrThrow(BankBulkSchema, body);
    const where = { id: { in: action.ids }, courseId };
    if (action.action === 'move') {
      await this.assertTopic(courseId, action.topicId);
      await this.prisma.bankQuestion.updateMany({ where, data: { topicId: action.topicId } });
    } else {
      const { count } = await this.prisma.bankQuestion.deleteMany({ where });
      await this.audit.log({ actorId: user.userId, action: 'bank.bulk_deleted', resource: 'course', resourceId: courseId, metadata: { count } });
    }
    return this.list(user, courseId);
  }

  // ---- Topics ---------------------------------------------------------------------

  async topics(user: AuthUser, courseId: string): Promise<QuestionTopic[]> {
    await this.ownedCourse(user, courseId);
    return this.topicList(courseId);
  }

  async createTopic(user: AuthUser, courseId: string, body: unknown): Promise<QuestionTopic[]> {
    await this.ownedCourse(user, courseId, { editable: true });
    const input = zodOrThrow(TopicInputSchema, body);
    await this.assertNameFree(courseId, input.name);
    const last = await this.prisma.questionTopic.aggregate({ where: { courseId }, _max: { position: true } });
    await this.prisma.questionTopic.create({
      data: { courseId, name: input.name, description: input.description || null, position: (last._max.position ?? 0) + 1 },
    });
    return this.topicList(courseId);
  }

  async updateTopic(user: AuthUser, topicId: string, body: unknown): Promise<QuestionTopic[]> {
    const topic = await this.ownedTopic(user, topicId);
    const input = zodOrThrow(TopicInputSchema, body);
    await this.assertNameFree(topic.courseId, input.name, topicId);
    await this.prisma.questionTopic.update({ where: { id: topicId }, data: { name: input.name, description: input.description || null } });
    return this.topicList(topic.courseId);
  }

  /** Deleting a topic keeps its questions; they move to "No topic". */
  async deleteTopic(user: AuthUser, topicId: string): Promise<QuestionTopic[]> {
    const topic = await this.ownedTopic(user, topicId);
    await this.prisma.questionTopic.delete({ where: { id: topicId } });
    return this.topicList(topic.courseId);
  }

  async reorderTopics(user: AuthUser, courseId: string, body: unknown): Promise<QuestionTopic[]> {
    await this.ownedCourse(user, courseId, { editable: true });
    const { ids } = zodOrThrow(TopicOrderSchema, body);
    const existing = await this.prisma.questionTopic.findMany({ where: { courseId }, select: { id: true } });
    if (existing.length !== ids.length || !existing.every((t) => ids.includes(t.id))) {
      throw new BadRequestException('Send every topic of the course exactly once');
    }
    await this.prisma.$transaction(ids.map((id, i) => this.prisma.questionTopic.update({ where: { id }, data: { position: i + 1 } })));
    return this.topicList(courseId);
  }

  /**
   * Copies bank questions into a quiz lesson, or one into a video at `atSec`.
   * Copies (not links) so later bank edits never change a live quiz silently.
   */
  async addToLesson(
    user: AuthUser,
    lessonId: string,
    bankQuestionIds: string[],
    atSec: number | null,
  ): Promise<InstructorQuestion[]> {
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson || lesson.deletedAt || (lesson.kind !== 'QUIZ' && lesson.kind !== 'VIDEO')) throw new NotFoundException();
    await this.ownedCourse(user, lesson.courseId, { editable: true });
    if (lesson.kind === 'VIDEO' && (atSec === null || bankQuestionIds.length !== 1)) {
      throw new BadRequestException('Add one question at a time to a video, with a time');
    }
    const rows = await this.prisma.bankQuestion.findMany({
      where: { id: { in: bankQuestionIds }, courseId: lesson.courseId },
    });
    if (rows.length !== new Set(bankQuestionIds).size) throw new BadRequestException('Unknown bank question');

    const last = await this.prisma.quizQuestion.findFirst({
      where: { lessonId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    let position = last?.position ?? 0;
    const byId = new Map(rows.map((r) => [r.id, r]));
    await this.prisma.$transaction(
      bankQuestionIds.map((id) => {
        const row = byId.get(id)!;
        const options = row.options as StoredOption[];
        return this.prisma.quizQuestion.create({
          data: {
            lessonId,
            position: ++position,
            atSec: lesson.kind === 'VIDEO' ? atSec : null,
            bankQuestionId: row.id,
            topicId: row.topicId,
            text: row.text,
            explanation: row.explanation,
            allowMultiple: options.filter((o) => o.isCorrect).length > 1,
            options: { create: options.map((o, i) => ({ position: i + 1, text: o.text, isCorrect: o.isCorrect })) },
          },
        });
      }),
    );
    return this.assessments.questions(user, lessonId);
  }

  // ---- Entrance test settings -------------------------------------------------------

  async getEntrance(user: AuthUser, courseId: string): Promise<EntranceSettings & { poolSize: number }> {
    const course = await this.ownedCourse(user, courseId);
    return { ...this.entranceOf(course), poolSize: await this.poolSize(courseId, course.entranceTopicId) };
  }

  async setEntrance(user: AuthUser, courseId: string, body: unknown): Promise<EntranceSettings & { poolSize: number }> {
    await this.ownedCourse(user, courseId, { editable: true });
    const settings = zodOrThrow(EntranceSettingsSchema, body);
    await this.assertTopic(courseId, settings.topicId);
    const pool = await this.poolSize(courseId, settings.topicId);
    if (settings.enabled && pool === 0) {
      throw new ConflictException({ code: 'EMPTY_POOL', message: 'Add bank questions (for this topic) first' });
    }
    const course = await this.prisma.course.update({
      where: { id: courseId },
      data: {
        entranceTestEnabled: settings.enabled,
        entranceQuestionCount: settings.questionCount,
        entrancePassPercent: settings.passPercent,
        entranceMaxAttempts: settings.maxAttempts,
        entranceTopicId: settings.topicId,
      },
    });
    await this.audit.log({ actorId: user.userId, action: 'course.entrance_updated', resource: 'course', resourceId: courseId });
    return { ...this.entranceOf(course), poolSize: pool };
  }

  // ---- Certificate design ---------------------------------------------------------------

  async getTemplate(user: AuthUser, courseId: string): Promise<CertificateTemplate> {
    await this.ownedCourse(user, courseId);
    return this.templateFor(courseId);
  }

  async setTemplate(user: AuthUser, courseId: string, body: unknown): Promise<CertificateTemplate> {
    await this.ownedCourse(user, courseId);
    const template = zodOrThrow(CertificateTemplateSchema, body);
    const images = [template.logoAssetId, ...template.signatories.map((s) => s.signatureAssetId)].filter(
      (id): id is string => !!id,
    );
    if (images.length) {
      const ok = await this.prisma.mediaAsset.count({
        where: { id: { in: images }, kind: 'IMAGE', status: 'READY', isPublic: true },
      });
      if (ok !== new Set(images).size) throw new BadRequestException('Logo and signatures must be uploaded images');
    }
    const data = { ...template, signatories: template.signatories as unknown as Prisma.InputJsonValue };
    await this.prisma.certificateTemplate.upsert({
      where: { courseId },
      create: { courseId, ...data },
      update: data,
    });
    await this.audit.log({ actorId: user.userId, action: 'certificate.template_updated', resource: 'course', resourceId: courseId });
    return this.templateFor(courseId);
  }

  async templateFor(courseId: string): Promise<CertificateTemplate> {
    const row = await this.prisma.certificateTemplate.findUnique({ where: { courseId } });
    if (!row) return DEFAULT_CERTIFICATE_TEMPLATE;
    return {
      heading: row.heading,
      preamble: row.preamble,
      body: row.body,
      issuerName: row.issuerName,
      issuerTagline: row.issuerTagline,
      logoAssetId: row.logoAssetId,
      accentColor: row.accentColor,
      signatories: (row.signatories as CertificateTemplate['signatories']) ?? [],
      footerNote: row.footerNote,
    };
  }

  // ---- Helpers ---------------------------------------------------------------------------

  private entranceOf(course: {
    entranceTestEnabled: boolean;
    entranceQuestionCount: number;
    entrancePassPercent: number;
    entranceMaxAttempts: number | null;
    entranceTopicId: string | null;
  }): EntranceSettings {
    return {
      enabled: course.entranceTestEnabled,
      questionCount: course.entranceQuestionCount,
      passPercent: course.entrancePassPercent,
      maxAttempts: course.entranceMaxAttempts,
      topicId: course.entranceTopicId,
    };
  }

  private poolSize(courseId: string, topicId: string | null) {
    return this.prisma.bankQuestion.count({ where: { courseId, ...(topicId ? { topicId } : {}) } });
  }

  private async topicList(courseId: string): Promise<QuestionTopic[]> {
    const rows = await this.prisma.questionTopic.findMany({
      where: { courseId },
      orderBy: { position: 'asc' },
      include: { _count: { select: { bankQuestions: true, quizQuestions: { where: { lesson: { deletedAt: null } } } } } },
    });
    return rows.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      position: t.position,
      bankCount: t._count.bankQuestions,
      lessonCount: t._count.quizQuestions,
    }));
  }

  /** Topic ids by lower-cased name, creating the ones that don't exist yet (import). */
  private async ensureTopics(courseId: string, names: string[]): Promise<Map<string, string>> {
    const existing = await this.prisma.questionTopic.findMany({ where: { courseId }, select: { id: true, name: true, position: true } });
    const byName = new Map(existing.map((t) => [t.name.toLowerCase(), t.id]));
    let position = Math.max(0, ...existing.map((t) => t.position));
    for (const name of names) {
      const key = name.toLowerCase();
      if (byName.has(key)) continue;
      const created = await this.prisma.questionTopic.create({ data: { courseId, name: name.slice(0, 80), position: ++position } });
      byName.set(key, created.id);
    }
    return byName;
  }

  private async assertTopic(courseId: string, topicId: string | null) {
    if (topicId && !(await this.prisma.questionTopic.count({ where: { id: topicId, courseId } }))) {
      throw new BadRequestException('Unknown topic');
    }
  }

  private async assertNameFree(courseId: string, name: string, exceptId?: string) {
    const clash = await this.prisma.questionTopic.findFirst({
      where: { courseId, name: { equals: name, mode: 'insensitive' }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    });
    if (clash) throw new ConflictException({ code: 'TOPIC_EXISTS', message: 'A topic with this name already exists' });
  }

  private async ownedTopic(user: AuthUser, topicId: string) {
    const topic = await this.prisma.questionTopic.findUnique({ where: { id: topicId } });
    if (!topic) throw new NotFoundException();
    await this.ownedCourse(user, topic.courseId, { editable: true });
    return topic;
  }

  private async ownedCourse(user: AuthUser, courseId: string, { editable = false } = {}) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException();
    if (!(await this.permissions.can(user, course, 'edit'))) throw new ForbiddenException();
    if (editable && course.status === 'IN_REVIEW') throw new ConflictException({ code: 'LOCKED' });
    return course;
  }

  private async ownedBankQuestion(user: AuthUser, questionId: string) {
    const row = await this.prisma.bankQuestion.findUnique({ where: { id: questionId } });
    if (!row) throw new NotFoundException();
    await this.ownedCourse(user, row.courseId, { editable: true });
    return row;
  }
}
