import { z } from 'zod';

/**
 * Outgoing-email status for the admin settings page. Read-only: the server
 * settings live in environment secrets (SMTP_*), never in the database, and
 * the SMTP username and password are never returned.
 */
export const AdminMailStatusSchema = z.object({
  /** False when SMTP_HOST is unset: the app then sends no email at all. */
  enabled: z.boolean(),
  host: z.string().nullable(),
  port: z.number().int().nullable(),
  /** Implicit TLS (port 465). */
  secure: z.boolean().nullable(),
  /** Sender shown to recipients (MAIL_FROM). */
  from: z.string().nullable(),
  /** Public web address used for links in emails (APP_URL). */
  appUrl: z.string().nullable(),
  /** The signed-in admin's own address, offered as the default test recipient. */
  adminEmail: z.string().nullable(),
});
export type AdminMailStatus = z.infer<typeof AdminMailStatusSchema>;

export const AdminMailTestInputSchema = z.object({
  to: z.string().trim().email().max(254),
});
export type AdminMailTestInput = z.infer<typeof AdminMailTestInputSchema>;

export const AdminMailTestResultSchema = z.object({
  sent: z.boolean(),
  /**
   * Why it wasn't sent: `MAIL_DISABLED`, `UNDELIVERABLE` (placeholder or
   * invalid address) or `SMTP_ERROR` (with the server's message in `detail`).
   */
  error: z.enum(['MAIL_DISABLED', 'UNDELIVERABLE', 'SMTP_ERROR']).nullable(),
  detail: z.string().nullable(),
});
export type AdminMailTestResult = z.infer<typeof AdminMailTestResultSchema>;
