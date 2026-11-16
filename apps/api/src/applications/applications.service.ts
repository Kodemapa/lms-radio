import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { type InstructorApplication } from '@obgyn/types';
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
    status: row.status,
    reviewNote: row.reviewNote,
    createdAt: row.createdAt.toISOString(),
    applicant: row.user,
  };
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

    const data = {
      headline: dto.headline.trim(),
      bio: dto.bio.trim(),
      qualifications: dto.qualifications.trim(),
      experienceYears: dto.experienceYears,
      registrationNumber: dto.registrationNumber?.trim() || null,
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
}
