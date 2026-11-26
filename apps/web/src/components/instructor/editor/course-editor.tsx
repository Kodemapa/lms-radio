'use client';

import { canEditCourse, ownsCourse, type CategoryNode, type InstructorCourse } from '@obgyn/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@obgyn/ui';
import { Lock, Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { StatusBadge } from '../status-badge';
import { DetailsTab } from './details-tab';

/**
 * Each tab's code loads when the tab is first opened, so the editor opens fast
 * (the curriculum, question bank and reports are large). Details is the usual
 * first tab, so it ships with the page.
 */
function TabLoading() {
  return (
    <div role="status" aria-busy="true" className="mt-6 flex flex-col gap-3">
      <div className="h-10 w-1/3 animate-pulse rounded-xl bg-muted" />
      <div className="h-32 animate-pulse rounded-2xl bg-muted" />
      <div className="h-32 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}
const CurriculumTab = dynamic(() => import('./curriculum-tab').then((m) => m.CurriculumTab), { loading: TabLoading });
const BankTab = dynamic(() => import('./bank-tab').then((m) => m.BankTab), { loading: TabLoading });
const EntranceTab = dynamic(() => import('./entrance-tab').then((m) => m.EntranceTab), { loading: TabLoading });
const CertificateTab = dynamic(() => import('./certificate-tab').then((m) => m.CertificateTab), { loading: TabLoading });
const PricingTab = dynamic(() => import('./pricing-tab').then((m) => m.PricingTab), { loading: TabLoading });
const PublishTab = dynamic(() => import('./publish-tab').then((m) => m.PublishTab), { loading: TabLoading });
const StudentsTab = dynamic(() => import('../teaching/students-tab').then((m) => m.StudentsTab), { loading: TabLoading });
const ReportsTab = dynamic(() => import('../teaching/reports-tab').then((m) => m.ReportsTab), { loading: TabLoading });
const AnalyticsTab = dynamic(() => import('../teaching/analytics-tab').then((m) => m.AnalyticsTab), { loading: TabLoading });
const TeamTab = dynamic(() => import('../teaching/team-tab').then((m) => m.TeamTab), { loading: TabLoading });
const TrashTab = dynamic(() => import('../teaching/trash-tab').then((m) => m.TrashTab), { loading: TabLoading });

type BuildTab =
  'details' | 'curriculum' | 'bank' | 'entrance' | 'pricing' | 'certDesign' | 'publish';
type TeachTab = 'students' | 'reports' | 'analytics' | 'team' | 'trash';
type Tab = BuildTab | TeachTab;
const BUILD_TABS: BuildTab[] = [
  'details',
  'curriculum',
  'bank',
  'entrance',
  'pricing',
  'certDesign',
  'publish',
];
const TEACH_TABS: TeachTab[] = ['students', 'reports', 'analytics', 'team', 'trash'];
/** Owner-only build steps; the rest of the build tabs need edit rights. */
const OWNER_TABS = new Set<Tab>(['pricing', 'publish']);

/**
 * Course builder (Details → Curriculum → Pricing → Publish, like the previous
 * site) plus the course team's teaching tools. Tabs follow the viewer's role:
 * graders see only teaching tabs; editors see everything but pricing/publish.
 */
export function CourseEditor({
  initial,
  categories,
  myUserId,
  initialTab,
}: {
  initial: InstructorCourse;
  categories: CategoryNode[];
  myUserId: string | null;
  /** From ?tab=, e.g. returning from a student's report. */
  initialTab?: string;
}) {
  const t = useTranslations('Instructor');
  const [course, setCourse] = useState(initial);
  const canEdit = canEditCourse(course.myRole);
  const isOwner = ownsCourse(course.myRole);
  const buildTabs = canEdit ? BUILD_TABS.filter((tab) => isOwner || !OWNER_TABS.has(tab)) : [];
  const teachTabs = TEACH_TABS.filter((tab) => tab !== 'trash' || canEdit);
  const allowed: Tab[] = [...buildTabs, ...teachTabs];
  const [tab, setTab] = useState<Tab>(
    initialTab && allowed.includes(initialTab as Tab)
      ? (initialTab as Tab)
      : canEdit
        ? 'details'
        : 'students',
  );
  // Keep the selected tab visible in the sideways-scrolling row on phones.
  const tabList = useRef<HTMLDivElement>(null);
  useEffect(() => {
    tabList.current?.querySelector('[data-state="active"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [tab]);
  const locked = course.status === 'IN_REVIEW' || course.status === 'RETIRED';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <StatusBadge status={course.status} label={t(`status.${course.status}`)} />
        <h1 className="text-2xl font-bold md:text-3xl">{course.title}</h1>
      </div>
      {locked ? (
        <p
          role="status"
          className="flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-100"
        >
          <Lock aria-hidden className="size-4 shrink-0" />
          {t('editor.locked')}
        </p>
      ) : course.status === 'PUBLISHED' ? (
        <p
          role="status"
          className="flex items-center gap-2 rounded-xl bg-primary-light p-3 text-sm text-primary"
        >
          <Pencil aria-hidden className="size-4 shrink-0" />
          {t('editor.publishedNotice')}
        </p>
      ) : null}

      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
        {/* Phones: one row that scrolls sideways (the active tab is kept in view);
            wider screens: the row wraps. */}
        <TabsList
          ref={tabList}
          className="snap-x [mask-image:linear-gradient(90deg,#000_85%,transparent)] lg:flex-wrap lg:[mask-image:none]"
        >
          {buildTabs.map((value, index) => (
            <TabsTrigger key={value} value={value} className="shrink-0 snap-start">
              <span className="me-2 inline-flex size-6 items-center justify-center rounded-full border border-current text-xs">
                {index + 1}
              </span>
              {t(`editor.tabs.${value}`)}
            </TabsTrigger>
          ))}
          {/* Teaching tools stay together when the row wraps. */}
          <span className="flex shrink-0 items-center lg:flex-wrap">
            {buildTabs.length ? <span aria-hidden className="mx-1 h-6 w-px bg-border" /> : null}
            {teachTabs.map((value) => (
              <TabsTrigger key={value} value={value} className="shrink-0 snap-start">
                {t(`editor.tabs.${value}`)}
              </TabsTrigger>
            ))}
          </span>
        </TabsList>
        {!isOwner ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {t('editor.yourRole', { role: t(`editor.roles.${course.myRole}`) })}
          </p>
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
          <CertificateTab course={course} locked={locked} onCourseChange={setCourse} />
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
