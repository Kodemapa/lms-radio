import { z } from 'zod';

/** What happened. The message text is built in the browser from the kind and `data`. */
export const NOTIFICATION_KINDS = [
  'COURSE_CHANGES_REQUESTED',
  'COURSE_PUBLISHED',
  'APPLICATION_APPROVED',
  'APPLICATION_REJECTED',
  'COLLABORATOR_INVITED',
  'ASSIGNMENT_REVIEWED',
  'WORKING_REVIEWED',
  'CONTACT_MESSAGE',
] as const;
export const NotificationKindSchema = z.enum(NOTIFICATION_KINDS);
export type NotificationKind = z.infer<typeof NotificationKindSchema>;

export const NotificationSchema = z.object({
  id: z.string().uuid(),
  kind: NotificationKindSchema,
  /** Values for the message: courseTitle, note, lessonTitle, outcome, … */
  data: z.record(z.string(), z.string()).catch({}),
  /** Path without locale, e.g. "/instructor/courses/<id>". */
  link: z.string().nullable(),
  readAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type AppNotification = z.infer<typeof NotificationSchema>;

export const NotificationListSchema = z.object({
  items: z.array(NotificationSchema),
  unreadCount: z.number().int().nonnegative(),
});
export type NotificationList = z.infer<typeof NotificationListSchema>;

/** How many notifications the bell shows. */
export const NOTIFICATION_LIST_LIMIT = 20;
