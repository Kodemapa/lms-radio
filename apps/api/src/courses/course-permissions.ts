import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { type AuthUser } from '../auth/auth-user';
import { PrismaService } from '../prisma/prisma.service';

/** How someone relates to a course. */
export type CourseRole = 'ADMIN' | 'OWNER' | 'EDITOR' | 'GRADER';
/**
 * What they want to do:
 * - view: students, reports, analytics, drafts and media
 * - grade: review assignment submissions
 * - edit: curriculum, questions, cases, dictionary, trash
 * - own: co-instructors, pricing, submit/withdraw, delete
 */
export type CourseNeed = 'view' | 'grade' | 'edit' | 'own';

const ALLOWED: Record<CourseNeed, readonly CourseRole[]> = {
  view: ['ADMIN', 'OWNER', 'EDITOR', 'GRADER'],
  grade: ['ADMIN', 'OWNER', 'EDITOR', 'GRADER'],
  edit: ['ADMIN', 'OWNER', 'EDITOR'],
  own: ['ADMIN', 'OWNER'],
};

export function allows(role: CourseRole | null, need: CourseNeed): boolean {
  return role !== null && ALLOWED[need].includes(role);
}

/**
 * The single rule for who may manage a course: admins, its owner, and
 * co-instructors who accepted an invitation (editor or grader). Being faculty
 * on its own grants nothing on other people's courses.
 */
@Injectable()
export class CoursePermissions {
  constructor(private readonly prisma: PrismaService) {}

  async role(user: AuthUser, course: { id: string; instructorId: string | null }): Promise<CourseRole | null> {
    if (user.role === 'ADMIN') return 'ADMIN';
    if (course.instructorId === user.userId) return 'OWNER';
    if (user.role !== 'FACULTY') return null;
    const collaborator = await this.prisma.courseCollaborator.findUnique({
      where: { courseId_userId: { courseId: course.id, userId: user.userId } },
      select: { role: true, status: true },
    });
    return collaborator?.status === 'ACCEPTED' ? collaborator.role : null;
  }

  async can(user: AuthUser, course: { id: string; instructorId: string | null }, need: CourseNeed): Promise<boolean> {
    return allows(await this.role(user, course), need);
  }

  /** Loads the course and checks the need; 404 if it doesn't exist, 403 if not allowed. */
  async assert(user: AuthUser, courseId: string, need: CourseNeed) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, instructorId: true, status: true, title: true, slug: true },
    });
    if (!course) throw new NotFoundException();
    const role = await this.role(user, course);
    if (!allows(role, need)) throw new ForbiddenException();
    return { course, role: role! };
  }

  /**
   * Courses where the user has at least `need`, for lists and queues.
   * Returns null for admins (all courses).
   */
  async courseIds(user: AuthUser, need: CourseNeed): Promise<string[] | null> {
    if (user.role === 'ADMIN') return null;
    const [owned, shared] = await Promise.all([
      this.prisma.course.findMany({ where: { instructorId: user.userId }, select: { id: true } }),
      user.role === 'FACULTY'
        ? this.prisma.courseCollaborator.findMany({
            where: { userId: user.userId, status: 'ACCEPTED', role: { in: ALLOWED[need].filter((r): r is 'EDITOR' | 'GRADER' => r === 'EDITOR' || r === 'GRADER') } },
            select: { courseId: true },
          })
        : [],
    ]);
    return [...new Set([...owned.map((c) => c.id), ...shared.map((c) => c.courseId)])];
  }
}
