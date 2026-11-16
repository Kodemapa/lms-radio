'use client';

import { canEditCourse, ownsCourse, type CategoryNode, type InstructorCourse } from '@obgyn/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@obgyn/ui';
import { Lock, Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { StatusBadge } from '../status-badge';
import { BankTab } from './bank-tab';
import { CertificateTab } from './certificate-tab';
import { CurriculumTab } from './curriculum-tab';
import { EntranceTab } from './entrance-tab';
import { DetailsTab } from './details-tab';
import { PricingTab } from './pricing-tab';
import { PublishTab } from './publish-tab';
import { AnalyticsTab } from '../teaching/analytics-tab';
import { ReportsTab } from '../teaching/reports-tab';
import { StudentsTab } from '../teaching/students-tab';
import { TeamTab } from '../teaching/team-tab';
import { TrashTab } from '../teaching/trash-tab';

type BuildTab = 'details' | 'curriculum' | 'bank' | 'entrance' | 'pricing' | 'certDesign' | 'publish';
type TeachTab = 'students' | 'reports' | 'analytics' | 'team' | 'trash';
type Tab = BuildTab | TeachTab;
const BUILD_TABS: BuildTab[] = ['details', 'curriculum', 'bank', 'entrance', 'pricing', 'certDesign', 'publish'];
const TEACH_TABS: TeachTab[] = ['students', 'reports', 'analytics', 'team', 'trash'];
/** Owner-only build steps; the rest of the build tabs need edit rights. */
const OWNER_TABS = new Set<Tab>(['pricing', 'publish']);

/**
 * Course builder (Details → Curriculum → Pricing → Publish, like the previous
 * site) plus the course team's teaching tools. Tabs follow the viewer's role:
 * graders see only teaching tabs; editors see everything but pricing/publish.
 */
export function CourseEditor({ initial, categories, myUserId }: { initial: InstructorCourse; categories: CategoryNode[]; myUserId: string | null }) {
  const t = useTranslations('Instructor');
  const [course, setCourse] = useState(initial);
  const canEdit = canEditCourse(course.myRole);
  const isOwner = ownsCourse(course.myRole);
  const buildTabs = canEdit ? BUILD_TABS.filter((tab) => isOwner || !OWNER_TABS.has(tab)) : [];
  const teachTabs = TEACH_TABS.filter((tab) => tab !== 'trash' || canEdit);
  const [tab, setTab] = useState<Tab>(canEdit ? 'details' : 'students');
  const locked = course.status === 'IN_REVIEW' || course.status === 'RETIRED';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <StatusBadge status={course.status} label={t(`status.${course.status}`)} />
        <h1 className="text-2xl font-bold md:text-3xl">{course.title}</h1>
      </div>
      {locked ? (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
          <Lock aria-hidden className="size-4 shrink-0" />
          {t('editor.locked')}
        </p>
      ) : course.status === 'PUBLISHED' ? (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-primary-light p-3 text-sm text-primary">
          <Pencil aria-hidden className="size-4 shrink-0" />
          {t('editor.publishedNotice')}
        </p>
      ) : null}
      {course.reviewNote && course.status === 'DRAFT' ? (
        <p role="status" className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm">
          {t('editor.rejected', { note: course.reviewNote })}
        </p>
      ) : null}

      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
        <TabsList className="flex-wrap">
          {buildTabs.map((value, index) => (
            <TabsTrigger key={value} value={value}>
              <span className="me-2 inline-flex size-6 items-center justify-center rounded-full border border-current text-xs">
                {index + 1}
              </span>
              {t(`editor.tabs.${value}`)}
            </TabsTrigger>
          ))}
          {/* Teaching tools stay together when the row wraps. */}
          <span className="flex flex-wrap items-center">
            {buildTabs.length ? <span aria-hidden className="mx-1 h-6 w-px bg-border" /> : null}
            {teachTabs.map((value) => (
              <TabsTrigger key={value} value={value}>
                {t(`editor.tabs.${value}`)}
              </TabsTrigger>
            ))}
          </span>
        </TabsList>
        {!isOwner ? (
          <p className="mt-3 text-sm text-muted-foreground">{t('editor.yourRole', { role: t(`editor.roles.${course.myRole}`) })}</p>
        ) : null}
        <TabsContent value="details">
          <DetailsTab
            course={course}
            categories={categories}
            locked={locked}
            onSaved={(updated) => {
              setCourse(updated);
              setTab('curriculum');
            }}
          />
        </TabsContent>
        <TabsContent value="curriculum">
          <CurriculumTab course={course} locked={locked} onChange={setCourse} />
        </TabsContent>
        <TabsContent value="bank">
          <BankTab courseId={course.id} locked={locked} />
        </TabsContent>
        <TabsContent value="entrance">
          <EntranceTab courseId={course.id} locked={locked} />
        </TabsContent>
        <TabsContent value="certDesign">
          <CertificateTab courseId={course.id} courseTitle={course.title} enabled={course.certificateEnabled} />
        </TabsContent>
        <TabsContent value="pricing">
          <PricingTab course={course} locked={locked} onSaved={setCourse} />
        </TabsContent>
        <TabsContent value="publish">
          <PublishTab course={course} onChange={setCourse} />
        </TabsContent>
        <TabsContent value="students">
          <StudentsTab courseId={course.id} />
        </TabsContent>
        <TabsContent value="reports">
          <ReportsTab courseId={course.id} />
        </TabsContent>
        <TabsContent value="analytics">
          <AnalyticsTab courseId={course.id} />
        </TabsContent>
        <TabsContent value="team">
          <TeamTab courseId={course.id} myRole={course.myRole} myUserId={myUserId} />
        </TabsContent>
        <TabsContent value="trash">
          <TrashTab courseId={course.id} locked={locked} onChange={setCourse} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
