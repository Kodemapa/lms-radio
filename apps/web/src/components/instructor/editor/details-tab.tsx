'use client';

import {
  COURSE_LANGUAGES,
  COURSE_LEVELS,
  type CategoryNode,
  type CourseLevel,
  type InstructorCourse,
} from '@obgyn/types';
import { Button, Input, Label, Select, Switch, Textarea, toast } from '@obgyn/ui';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { courseApi } from '@/lib/instructor-api';
import { CourseThumbnail } from '../../course/course-thumbnail';
import { FileUpload } from './file-upload';
import { ListEditor, TagInput } from './list-editor';

function flatten(nodes: CategoryNode[], depth = 0): { id: string; label: string }[] {
  return nodes.flatMap((node) => [
    { id: node.id, label: `${'  '.repeat(depth * 2)}${node.name}` },
    ...flatten(node.children, depth + 1),
  ]);
}

export function DetailsTab({
  course,
  categories,
  locked,
  onSaved,
}: {
  course: InstructorCourse;
  categories: CategoryNode[];
  locked: boolean;
  onSaved: (course: InstructorCourse) => void;
}) {
  const t = useTranslations('Instructor.editor');
  const tCommon = useTranslations('Common');
  const [form, setForm] = useState({
    title: course.title,
    shortDescription: course.shortDescription,
    description: course.description,
    categoryId: course.categoryId ?? '',
    level: course.level,
    language: course.language,
    tags: course.tags,
    learnings: course.learnings,
    requirements: course.requirements,
    sequentialAccess: course.sequentialAccess,
    thumbnailAssetId: course.thumbnailAssetId,
    previewAssetId: course.previewAssetId,
    metaTitle: course.metaTitle ?? '',
    metaDescription: course.metaDescription ?? '',
    metaKeywords: course.metaKeywords ?? '',
  });
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setStatus('idle');
  };

  async function save(event: FormEvent) {
    event.preventDefault();
    setStatus('saving');
    setError(null);
    try {
      const updated = await courseApi('PATCH', `courses/${course.id}/details`, {
        ...form,
        categoryId: form.categoryId || null,
        metaTitle: form.metaTitle.trim() || null,
        metaDescription: form.metaDescription.trim() || null,
        metaKeywords: form.metaKeywords.trim() || null,
      });
      setStatus('saved');
      toast.success(tCommon('toast.saved'));
      onSaved(updated);
    } catch (e) {
      setStatus('error');
      toast.error(tCommon('genericError'));
      setError((e as { messageText?: string }).messageText ?? tCommon('genericError'));
    }
  }

  return (
    <form onSubmit={save} noValidate>
      <fieldset disabled={locked} className="flex flex-col gap-6">
        <div className="grid gap-6 surface p-5 md:p-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="title">{t('title')}</Label>
            <Input id="title" value={form.title} maxLength={120} onChange={(e) => set('title', e.target.value)} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="short">{t('shortDescription')}</Label>
            <Textarea
              id="short"
              rows={2}
              maxLength={300}
              value={form.shortDescription}
              onChange={(e) => set('shortDescription', e.target.value)}
              aria-describedby="short-hint"
            />
            <p id="short-hint" className="text-xs text-muted-foreground">
              {t('shortDescriptionHint')} ({form.shortDescription.length}/300)
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="category">{t('category')}</Label>
              <Select id="category" value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
                <option value="">{t('selectCategory')}</option>
                {flatten(categories).map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="level">{t('level')}</Label>
              <Select id="level" value={form.level} onChange={(e) => set('level', e.target.value as CourseLevel)}>
                {COURSE_LEVELS.map((level) => (
                  <option key={level} value={level}>{tCommon(`level.${level}`)}</option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="language">{t('language')}</Label>
              <Select id="language" value={form.language} onChange={(e) => set('language', e.target.value)}>
                {COURSE_LANGUAGES.map((code) => (
                  <option key={code} value={code}>{tCommon(`languages.${code}`)}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="description">{t('description')}</Label>
            <Textarea
              id="description"
              rows={8}
              maxLength={20000}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </div>
          <TagInput
            id="tags"
            label={t('tags')}
            hint={t('tagsHint')}
            tags={form.tags}
            onChange={(tags) => set('tags', tags)}
            removeLabel={tCommon('remove')}
          />
        </div>

        <div className="grid gap-6 surface p-5 md:grid-cols-2 md:p-6">
          <ListEditor
            id="learnings"
            label={t('learnings')}
            items={form.learnings}
            onChange={(items) => set('learnings', items)}
            placeholder={t('pointPlaceholder')}
            addLabel={t('addPoint')}
            removeLabel={tCommon('remove')}
          />
          <ListEditor
            id="requirements"
            label={t('requirements')}
            items={form.requirements}
            onChange={(items) => set('requirements', items)}
            placeholder={t('pointPlaceholder')}
            addLabel={t('addPoint')}
            removeLabel={tCommon('remove')}
          />
        </div>

        <div className="grid gap-6 surface p-5 md:grid-cols-2 md:p-6">
          <div className="flex flex-col gap-3">
            {form.thumbnailAssetId ? (
              <CourseThumbnail
                assetId={form.thumbnailAssetId}
                title={form.title}
                seed={course.slug}
                className="max-w-xs"
              />
            ) : null}
            <FileUpload
              kind="IMAGE"
              label={t('thumbnail')}
              hint={t('thumbnailHint')}
              currentName={form.thumbnailAssetId ? t('fileReady') : null}
              disabled={locked}
              onUploaded={({ assetId }) => set('thumbnailAssetId', assetId)}
            />
          </div>
          <FileUpload
            kind="VIDEO"
            label={t('previewVideo')}
            hint={t('previewVideoHint')}
            currentName={form.previewAssetId ? t('fileReady') : null}
            disabled={locked}
            onUploaded={({ assetId }) => set('previewAssetId', assetId)}
          />
          <div className="flex items-start justify-between gap-4 md:col-span-2">
            <div>
              <Label htmlFor="sequential">{t('sequentialAccess')}</Label>
              <p id="sequential-hint" className="text-sm text-muted-foreground">{t('sequentialAccessHint')}</p>
            </div>
            <Switch
              id="sequential"
              checked={form.sequentialAccess}
              onCheckedChange={(checked) => set('sequentialAccess', checked)}
              aria-describedby="sequential-hint"
            />
          </div>
        </div>

        <details className="surface p-5 md:p-6">
          <summary className="cursor-pointer font-medium">{t('seo')}</summary>
          <div className="mt-4 grid gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="metaTitle">{t('metaTitle')}</Label>
              <Input id="metaTitle" maxLength={70} value={form.metaTitle} onChange={(e) => set('metaTitle', e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="metaDescription">{t('metaDescription')}</Label>
              <Textarea id="metaDescription" rows={2} maxLength={160} value={form.metaDescription} onChange={(e) => set('metaDescription', e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="metaKeywords">{t('metaKeywords')}</Label>
              <Input id="metaKeywords" maxLength={200} value={form.metaKeywords} onChange={(e) => set('metaKeywords', e.target.value)} />
            </div>
          </div>
        </details>

        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" size="lg" disabled={status === 'saving'}>
            {status === 'saving' ? tCommon('saving') : t('saveDetails')}
          </Button>
          <span aria-live="polite" className="text-sm">
            {status === 'saved' ? <span className="text-success">{tCommon('saved')}</span> : null}
            {status === 'error' ? <span role="alert" className="text-destructive">{error}</span> : null}
          </span>
        </div>
      </fieldset>
    </form>
  );
}
