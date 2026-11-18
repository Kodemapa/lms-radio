import { APP_NAME, type MailMessage } from './mail-message';

/**
 * Wording for every email the app sends. Messages carry no clinical content and
 * no free-text notes from staff: learners and instructors sign in to read
 * feedback, so nothing sensitive sits in mailboxes. English only for now.
 */

const greet = (name?: string | null) => (name?.trim() ? `Hello ${name.trim()},` : 'Hello,');

export function otpEmail(
  to: string,
  code: string,
  purpose: 'AUTH' | 'PASSWORD_RESET' | 'PASSWORD_CHANGE',
  expiresAt: Date,
): MailMessage {
  const minutes = Math.max(1, Math.round((expiresAt.getTime() - Date.now()) / 60_000));
  const what = {
    AUTH: { subject: `Your ${APP_NAME} sign-in code`, line: `Use this code to sign in to ${APP_NAME}.` },
    PASSWORD_RESET: { subject: `Reset your ${APP_NAME} password`, line: `Use this code to reset your ${APP_NAME} password.` },
    PASSWORD_CHANGE: { subject: `Confirm your ${APP_NAME} password change`, line: 'Use this code to confirm your password change.' },
  }[purpose];
  return {
    to,
    subject: what.subject,
    lines: [
      greet(),
      what.line,
      `It expires in ${minutes} minute${minutes === 1 ? '' : 's'}. Never share it with anyone, including our staff.`,
      "If you didn't ask for this code, you can ignore this email.",
    ],
    code,
  };
}

export function invitationEmail(to: string, name: string, inviter: string, courseTitle: string, role: 'EDITOR' | 'GRADER'): MailMessage {
  return {
    to,
    subject: `You're invited to teach "${courseTitle}"`,
    lines: [
      greet(name),
      `${inviter || 'A course owner'} has invited you to join "${courseTitle}" as ${role === 'EDITOR' ? 'an editor' : 'a grader'}.`,
      'Accept or decline the invitation from your instructor dashboard.',
    ],
    action: { label: 'Open instructor dashboard', href: '/en/instructor' },
  };
}

export function applicationDecisionEmail(to: string, name: string, approved: boolean): MailMessage {
  return approved
    ? {
        to,
        subject: `Your ${APP_NAME} instructor application was approved`,
        lines: [greet(name), 'Your application to teach was approved. You can now create courses from your instructor dashboard.'],
        action: { label: 'Open instructor dashboard', href: '/en/instructor' },
      }
    : {
        to,
        subject: `Your ${APP_NAME} instructor application`,
        lines: [greet(name), 'Your application to teach was not approved this time. Sign in to see the reviewer\'s note.'],
        action: { label: 'View application', href: '/en/become-instructor' },
      };
}

export function courseDecisionEmail(to: string, name: string, courseTitle: string, courseId: string, published: boolean): MailMessage {
  return published
    ? {
        to,
        subject: `"${courseTitle}" is now published`,
        lines: [greet(name), `Your course "${courseTitle}" passed review and is now live in the catalogue.`],
        action: { label: 'Open course', href: `/en/instructor/courses/${courseId}` },
      }
    : {
        to,
        subject: `"${courseTitle}" needs changes before publishing`,
        lines: [greet(name), `Your course "${courseTitle}" was returned to draft. Sign in to read the reviewer's note, make the changes and submit it again.`],
        action: { label: 'Open course', href: `/en/instructor/courses/${courseId}` },
      };
}

export function assignmentReviewedEmail(to: string, name: string, lessonTitle: string, approved: boolean, lessonHref: string): MailMessage {
  return {
    to,
    subject: approved ? `Your assignment "${lessonTitle}" was approved` : `Your assignment "${lessonTitle}" needs changes`,
    lines: [
      greet(name),
      approved
        ? `Your submission for "${lessonTitle}" was approved.`
        : `Your submission for "${lessonTitle}" was returned. Read the feedback and submit it again.`,
    ],
    action: { label: 'Open assignment', href: lessonHref },
  };
}

export function workingReviewedEmail(to: string, name: string, lessonTitle: string, verified: boolean, lessonHref: string): MailMessage {
  return {
    to,
    subject: verified ? `Your working on "${lessonTitle}" was verified` : `Your working on "${lessonTitle}" was returned`,
    lines: [
      greet(name),
      verified
        ? `Faculty checked and verified your working for "${lessonTitle}".`
        : `Faculty returned your working for "${lessonTitle}". Read their feedback in the case.`,
    ],
    action: { label: 'Open case', href: lessonHref },
  };
}

export function instructorAccountEmail(to: string, name: string): MailMessage {
  return {
    to,
    subject: `Your ${APP_NAME} instructor account`,
    lines: [
      greet(name),
      `An administrator created an instructor account for you on ${APP_NAME}.`,
      'They will give you your temporary password separately. Sign in and change it straight away.',
    ],
    action: { label: 'Sign in', href: '/en/login' },
  };
}

export function contactReceivedEmail(to: string, fromName: string, subject: string): MailMessage {
  return {
    to,
    subject: `New contact message: ${subject}`,
    lines: [greet(), `${fromName} sent a message through the contact form: "${subject}".`, 'Read and reply from the admin inbox.'],
    action: { label: 'Open inbox', href: '/en/admin/messages' },
  };
}
