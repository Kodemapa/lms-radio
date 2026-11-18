import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CollaboratorUpdateSchema,
  InviteCollaboratorSchema,
  maskEmail,
  type Collaborator,
  type CourseInvitation,
} from '@obgyn/types';
import { AuditService } from '../audit/audit.service';
import { type AuthUser } from '../auth/auth-user';
import { zodOrThrow } from '../common/zod';
import { CoursePermissions } from '../courses/course-permissions';
import { MailService } from '../mail/mail.service';
import { invitationEmail } from '../mail/templates';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

/** At most this many co-instructors per course. */
export const MAX_COLLABORATORS = 20;

/**
 * Co-instructors: the course owner invites existing faculty as EDITOR (edits
 * and grades) or GRADER (grades, sees reports). Invitees accept or decline from
 * their instructor dashboard; owners can change roles or remove them, and
 * co-instructors can leave.
 */
@Injectable()
export class CollaboratorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: CoursePermissions,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(user: AuthUser, courseId: string): Promise<Collaborator[]> {
    await this.permissions.assert(user, courseId, 'view');
    const rows = await this.prisma.courseCollaborator.findMany({
      where: { courseId },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, displayName: true, email: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      user: { id: row.user.id, displayName: row.user.displayName, email: maskEmail(row.user.email) },
      role: row.role,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async invite(user: AuthUser, courseId: string, body: unknown): Promise<Collaborator[]> {
    const { course } = await this.permissions.assert(user, courseId, 'own');
    const { email, role } = zodOrThrow(InviteCollaboratorSchema, body);
    const invitee = await this.prisma.user.findUnique({ where: { email }, select: { id: true, role: true, email: true, displayName: true } });
    // Same answer whether or not the email exists, so the form can't be used to probe accounts.
    if (!invitee || invitee.role !== 'FACULTY') {
      throw new BadRequestException({ code: 'NOT_FACULTY', message: 'Only approved instructors can be invited. Ask them to apply as an instructor first.' });
    }
    if (invitee.id === course.instructorId) throw new BadRequestException({ code: 'IS_OWNER', message: 'That is the course owner' });
    const count = await this.prisma.courseCollaborator.count({ where: { courseId } });
    if (count >= MAX_COLLABORATORS) throw new ConflictException({ code: 'TOO_MANY', message: `At most ${MAX_COLLABORATORS} co-instructors` });
    const existing = await this.prisma.courseCollaborator.findUnique({ where: { courseId_userId: { courseId, userId: invitee.id } } });
    if (existing) throw new ConflictException({ code: 'ALREADY_INVITED', message: 'Already invited' });
    await this.prisma.courseCollaborator.create({ data: { courseId, userId: invitee.id, role, invitedById: user.userId } });
    const inviter = await this.prisma.user.findUnique({ where: { id: user.userId }, select: { displayName: true } });
    await this.notifications.notify({
      userId: invitee.id,
      kind: 'COLLABORATOR_INVITED',
      data: { courseTitle: course.title, inviter: inviter?.displayName ?? '', role },
      link: '/instructor',
    });
    if (invitee.email) {
      this.mail.sendInBackground([invitationEmail(invitee.email, invitee.displayName, inviter?.displayName ?? '', course.title, role)]);
    }
    await this.audit.log({ actorId: user.userId, action: 'course.collaborator_invited', resource: 'course', resourceId: courseId, metadata: { inviteeId: invitee.id, role } });
    return this.list(user, courseId);
  }

  async updateRole(user: AuthUser, courseId: string, collaboratorId: string, body: unknown): Promise<Collaborator[]> {
    await this.permissions.assert(user, courseId, 'own');
    const { role } = zodOrThrow(CollaboratorUpdateSchema, body);
    const row = await this.owned(courseId, collaboratorId);
    await this.prisma.courseCollaborator.update({ where: { id: row.id }, data: { role } });
    await this.audit.log({ actorId: user.userId, action: 'course.collaborator_role_changed', resource: 'course', resourceId: courseId, metadata: { userId: row.userId, role } });
    return this.list(user, courseId);
  }

  /** Owner removes a co-instructor, or a co-instructor leaves. */
  async remove(user: AuthUser, courseId: string, collaboratorId: string): Promise<void> {
    const row = await this.owned(courseId, collaboratorId);
    if (row.userId !== user.userId) await this.permissions.assert(user, courseId, 'own');
    await this.prisma.courseCollaborator.delete({ where: { id: row.id } });
    await this.audit.log({
      actorId: user.userId,
      action: row.userId === user.userId ? 'course.collaborator_left' : 'course.collaborator_removed',
      resource: 'course',
      resourceId: courseId,
      metadata: { userId: row.userId },
    });
  }

  async myInvitations(user: AuthUser): Promise<CourseInvitation[]> {
    const rows = await this.prisma.courseCollaborator.findMany({
      where: { userId: user.userId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      include: { course: { select: { id: true, title: true, slug: true } } },
    });
    const inviters = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.invitedById))] } },
      select: { id: true, displayName: true },
    });
    const nameOf = new Map(inviters.map((u) => [u.id, u.displayName]));
    return rows.map((row) => ({
      id: row.id,
      course: row.course,
      role: row.role,
      invitedBy: nameOf.get(row.invitedById) ?? '',
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async respond(user: AuthUser, invitationId: string, accept: boolean): Promise<void> {
    const row = await this.prisma.courseCollaborator.findUnique({ where: { id: invitationId } });
    if (!row || row.userId !== user.userId) throw new NotFoundException();
    if (row.status !== 'PENDING') throw new ConflictException({ code: 'ALREADY_ANSWERED' });
    if (user.role !== 'FACULTY') throw new ForbiddenException();
    if (accept) {
      await this.prisma.courseCollaborator.update({ where: { id: row.id }, data: { status: 'ACCEPTED', respondedAt: new Date() } });
    } else {
      await this.prisma.courseCollaborator.delete({ where: { id: row.id } });
    }
    await this.audit.log({
      actorId: user.userId,
      action: accept ? 'course.collaborator_accepted' : 'course.collaborator_declined',
      resource: 'course',
      resourceId: row.courseId,
    });
  }

  private async owned(courseId: string, collaboratorId: string) {
    const row = await this.prisma.courseCollaborator.findUnique({ where: { id: collaboratorId } });
    if (!row || row.courseId !== courseId) throw new NotFoundException();
    return row;
  }
}
