import { z } from 'zod';

/**
 * Instructor tools: co-instructors, students, assessment reports, analytics,
 * review replies and curriculum trash.
 */

// ---- Course roles & co-instructors -----------------------------------------------

export const CourseRoleSchema = z.enum(['ADMIN', 'OWNER', 'EDITOR', 'GRADER']);
export type CourseRole = z.infer<typeof CourseRoleSchema>;

export const CollaboratorRoleSchema = z.enum(['EDITOR', 'GRADER']);
export type CollaboratorRole = z.infer<typeof CollaboratorRoleSchema>;

/** What each course role may do (mirrors the API's CoursePermissions). */
export const COURSE_ROLE_CAN = {
  edit: ['ADMIN', 'OWNER', 'EDITOR'],
  own: ['ADMIN', 'OWNER'],
} as const satisfies Record<string, readonly CourseRole[]>;

export const canEditCourse = (role: CourseRole) => (COURSE_ROLE_CAN.edit as readonly CourseRole[]).includes(role);
export const ownsCourse = (role: CourseRole) => (COURSE_ROLE_CAN.own as readonly CourseRole[]).includes(role);

export const CollaboratorSchema = z.object({
  id: z.string().uuid(),
  user: z.object({ id: z.string().uuid(), displayName: z.string(), email: z.string().nullable() }),
  role: CollaboratorRoleSchema,
  status: z.enum(['PENDING', 'ACCEPTED']),
  createdAt: z.string().datetime(),
});
export type Collaborator = z.infer<typeof CollaboratorSchema>;

export const InviteCollaboratorSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  role: CollaboratorRoleSchema,
});
export type InviteCollaborator = z.infer<typeof InviteCollaboratorSchema>;

export const CollaboratorUpdateSchema = z.object({ role: CollaboratorRoleSchema });

/** An invitation addressed to me. */
export const CourseInvitationSchema = z.object({
  id: z.string().uuid(),
  course: z.object({ id: z.string().uuid(), title: z.string(), slug: z.string() }),
  role: CollaboratorRoleSchema,
  invitedBy: z.string(),
  createdAt: z.string().datetime(),
});
export type CourseInvitation = z.infer<typeof CourseInvitationSchema>;

// ---- Students --------------------------------------------------------------------

export const CourseStudentSchema = z.object({
  userId: z.string().uuid(),
  displayName: z.string(),
  /** Partly masked (DPDP data minimisation): "pa***@gmail.com". */
  email: z.string().nullable(),
  enrolledAt: z.string().datetime(),
  completedLessons: z.number().int(),
  totalLessons: z.number().int(),
  progressPercent: z.number().int(),
  lastActivityAt: z.string().datetime().nullable(),
  /** null when the course has no entrance test. */
  entrancePassed: z.boolean().nullable(),
  certificateSerial: z.string().nullable(),
});
export type CourseStudent = z.infer<typeof CourseStudentSchema>;

export const STUDENT_SORTS = ['recent', 'progress', 'name', 'activity'] as const;
export const StudentSortSchema = z.enum(STUDENT_SORTS);

export const CourseStudentsSchema = z.object({
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
  items: z.array(CourseStudentSchema),
});
export type CourseStudents = z.infer<typeof CourseStudentsSchema>;

/** "pavan@gmail.com" → "pa***@gmail.com" */
export function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [local, domain] = email.split('@');
  if (!local || !domain) return null;
  return `${local.slice(0, Math.min(2, local.length))}***@${domain}`;
}

// ---- Assessment reports ----------------------------------------------------------

export const AssessmentKindSchema = z.enum(['QUIZ', 'IMAGING', 'ENTRANCE']);
export type AssessmentKind = z.infer<typeof AssessmentKindSchema>;

export const AssessmentSummarySchema = z.object({
  /** Lesson id, or null for the course's entrance test. */
  lessonId: z.string().uuid().nullable(),
  kind: AssessmentKindSchema,
  title: z.string(),
  passPercent: z.number().int(),
  attempts: z.number().int(),
  learners: z.number().int(),
  passedLearners: z.number().int(),
  /** Mean of each learner's best score (0–100), null if no attempts. */
  averageBestScore: z.number().int().nullable(),
});
export type AssessmentSummary = z.infer<typeof AssessmentSummarySchema>;

export const LearnerAttemptsSchema = z.object({
  userId: z.string().uuid(),
  displayName: z.string(),
  attempts: z.number().int(),
  bestScore: z.number().int(),
  lastScore: z.number().int(),
  passed: z.boolean(),
  lastAttemptAt: z.string().datetime(),
  lastAttemptId: z.string().uuid(),
});
export type LearnerAttempts = z.infer<typeof LearnerAttemptsSchema>;

/** How a question / annotation performed across all learners' latest attempts. */
export const ItemAnalysisSchema = z.object({
  id: z.string(),
  label: z.string(),
  answered: z.number().int(),
  correctPercent: z.number().int(),
  /** Most common wrong answer or failure reason. */
  commonMistake: z.string().nullable(),
});
export type ItemAnalysis = z.infer<typeof ItemAnalysisSchema>;

export const AssessmentReportSchema = z.object({
  summary: AssessmentSummarySchema,
  learners: z.array(LearnerAttemptsSchema),
  items: z.array(ItemAnalysisSchema),
});
export type AssessmentReport = z.infer<typeof AssessmentReportSchema>;

export const AttemptDetailSchema = z.object({
  id: z.string().uuid(),
  kind: AssessmentKindSchema,
  title: z.string(),
  learner: z.object({ id: z.string().uuid(), displayName: z.string() }),
  createdAt: z.string().datetime(),
  scorePercent: z.number().int(),
  passed: z.boolean(),
  items: z.array(
    z.object({
      label: z.string(),
      correct: z.boolean(),
      /** Partial credit, 0–1 (imaging half marks, close answers). */
      credit: z.number(),
      answer: z.string().nullable(),
      expected: z.string(),
    }),
  ),
});
export type AttemptDetail = z.infer<typeof AttemptDetailSchema>;

// ---- Analytics & dashboard --------------------------------------------------------

export const DayCountSchema = z.object({ date: z.string(), count: z.number().int() });
export type DayCount = z.infer<typeof DayCountSchema>;

export const CourseAnalyticsSchema = z.object({
  enrolled: z.number().int(),
  /** Completed or progressed in at least one lesson. */
  started: z.number().int(),
  completedAll: z.number().int(),
  certificates: z.number().int(),
  activeLast7Days: z.number().int(),
  /** Last 30 days, oldest first, zero-filled. */
  enrolmentsByDay: z.array(DayCountSchema),
  lessons: z.array(
    z.object({
      lessonId: z.string().uuid(),
      chapterTitle: z.string(),
      title: z.string(),
      kind: z.string(),
      completed: z.number().int(),
      completionPercent: z.number().int(),
    }),
  ),
});
export type CourseAnalytics = z.infer<typeof CourseAnalyticsSchema>;

// ---- Reviews -----------------------------------------------------------------------

export const REVIEW_REPORT_REASONS = ['ABUSE', 'SPAM', 'OFF_TOPIC', 'PRIVACY', 'OTHER'] as const;
export const ReviewReportReasonSchema = z.enum(REVIEW_REPORT_REASONS);

export const InstructorReviewSchema = z.object({
  userId: z.string().uuid(),
  courseId: z.string().uuid(),
  courseTitle: z.string(),
  authorName: z.string(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().nullable(),
  createdAt: z.string().datetime(),
  reply: z.string().nullable(),
  repliedAt: z.string().datetime().nullable(),
  reportedAt: z.string().datetime().nullable(),
  reportReason: ReviewReportReasonSchema.nullable(),
  hidden: z.boolean(),
});
export type InstructorReview = z.infer<typeof InstructorReviewSchema>;

export const ReviewReplyInputSchema = z.object({ reply: z.string().trim().min(1).max(2000).nullable() });
export const ReviewReportInputSchema = z.object({ reason: ReviewReportReasonSchema });

// ---- Curriculum trash ------------------------------------------------------------

/** Trashed chapters and lessons are purged after this many days. */
export const TRASH_RETENTION_DAYS = 30;

export const TrashItemSchema = z.object({
  kind: z.enum(['CHAPTER', 'LESSON']),
  id: z.string().uuid(),
  title: z.string(),
  /** LESSON: its chapter's title. */
  chapterTitle: z.string().nullable(),
  /** CHAPTER: lessons inside it. */
  lessonCount: z.number().int(),
  deletedAt: z.string().datetime(),
  purgeAt: z.string().datetime(),
});
export type TrashItem = z.infer<typeof TrashItemSchema>;
