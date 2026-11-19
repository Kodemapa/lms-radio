import { Controller, Get, NotFoundException, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { type PublicInstructor } from '@obgyn/types';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const SELECT = {
  id: true,
  displayName: true,
  headline: true,
  bio: true,
  avatarAssetId: true,
  courses: {
    where: { status: 'PUBLISHED' },
    select: { _count: { select: { enrollments: true } } },
  },
} satisfies Prisma.UserSelect;

function toPublic(user: Prisma.UserGetPayload<{ select: typeof SELECT }>): PublicInstructor {
  return {
    id: user.id,
    displayName: user.displayName,
    headline: user.headline,
    bio: user.bio,
    avatarAssetId: user.avatarAssetId,
    courseCount: user.courses.length,
    studentCount: user.courses.reduce((sum, course) => sum + course._count.enrollments, 0),
  };
}

/** Instructors with at least one published course. */
@ApiTags('instructors')
@Controller('instructors')
export class InstructorsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(): Promise<PublicInstructor[]> {
    const users = await this.prisma.user.findMany({
      where: { courses: { some: { status: 'PUBLISHED' } } },
      select: SELECT,
      orderBy: { displayName: 'asc' },
    });
    return users.map(toPublic).sort((a, b) => b.studentCount - a.studentCount);
  }

  @Get(':id')
  async detail(@Param('id', new ParseUUIDPipe()) id: string): Promise<PublicInstructor> {
    const user = await this.prisma.user.findFirst({
      where: { id, courses: { some: { status: 'PUBLISHED' } } },
      select: SELECT,
    });
    if (!user) throw new NotFoundException();
    return toPublic(user);
  }
}
