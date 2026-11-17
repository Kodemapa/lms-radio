'use client';

import { ADMIN_EXPORTS, EXPORTS_WITH_CONTACTS, type AdminExport } from '@obgyn/types';
import { Label, Select } from '@obgyn/ui';
import { Download } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';

const COURSE_SCOPED: readonly AdminExport[] = ['enrolments', 'quiz-attempts', 'imaging-attempts'];

/** One card per CSV export. Downloads go through the signed-in BFF proxy (GET). */
export function ExportPanel({ courses }: { courses: { id: string; title: string }[] }) {
  const t = useTranslations('Admin.exports');
  const id = useId();
  const [courseId, setCourseId] = useState('');
  const [contacts, setContacts] = useState(false);

  const href = (kind: AdminExport) => {
    const params = new URLSearchParams();
    if (courseId && COURSE_SCOPED.includes(kind)) params.set('courseId', courseId);
    if (contacts && EXPORTS_WITH_CONTACTS.includes(kind)) params.set('includeContacts', 'true');
    const query = params.toString();
    return `/api/proxy/admin/exports/${kind}${query ? `?${query}` : ''}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 rounded-2xl border border-border bg-card p-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-course`}>{t('course')}</Label>
          <Select id={`${id}-course`} value={courseId} onChange={(event) => setCourseId(event.target.value)}>
            <option value="">{t('allCourses')}</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>{course.title}</option>
            ))}
          </Select>
          <p className="text-xs text-muted-foreground">{t('courseHint')}</p>
        </div>
        <div className="flex items-start gap-2 pt-6">
          <input
            id={`${id}-contacts`}
            type="checkbox"
            className="mt-1 size-4"
            checked={contacts}
            onChange={(event) => setContacts(event.target.checked)}
            aria-describedby={`${id}-contacts-hint`}
          />
          <div>
            <Label htmlFor={`${id}-contacts`}>{t('includeContacts')}</Label>
            <p id={`${id}-contacts-hint`} className="text-xs text-muted-foreground">{t('contactsHint')}</p>
          </div>
        </div>
      </div>

      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {ADMIN_EXPORTS.map((kind) => (
          <li key={kind} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
            <div>
              <h2 className="font-semibold">{t(`kinds.${kind}.title`)}</h2>
              <p className="text-sm text-muted-foreground">{t(`kinds.${kind}.body`)}</p>
            </div>
            <a
              href={href(kind)}
              download
              className="mt-auto inline-flex w-fit items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
            >
              <Download aria-hidden className="size-4" />
              {t('download')}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
