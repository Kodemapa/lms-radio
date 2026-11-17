import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { validateApplicationAnswers, type ApplicationField, type InstructorApplication } from '@obgyn/types';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { type AuthUser } from '../auth/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { type InstructorApplicationDto } from './dto';

export const APPLICATION_INCLUDE = {
  user: { select: { id: true, displayName: true, email: true, phone: true } },
} satisfies Prisma.InstructorApplicationInclude;

export function toApplication(
  row: Prisma.InstructorApplicationGetPayload<{ include: typeof APPLICATION_INCLUDE }>,
): InstructorApplication {
  return {
    id: row.id,
    headline: row.headline,
    bio: row.bio,
    qualifications: row.qualifications,
    experienceYears: row.experienceYears,
    registrationNumber: row.registrationNumber,
    answers: answersOf(row.answers),
    status: row.status,
    reviewNote: row.reviewNote,
    createdAt: row.createdAt.toISOString(),
    applicant: row.user,
  };
}

function answersOf(value: Prisma.JsonValue | null): Record<string, string | number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string | number] => typeof entry[1] === 'string' || typeof entry[1] === 'number',
    ),
  );
}

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async mine(user: AuthUser): Promise<InstructorApplication> {
    const row = await this.prisma.instructorApplication.findUnique({
      where: { userId: user.userId },
      include: APPLICATION_INCLUDE,
    });
    if (!row) throw new NotFoundException();
    return toApplication(row);
  }

  /** Create, or re-submit after a rejection. */
  async apply(user: AuthUser, dto: InstructorApplicationDto): Promise<InstructorApplication> {
    if (user.role !== 'LEARNER') throw new ConflictException({ code: 'ALREADY_INSTRUCTOR' });
    const existing = await this.prisma.instructorApplication.findUnique({ where: { userId: user.userId } });
    if (existing?.status === 'APPROVED') throw new ConflictException({ code: 'ALREADY_INSTRUCTOR' });

    const checked = validateApplicationAnswers(await this.activeFields(), dto.answers ?? {});
    if (Object.keys(checked.errors).length) {
      throw new BadRequestException({ code: 'INVALID_ANSWERS', fields: checked.errors });
    }

    const data = {
      headline: dto.headline.trim(),
      bio: dto.bio.trim(),
      qualifications: dto.qualifications.trim(),
      experienceYears: dto.experienceYears,
      registrationNumber: dto.registrationNumber?.trim() || null,
      answers: checked.answers,
      status: 'PENDING' as const,
      reviewNote: null,
      reviewedAt: null,
      reviewedById: null,
    };
    const row = await this.prisma.instructorApplication.upsert({
      where: { userId: user.userId },
      update: data,
      create: { ...data, userId: user.userId },
      include: APPLICATION_INCLUDE,
    });
    await this.audit.log({
      actorId: user.userId,
      action: 'instructor_application.submitted',
      resource: 'instructor_application',
      resourceId: row.id,
    });
    return toApplication(row);
  }

  /** The admin-defined extra questions shown on the form, in order. */
  activeFields(): Promise<ApplicationField[]> {
    return this.prisma.applicationField.findMany({
      where: { active: true },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: APPLICATION_FIELD_SELECT,
    });
  }
}

export const APPLICATION_FIELD_SELECT = {
  id: true,
  key: true,
  label: true,
  labelHi: true,
  helpText: true,
  type: true,
  options: true,
  required: true,
  active: true,
  position: true,
} satisfies Prisma.ApplicationFieldSelect;
