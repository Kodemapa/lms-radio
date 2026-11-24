import { ConflictException } from '@nestjs/common';
import { AuthoringService } from './authoring.service';
import { type LessonDto } from './dto';

const user = { userId: 'u1', sessionId: 's1', role: 'FACULTY' as const };
const base: LessonDto = {
  title: 'Lesson',
  description: null,
  kind: 'QUIZ',
  isPreview: false,
  mediaAssetId: null,
  skippable: false,
  passPercent: 60,
  instructions: null,
  points: null,
  submissionKinds: [],
};

function setup(currentKind: string, questionCount: number) {
  const prisma = {
    quizQuestion: {
      count: jest.fn().mockResolvedValue(questionCount),
      updateMany: jest.fn().mockReturnValue('updateMany'),
    },
    lesson: { update: jest.fn().mockReturnValue('update') },
    $transaction: jest.fn().mockResolvedValue([]),
  };
  const service = new AuthoringService(prisma as never, {} as never, {} as never, {} as never);
  const internals = service as unknown as Record<string, unknown>;
  internals.ownedLesson = jest.fn().mockResolvedValue({ id: 'l1', courseId: 'c1', kind: currentKind });
  internals.lessonMedia = jest.fn().mockResolvedValue(null);
  internals.log = jest.fn().mockResolvedValue(undefined);
  internals.getCourse = jest.fn().mockResolvedValue({ id: 'c1' });
  return { service, prisma };
}

describe('AuthoringService.updateLesson: changing the lesson type', () => {
  it("turns a video's in-video questions into quiz questions when it becomes a quiz", async () => {
    const { service, prisma } = setup('VIDEO', 3);
    await service.updateLesson(user, 'l1', { ...base, kind: 'QUIZ' });
    expect(prisma.quizQuestion.updateMany).toHaveBeenCalledWith({ where: { lessonId: 'l1' }, data: { atSec: null } });
    expect(prisma.$transaction).toHaveBeenCalledWith(['update', 'updateMany']);
  });

  it('refuses other type changes while the lesson has questions', async () => {
    for (const [from, to] of [['QUIZ', 'PDF'], ['VIDEO', 'ASSIGNMENT'], ['QUIZ', 'VIDEO']] as const) {
      const { service, prisma } = setup(from, 2);
      await expect(service.updateLesson(user, 'l1', { ...base, kind: to })).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    }
  });

  it('allows a type change when there are no questions, and edits that keep the type', async () => {
    const empty = setup('QUIZ', 0);
    await empty.service.updateLesson(user, 'l1', { ...base, kind: 'PDF' });
    expect(empty.prisma.$transaction).toHaveBeenCalledWith(['update']);

    const same = setup('QUIZ', 5);
    await same.service.updateLesson(user, 'l1', { ...base, kind: 'QUIZ', title: 'Renamed' });
    expect(same.prisma.quizQuestion.count).not.toHaveBeenCalled();
    expect(same.prisma.$transaction).toHaveBeenCalledWith(['update']);
  });
});
