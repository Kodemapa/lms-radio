import { ConflictException, ForbiddenException } from '@nestjs/common';
import { type AuthUser } from '../auth/auth-user';
import { examData } from '../authoring/authoring.service';
import { fakeConfig } from '../test-utils';
import { ExamsService, SUBMIT_GRACE_MS } from './exams.service';
import { SignalHub } from './signal-hub';

const learner: AuthUser = { userId: '11111111-1111-4111-8111-111111111111', sessionId: 's1', role: 'LEARNER' };
const MIN = 60_000;

function examLesson(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lesson-1',
    kind: 'QUIZ',
    courseId: 'course-1',
    examMode: true,
    examOpensAt: null,
    examClosesAt: null,
    examDurationMin: 30,
    examProctored: true,
    examAiMonitoring: true,
    examMaxWarnings: 0,
    ...overrides,
  };
}

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sess-1',
    lessonId: 'lesson-1',
    userId: learner.userId,
    status: 'IN_PROGRESS',
    startedAt: new Date(),
    endsAt: new Date(Date.now() + 10 * MIN),
    submittedAt: null,
    terminatedReason: null,
    lastSeenAt: null,
    cameraOn: false,
    fullscreen: false,
    tabVisible: true,
    streamEpoch: null,
    quizAttemptId: null,
    ...overrides,
  };
}

function setup({ lesson = examLesson(), existing = null as unknown, canGrade = false, autoWarn = false, maxWarnings = 0 } = {}) {
  const prisma = {
    examSession: {
      findUnique: jest.fn().mockResolvedValue(existing),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve(session({ ...data, id: 'new-sess' }))),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve(session({ ...(existing as object), ...data }))),
      findMany: jest.fn().mockResolvedValue([]),
    },
    proctorEvent: {
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: `ev-${data.kind}`, sessionId: data.sessionId, kind: data.kind })),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      update: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    quizQuestion: { count: jest.fn().mockResolvedValue(5), groupBy: jest.fn().mockResolvedValue([]) },
    lesson: {
      findFirst: jest.fn().mockResolvedValue({ ...lesson, title: 'Exam', course: { id: 'course-1', title: 'C', instructorId: 'x' } }),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue({ examAutoWarn: autoWarn, examMaxWarnings: maxWarnings }),
    },
    enrollment: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    quizAttempt: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const access = { getAccessibleLesson: jest.fn().mockResolvedValue({ lesson, enrolled: true, manager: false }) };
  const permissions = { can: jest.fn().mockResolvedValue(canGrade) };
  const hub = new SignalHub();
  const storage = { putBuffer: jest.fn().mockResolvedValue(undefined), readBuffer: jest.fn() };
  const service = new ExamsService(
    prisma as never,
    access as never,
    permissions as never,
    fakeConfig(),
    { log: jest.fn() } as never,
    hub,
    storage as never,
  );
  return { service, prisma, hub, storage };
}

describe('ExamsService.start', () => {
  it('starts a sitting that ends after the exam duration', async () => {
    const { service, prisma } = setup();
    const before = Date.now();
    const exam = await service.start(learner, 'lesson-1');
    const { endsAt } = prisma.examSession.create.mock.calls[0][0].data;
    expect(endsAt.getTime() - before).toBeGreaterThanOrEqual(30 * MIN - 5);
    expect(endsAt.getTime() - before).toBeLessThan(30 * MIN + 1000);
    expect(prisma.proctorEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ kind: 'STARTED' }) }));
    expect(exam.proctored).toBe(true);
    expect(exam.iceServers.length).toBeGreaterThan(0);
  });

  it('refuses before it opens and after it closes', async () => {
    const early = setup({ lesson: examLesson({ examOpensAt: new Date(Date.now() + MIN) }) });
    await expect(early.service.start(learner, 'lesson-1')).rejects.toMatchObject({ response: { code: 'EXAM_NOT_OPEN' } });
    const late = setup({ lesson: examLesson({ examClosesAt: new Date(Date.now() - MIN) }) });
    await expect(late.service.start(learner, 'lesson-1')).rejects.toMatchObject({ response: { code: 'EXAM_CLOSED' } });
  });

  it('resumes a running sitting instead of restarting it (the deadline does not move)', async () => {
    const running = session();
    const { service, prisma } = setup({ existing: running });
    await service.start(learner, 'lesson-1');
    expect(prisma.examSession.create).not.toHaveBeenCalled();
    expect(prisma.proctorEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ kind: 'RESUMED' }) }));
  });

  it('allows only one sitting', async () => {
    const { service } = setup({ existing: session({ status: 'SUBMITTED', submittedAt: new Date() }) });
    await expect(service.start(learner, 'lesson-1')).rejects.toMatchObject({ response: { code: 'EXAM_FINISHED' } });
  });
});

describe('ExamsService submission rules', () => {
  it('needs a started sitting', async () => {
    const { service } = setup();
    await expect(service.assertCanSubmit(learner, examLesson() as never)).rejects.toMatchObject({ response: { code: 'EXAM_NOT_STARTED' } });
  });

  it('refuses a second submission and a late one', async () => {
    const done = setup({ existing: session({ submittedAt: new Date(), status: 'SUBMITTED' }) });
    await expect(done.service.assertCanSubmit(learner, examLesson() as never)).rejects.toMatchObject({ response: { code: 'EXAM_FINISHED' } });
    const late = setup({ existing: session({ endsAt: new Date(Date.now() - SUBMIT_GRACE_MS - 1000) }) });
    await expect(late.service.assertCanSubmit(learner, examLesson() as never)).rejects.toMatchObject({ response: { code: 'EXAM_TIME_UP' } });
  });

  it("accepts the answers of a sitting a proctor ended, and keeps it marked as ended", async () => {
    const ended = session({ status: 'TERMINATED', terminatedReason: 'Phone visible' });
    const { service, prisma } = setup({ existing: ended });
    const ok = await service.assertCanSubmit(learner, examLesson() as never);
    await service.markSubmitted(ok as never, 'attempt-1');
    expect(prisma.examSession.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'TERMINATED', quizAttemptId: 'attempt-1' }) }),
    );
  });

  it('hides questions until the sitting runs; staff always see them', async () => {
    const none = setup();
    expect(await none.service.questionsVisible(learner, examLesson() as never, false)).toBe(false);
    expect(await none.service.questionsVisible(learner, examLesson() as never, true)).toBe(true);
    const running = setup({ existing: session() });
    expect(await running.service.questionsVisible(learner, examLesson() as never, false)).toBe(true);
  });
});

describe('ExamsService live monitoring', () => {
  it('records an alert once per few seconds, and updates the live state', async () => {
    const { service, prisma } = setup({ existing: session() });
    await service.learnerEvent(learner, 'sess-1', { kind: 'TAB_HIDDEN' });
    expect(prisma.examSession.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tabVisible: false }) }));
    expect(prisma.proctorEvent.create).toHaveBeenCalledTimes(1);
    prisma.proctorEvent.findFirst.mockResolvedValue({ id: 'recent' });
    await service.learnerEvent(learner, 'sess-1', { kind: 'TAB_HIDDEN' });
    expect(prisma.proctorEvent.create).toHaveBeenCalledTimes(1);
  });

  it('records that a learner read a warning, once, and only for their own warnings', async () => {
    const { service, prisma } = setup({ existing: session() });
    prisma.proctorEvent.findFirst
      .mockResolvedValueOnce({ id: 'warn-1', kind: 'WARNING' }) // the warning exists on this sitting
      .mockResolvedValueOnce(null); // not acknowledged yet
    await service.learnerEvent(learner, 'sess-1', { kind: 'WARNING_ACKNOWLEDGED', warningId: 'warn-1' });
    expect(prisma.proctorEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ kind: 'WARNING_ACKNOWLEDGED', data: { warningId: 'warn-1' } }) }),
    );
    prisma.proctorEvent.findFirst.mockResolvedValueOnce({ id: 'warn-1' }).mockResolvedValueOnce({ id: 'ack-1' });
    await service.learnerEvent(learner, 'sess-1', { kind: 'WARNING_ACKNOWLEDGED', warningId: 'warn-1' });
    expect(prisma.proctorEvent.create).toHaveBeenCalledTimes(1);
    prisma.proctorEvent.findFirst.mockResolvedValueOnce(null);
    await expect(service.learnerEvent(learner, 'sess-1', { kind: 'WARNING_ACKNOWLEDGED', warningId: 'not-mine' })).rejects.toThrow();
  });

  it('marks warnings as read once acknowledged', async () => {
    const { service, prisma } = setup({ existing: session() });
    prisma.proctorEvent.findMany.mockResolvedValue([
      { id: 'w1', kind: 'WARNING', data: { message: 'Eyes on screen' }, createdAt: new Date() },
      { id: 'w2', kind: 'WARNING', data: { message: 'Stay in frame' }, createdAt: new Date() },
      { id: 'a1', kind: 'WARNING_ACKNOWLEDGED', data: { warningId: 'w1' }, createdAt: new Date() },
    ]);
    const exam = await service.playerExam(learner, examLesson() as never);
    expect(exam?.session?.warnings.map((w) => [w.message, w.acknowledged])).toEqual([
      ['Eyes on screen', true],
      ['Stay in frame', false],
    ]);
  });

  it("lets a learner see only their own sitting", async () => {
    const { service } = setup({ existing: session({ userId: 'someone-else' }) });
    await expect(service.heartbeat(learner, 'sess-1', { camera: true, fullscreen: true, visible: true, epoch: 'abcdefgh' })).rejects.toThrow();
  });

  it('only course staff with grading rights can proctor', async () => {
    const { service } = setup({ canGrade: false });
    await expect(service.dashboard(learner, 'lesson-1')).rejects.toBeInstanceOf(ForbiddenException);
    const staff = setup({ canGrade: true });
    await expect(staff.service.dashboard(learner, 'lesson-1')).resolves.toMatchObject({ sessions: [] });
  });

  it('a running sitting past its deadline becomes EXPIRED', async () => {
    const { service, prisma } = setup({ existing: session({ endsAt: new Date(Date.now() - SUBMIT_GRACE_MS - 5000) }) });
    const exam = await service.playerExam(learner, examLesson() as never);
    expect(prisma.examSession.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'EXPIRED' } }));
    expect(exam?.session?.status).toBe('EXPIRED');
  });

  it('warnings and ending need a running sitting', async () => {
    const { service } = setup({ existing: { ...session({ status: 'SUBMITTED' }), lesson: { course: { id: 'c', instructorId: 'x' } } }, canGrade: true });
    await expect(service.warn(learner, 'sess-1', 'Eyes on screen')).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('ExamsService AI alerts, warning limit and review', () => {
  const JPEG = 'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).toString('base64');

  it('stores an AI alert with its evidence snapshot', async () => {
    const { service, prisma, storage } = setup({ existing: session() });
    await service.learnerEvent(learner, 'sess-1', { kind: 'PROHIBITED_OBJECT', object: 'cell phone', snapshot: JPEG });
    expect(prisma.proctorEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ kind: 'PROHIBITED_OBJECT', data: { object: 'cell phone' } }) }),
    );
    expect(storage.putBuffer).toHaveBeenCalledWith('proctor/sess-1/ev-PROHIBITED_OBJECT.jpg', expect.any(Buffer), 'image/jpeg');
    expect(prisma.proctorEvent.update).toHaveBeenCalledWith({ where: { id: 'ev-PROHIBITED_OBJECT' }, data: { snapshotKey: 'proctor/sess-1/ev-PROHIBITED_OBJECT.jpg' } });
  });

  it('ignores a snapshot that is not a JPEG, and snapshots on ordinary alerts', async () => {
    const { service, storage } = setup({ existing: session() });
    await service.learnerEvent(learner, 'sess-1', { kind: 'NO_FACE', snapshot: 'data:image/jpeg;base64,' + Buffer.from('<svg>').toString('base64') });
    await service.learnerEvent(learner, 'sess-1', { kind: 'COPY_PASTE', snapshot: JPEG });
    expect(storage.putBuffer).not.toHaveBeenCalled();
  });

  it('turns a serious alert into a warning when automatic warnings are on (once a minute)', async () => {
    const off = setup({ existing: session() });
    await off.service.learnerEvent(learner, 'sess-1', { kind: 'MULTIPLE_FACES' });
    expect(off.prisma.proctorEvent.create).toHaveBeenCalledTimes(1);

    const on = setup({ existing: session(), autoWarn: true });
    await on.service.learnerEvent(learner, 'sess-1', { kind: 'MULTIPLE_FACES' });
    expect(on.prisma.proctorEvent.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ kind: 'WARNING', data: expect.objectContaining({ code: 'MULTIPLE_FACES', auto: true }) }) }),
    );
    // looking away is only noted, never a warning
    on.prisma.proctorEvent.create.mockClear();
    await on.service.learnerEvent(learner, 'sess-1', { kind: 'LOOKING_AWAY' });
    expect(on.prisma.proctorEvent.create).toHaveBeenCalledTimes(1);
  });

  it('ends the exam when the warning limit is reached', async () => {
    const { service, prisma } = setup({
      existing: { ...session(), lesson: { course: { id: 'c', instructorId: 'x' } } },
      canGrade: true,
      maxWarnings: 3,
    });
    prisma.proctorEvent.count.mockResolvedValue(2);
    await service.warn(learner, 'sess-1', 'Eyes on screen');
    expect(prisma.examSession.update).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'TERMINATED' }) }));
    prisma.proctorEvent.count.mockResolvedValue(3);
    await service.warn(learner, 'sess-1', 'Eyes on screen');
    expect(prisma.examSession.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'TERMINATED', terminatedReason: 'Warning limit reached (3 of 3)' } }),
    );
  });

  it('a dispute needs a note, and also dismisses the warning', async () => {
    const { service, prisma } = setup({ existing: session() });
    await expect(service.learnerEvent(learner, 'sess-1', { kind: 'WARNING_DISPUTED', warningId: 'warn-1' })).rejects.toThrow('note');
    prisma.proctorEvent.findFirst.mockResolvedValueOnce({ id: 'warn-1', kind: 'WARNING' }).mockResolvedValue(null);
    await service.learnerEvent(learner, 'sess-1', { kind: 'WARNING_DISPUTED', warningId: 'warn-1', note: 'My sister walked past' });
    const kinds = prisma.proctorEvent.create.mock.calls.map((call) => call[0].data.kind);
    expect(kinds).toEqual(['WARNING_ACKNOWLEDGED', 'WARNING_DISPUTED']);
  });

  it('reviews only finished sittings; flagging needs a note', async () => {
    const running = setup({ existing: { ...session(), lesson: { course: { id: 'c', instructorId: 'x' } } }, canGrade: true });
    await expect(running.service.review(learner, 'sess-1', { status: 'CLEARED' })).rejects.toBeInstanceOf(ConflictException);
    const done = setup({ existing: { ...session({ status: 'SUBMITTED' }), lesson: { course: { id: 'c', instructorId: 'x' } } }, canGrade: true });
    await expect(done.service.review(learner, 'sess-1', { status: 'FLAGGED' })).rejects.toThrow();
  });

  it('a learner sees their report only after the exam', async () => {
    const { service } = setup({ existing: session() });
    await expect(service.learnerReport(learner, 'sess-1')).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('ExamsService.myExams (dashboard)', () => {
  it('lists my exams with their state, live and running first', async () => {
    const { service, prisma } = setup();
    const course = { id: 'c0000000-0000-4000-8000-000000000001', slug: 'demo', title: 'Demo' };
    const lessonOf = (id: string, extra: Record<string, unknown> = {}) => ({ ...examLesson({ id, ...extra }), title: id, course });
    prisma.enrollment.findMany.mockResolvedValue([{ courseId: course.id }]);
    prisma.lesson.findMany.mockResolvedValue([
      lessonOf('upcoming', { examOpensAt: new Date(Date.now() + 60 * MIN) }),
      lessonOf('live', { examClosesAt: new Date(Date.now() + 60 * MIN) }),
      lessonOf('done'),
      lessonOf('missed', { examClosesAt: new Date(Date.now() - MIN) }),
      lessonOf('running'),
      lessonOf('empty'),
    ]);
    prisma.quizQuestion.groupBy.mockResolvedValue(
      ['upcoming', 'live', 'done', 'missed', 'running'].map((lessonId) => ({ lessonId, _count: { _all: 3 } })),
    );
    prisma.examSession.findMany.mockResolvedValue([
      session({ lessonId: 'done', status: 'SUBMITTED', submittedAt: new Date(), quizAttemptId: 'a1', reviewStatus: 'CLEARED' }),
      session({ lessonId: 'running' }),
    ]);
    prisma.quizAttempt.findMany.mockResolvedValue([{ id: 'a1', scorePercent: 80, passed: true }]);
    const { exams } = await service.myExams(learner);
    expect(exams.map((e) => [e.lessonId, e.state])).toEqual([
      ['running', 'IN_PROGRESS'],
      ['live', 'LIVE'],
      ['upcoming', 'UPCOMING'],
      ['done', 'FINISHED'],
      ['missed', 'MISSED'],
    ]);
    expect(exams.find((e) => e.lessonId === 'done')).toMatchObject({ scorePercent: 80, passed: true, review: 'CLEARED' });
  });

  it('is empty when I am not enrolled anywhere', async () => {
    const { service } = setup();
    await expect(service.myExams(learner)).resolves.toMatchObject({ exams: [] });
  });
});

describe('SignalHub', () => {
  it('passes one offer to the learner and its answer back to that proctor, once', () => {
    const hub = new SignalHub();
    hub.offer('s1', 'proctorA1', 'offer-sdp');
    expect(hub.pendingOffers('s1')).toEqual([{ peerId: 'proctorA1', sdp: 'offer-sdp' }]);
    expect(hub.answer('s1', 'proctorA1', 'answer-sdp')).toBe(true);
    expect(hub.pendingOffers('s1')).toEqual([]);
    expect(hub.takeAnswers('proctorB1', ['s1'])).toEqual([]);
    expect(hub.takeAnswers('proctorA1', ['s1'])).toEqual([{ sessionId: 's1', sdp: 'answer-sdp' }]);
    expect(hub.takeAnswers('proctorA1', ['s1'])).toEqual([]);
  });

  it('drops stale offers and closed exams', () => {
    const hub = new SignalHub();
    hub.offer('s1', 'proctorA1', 'x', 0);
    expect(hub.pendingOffers('s1', 3 * MIN)).toEqual([]);
    hub.offer('s2', 'proctorA1', 'y');
    hub.close('s2');
    expect(hub.answer('s2', 'proctorA1', 'z')).toBe(false);
  });
});

describe('examData (lesson exam settings)', () => {
  it('only quizzes can be exams', () => {
    expect(examData({ kind: 'PDF', exam: { opensAt: null, closesAt: null, durationMin: 30, proctored: true } })).toMatchObject({ examMode: false, examProctored: false });
    expect(examData({ kind: 'QUIZ', exam: { opensAt: null, closesAt: null, durationMin: 45, proctored: true } })).toMatchObject({
      examMode: true,
      examDurationMin: 45,
      examProctored: true,
    });
    expect(examData({ kind: 'QUIZ', exam: null })).toMatchObject({ examMode: false });
    expect(
      examData({ kind: 'QUIZ', exam: { opensAt: null, closesAt: null, durationMin: 45, proctored: false, aiMonitoring: true, autoWarn: true, maxWarnings: 3 } }),
    ).toMatchObject({ examAiMonitoring: false, examAutoWarn: true, examMaxWarnings: 3 });
  });

  it('refuses an exam that closes before it opens', () => {
    expect(() =>
      examData({ kind: 'QUIZ', exam: { opensAt: '2026-12-01T10:00:00.000Z', closesAt: '2026-12-01T09:00:00.000Z', durationMin: 30, proctored: false } }),
    ).toThrow('close after it opens');
  });
});
