import { Injectable } from '@nestjs/common';
import { EXPORTS_WITH_CONTACTS, type AdminExport } from '@obgyn/types';
import { type Response } from 'express';
import { AuditService } from '../../audit/audit.service';
import { type AuthUser } from '../../auth/auth-user';
import { maskEmail, maskPhone, startCsv, streamCsvRows, type CsvValue } from '../../common/csv';
import { PrismaService } from '../../prisma/prisma.service';

const BATCH = 1000;
const day = (date: Date | null | undefined) => (date ? date.toISOString().slice(0, 10) : null);
const rupees = (paise: number) => (paise / 100).toFixed(2);
const afterId = (last: { id: string } | undefined) => (last ? { id: { gt: last.id } } : {});

export interface ExportOptions {
  /** Only rows for this course (enrolments and attempts). */
  courseId?: string;
  /** Unmasked emails and phone numbers. Audit-logged either way. */
  includeContacts: boolean;
}

/** Admin CSV downloads, streamed in batches. */
@Injectable()
export class AdminExportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async export(admin: AuthUser, kind: AdminExport, options: ExportOptions, res: Response): Promise<void> {
    const contacts = options.includeContacts && EXPORTS_WITH_CONTACTS.includes(kind);
    startCsv(res, `${kind}-${new Date().toISOString().slice(0, 10)}.csv`, HEADERS[kind]);
    const rows = await this.rows(kind, options.courseId, contacts, res);
    res.end();
    await this.audit.log({
      actorId: admin.userId,
      action: 'admin.export',
      resource: kind,
      resourceId: options.courseId ?? null,
      metadata: { kind, rows, includeContacts: contacts },
    });
  }

  private rows(kind: AdminExport, courseId: string | undefined, contacts: boolean, res: Response): Promise<number> {
    const email = (value: string | null) => (contacts ? value : maskEmail(value));
    const phone = (value: string | null) => (contacts ? value : maskPhone(value));
    const stream = <T>(fetch: (last: T | undefined) => Promise<T[]>, values: (row: T) => readonly CsvValue[]) =>
      streamCsvRows(res, fetch, values);

    switch (kind) {
      case 'courses':
        return stream(
          (last: { id: string } | undefined) =>
            this.prisma.course.findMany({
              where: afterId(last),
              orderBy: { id: 'asc' },
              take: BATCH,
              include: {
                category: { select: { name: true } },
                instructor: { select: { displayName: true } },
                _count: { select: { enrollments: true, certificates: true } },
              },
            }),
          (row) => [
            row.title, row.slug, row.status, row.category?.name, row.instructor?.displayName, row.language,
            row.level, rupees(row.pricePaise), row._count.enrollments, row._count.certificates,
            day(row.publishedAt), day(row.createdAt),
          ],
        );

      case 'enrolments': {
        // Composite primary key: offset paging in a stable order (fine at this scale).
        let offset = 0;
        return stream(
          async () => {
            const batch = await this.prisma.enrollment.findMany({
              where: courseId ? { courseId } : {},
              orderBy: [{ createdAt: 'asc' }, { userId: 'asc' }, { courseId: 'asc' }],
              skip: offset,
              take: BATCH,
              include: {
                user: { select: { displayName: true, email: true, phone: true, learnerType: true } },
                course: { select: { title: true, certificates: { select: { userId: true, issuedAt: true } } } },
              },
            });
            offset += batch.length;
            return batch;
          },
          (row) => [
            row.user.displayName, email(row.user.email), phone(row.user.phone), row.user.learnerType,
            row.course.title, day(row.createdAt),
            day(row.course.certificates.find((certificate) => certificate.userId === row.userId)?.issuedAt),
          ],
        );
      }

      case 'instructors':
        return stream(
          (last: { id: string } | undefined) =>
            this.prisma.user.findMany({
              where: { role: 'FACULTY', deletedAt: null, ...afterId(last) },
              orderBy: { id: 'asc' },
              take: BATCH,
              select: {
                id: true, displayName: true, email: true, phone: true, headline: true, blockedAt: true, createdAt: true,
                courses: { select: { status: true, _count: { select: { enrollments: true } } } },
              },
            }),
          (row) => [
            row.displayName, email(row.email), phone(row.phone), row.headline, row.courses.length,
            row.courses.filter((course) => course.status === 'PUBLISHED').length,
            row.courses.reduce((sum, course) => sum + course._count.enrollments, 0),
            row.blockedAt ? 'BLOCKED' : 'ACTIVE', day(row.createdAt),
          ],
        );

      case 'quiz-attempts':
        return stream(
          (last: { id: string } | undefined) =>
            this.prisma.quizAttempt.findMany({
              where: { ...(courseId ? { lesson: { courseId } } : {}), ...afterId(last) },
              orderBy: { id: 'asc' },
              take: BATCH,
              include: ATTEMPT_INCLUDE,
            }),
          (row) => [
            row.user.displayName, row.lesson.course.title, row.lesson.title, row.scorePercent,
            row.passed ? 'yes' : 'no', row.createdAt.toISOString(),
          ],
        );

      case 'imaging-attempts':
        return stream(
          (last: { id: string } | undefined) =>
            this.prisma.imagingAttempt.findMany({
              where: { ...(courseId ? { lesson: { courseId } } : {}), ...afterId(last) },
              orderBy: { id: 'asc' },
              take: BATCH,
              include: ATTEMPT_INCLUDE,
            }),
          (row) => [
            row.user.displayName, row.lesson.course.title, row.lesson.title, row.scorePercent,
            row.passed ? 'yes' : 'no', row.createdAt.toISOString(), row.workingStatus,
          ],
        );
    }
  }
}

const ATTEMPT_INCLUDE = {
  user: { select: { displayName: true } },
  lesson: { select: { title: true, course: { select: { title: true } } } },
} as const;

const ATTEMPT_HEADER = ['Learner', 'Course', 'Lesson', 'Score %', 'Passed', 'Submitted (UTC)'];

const HEADERS: Record<AdminExport, string[]> = {
  courses: ['Title', 'Slug', 'Status', 'Category', 'Instructor', 'Language', 'Level', 'Price (INR)', 'Enrollments', 'Certificates', 'Published', 'Created'],
  enrolments: ['Learner', 'Email', 'Phone', 'Learner type', 'Course', 'Enrolled', 'Certificate issued'],
  instructors: ['Name', 'Email', 'Phone', 'Headline', 'Courses', 'Published courses', 'Students', 'Status', 'Joined'],
  'quiz-attempts': ATTEMPT_HEADER,
  'imaging-attempts': [...ATTEMPT_HEADER, 'Working'],
};
