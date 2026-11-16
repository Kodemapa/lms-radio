'use client';

import { type CategoryNode, type InstructorCourse } from '@obgyn/types';
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

type Tab = 'details' | 'curriculum' | 'bank' | 'entrance' | 'pricing' | 'certDesign' | 'publish';
const TABS: Tab[] = ['details', 'curriculum', 'bank', 'entrance', 'pricing', 'certDesign', 'publish'];

/** Course builder: Details → Curriculum → Pricing → Publish, like the previous site. */
export function CourseEditor({ initial, categories }: { initial: InstructorCourse; categories: CategoryNode[] }) {
  const t = useTranslations('Instructor');
  const [course, setCourse] = useState(initial);
  const [tab, setTab] = useState<Tab>('details');
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
        <TabsList>
          {TABS.map((value, index) => (
            <TabsTrigger key={value} value={value}>
              <span className="me-2 inline-flex size-6 items-center justify-center rounded-full border border-current text-xs">
                {index + 1}
              </span>
              {t(`editor.tabs.${value}`)}
            </TabsTrigger>
          ))}
        </TabsList>
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
      </Tabs>
    </div>
  );
}
