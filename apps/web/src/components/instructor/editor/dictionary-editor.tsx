'use client';

import {
  ANNOTATION_TOOLS,
  AnnotationDictionarySchema,
  normalizeLabel,
  STANDARD_BIOMETRY_TERMS,
  type AnnotationTerm,
  type AnnotationTool,
} from '@obgyn/types';
import { Button, Input, toast } from '@obgyn/ui';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/instructor-api';
import { useConfirmDelete } from '../confirm-dialog';

/**
 * Common fetal-imaging landmark abbreviations, offered as an editable starting
 * point. Vocabulary only (no clinical values); faculty adjust it to how they teach.
 */
const STARTER_LANDMARKS: AnnotationTerm[] = (
  [
    ['CSP', 'Cavum septi pellucidi', ['POINT', 'BOX']],
    ['TH', 'Thalami', ['POINT', 'POLYGON']],
    ['FALX', 'Falx cerebri', ['POINT']],
    ['CP', 'Choroid plexus', ['POINT', 'POLYGON']],
    ['LVA', 'Lateral ventricle atrium', ['LENGTH']],
    ['CBL', 'Cerebellum', ['POLYGON', 'BOX']],
    ['VERMIS', 'Cerebellar vermis', ['POINT']],
    ['NB', 'Nasal bone', ['POINT']],
    ['IT', 'Intracranial translucency', ['POINT']],
    ['RA', 'Right atrium', ['POINT']],
    ['LA', 'Left atrium', ['POINT']],
    ['RV', 'Right ventricle', ['POINT']],
    ['LV', 'Left ventricle', ['POINT']],
    ['AO', 'Aorta', ['POINT', 'POLYGON']],
    ['PA', 'Pulmonary artery', ['POINT', 'POLYGON']],
    ['SVC', 'Superior vena cava', ['POINT']],
    ['TR', 'Trachea', ['POINT']],
    ['ST', 'Stomach', ['POINT', 'BOX', 'POLYGON']],
    ['KID', 'Kidney', ['POLYGON', 'BOX']],
    ['BL', 'Bladder', ['POINT', 'BOX']],
    ['SP', 'Spine', ['POINT']],
    ['PL', 'Placenta', ['POLYGON']],
    ['CI', 'Cord insertion', ['POINT']],
  ] as const
).map(([abbr, name, tools]) => ({ abbr, name, description: null, loinc: null, tools: [...tools] as AnnotationTool[] }));

const EMPTY: AnnotationTerm = { abbr: '', name: '', description: null, loinc: null, tools: [] };

/** Merge terms in, keeping existing entries when abbreviations clash. */
function merge(current: AnnotationTerm[], add: AnnotationTerm[]): AnnotationTerm[] {
  const have = new Set(current.map((t) => normalizeLabel(t.abbr)));
  return [...current, ...add.filter((t) => !have.has(normalizeLabel(t.abbr)))];
}

/**
 * The course's annotation shorthand dictionary. Learners see it in every
 * imaging case and should label their drawings with these abbreviations; only
 * dictionary abbreviations can match an answer key.
 */
export function DictionaryEditor({
  courseId,
  locked,
  onSaved,
}: {
  courseId: string;
  locked: boolean;
  onSaved?: (terms: AnnotationTerm[]) => void;
}) {
  const t = useTranslations('Imaging');
  const tCommon = useTranslations('Common');
  const { confirmDelete, dialog: deleteDialog } = useConfirmDelete();
  const [terms, setTerms] = useState<AnnotationTerm[] | null>(null);
  const [status, setStatus] = useState<{ kind: 'saving' | 'saved' } | { kind: 'error'; message: string } | null>(null);

  useEffect(() => {
    api<AnnotationTerm[]>('GET', `instructor/courses/${courseId}/annotation-terms`)
      .then((loaded) => {
        setTerms(loaded);
        onSaved?.(loaded);
      })
      .catch(() => setStatus({ kind: 'error', message: t('loadFailed') }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  if (!terms) return <p className="text-sm text-muted-foreground">{t('loadingImage')}</p>;

  const set = (index: number, patch: Partial<AnnotationTerm>) => setTerms((current) => current!.map((term, i) => (i === index ? { ...term, ...patch } : term)));

  const save = async () => {
    const cleaned = terms.filter((term) => term.abbr.trim() || term.name.trim());
    const parsed = AnnotationDictionarySchema.safeParse(cleaned);
    if (!parsed.success) return setStatus({ kind: 'error', message: parsed.error.issues.slice(0, 3).map((i) => i.message).join(' · ') });
    setStatus({ kind: 'saving' });
    try {
      const saved = await api<AnnotationTerm[]>('PUT', `instructor/courses/${courseId}/annotation-terms`, parsed.data);
      setTerms(saved);
      onSaved?.(saved);
      setStatus({ kind: 'saved' });
      toast.success(tCommon('toast.saved'));
    } catch (error) {
      setStatus({ kind: 'error', message: error instanceof ApiClientError && error.messageText ? error.messageText : t('saveFailed') });
    }
  };

  const disabled = locked || status?.kind === 'saving';
  return (
    <>
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{t('dictionaryEditorHint')}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={disabled} onClick={() => setTerms((current) => merge(current!, STANDARD_BIOMETRY_TERMS))}>
          {t('importBiometry')}
        </Button>
        <Button variant="outline" size="sm" disabled={disabled} onClick={() => setTerms((current) => merge(current!, STARTER_LANDMARKS))}>
          {t('importLandmarks')}
        </Button>
        <Button variant="outline" size="sm" disabled={disabled} onClick={() => setTerms((current) => [...current!, { ...EMPTY }])}>
          <Plus aria-hidden className="size-4" />
          {t('addTerm')}
        </Button>
      </div>
      {terms.length ? (
        <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5">{t('termAbbr')}</th>
                <th className="px-2 py-1.5">{t('termName')}</th>
                <th className="px-2 py-1.5">{t('termTools')}</th>
                <th className="px-2 py-1.5">LOINC</th>
                <th className="px-2 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {terms.map((term, index) => (
                <tr key={index} className="border-t border-border align-top">
                  <td className="w-28 px-2 py-1.5">
                    <Input aria-label={t('termAbbr')} value={term.abbr} maxLength={16} disabled={disabled} className="h-8 font-mono uppercase" onChange={(e) => set(index, { abbr: e.target.value })} />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input aria-label={t('termName')} value={term.name} maxLength={120} disabled={disabled} className="h-8" onChange={(e) => set(index, { name: e.target.value })} />
                    <Input
                      aria-label={t('termDescription')}
                      placeholder={t('termDescription')}
                      value={term.description ?? ''}
                      maxLength={500}
                      disabled={disabled}
                      className="mt-1 h-8 text-xs"
                      onChange={(e) => set(index, { description: e.target.value || null })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex flex-wrap gap-x-2 gap-y-1">
                      {ANNOTATION_TOOLS.map((tool) => (
                        <label key={tool} className="flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            disabled={disabled}
                            checked={term.tools.includes(tool)}
                            onChange={(e) => set(index, { tools: e.target.checked ? [...term.tools, tool] : term.tools.filter((x) => x !== tool) })}
                          />
                          {t(`tool.${tool}`)}
                        </label>
                      ))}
                    </div>
                  </td>
                  <td className="w-28 px-2 py-1.5">
                    <Input aria-label="LOINC" value={term.loinc ?? ''} placeholder={t('optional')} disabled={disabled} className="h-8 font-mono" onChange={(e) => set(index, { loinc: e.target.value || null })} />
                  </td>
                  <td className="px-2 py-1.5">
                    <button type="button" aria-label={t('remove')} disabled={disabled} onClick={() => confirmDelete(() => setTerms((current) => current!.filter((_, i) => i !== index)), term.name || term.abbr)} className="rounded p-1 text-muted-foreground hover:text-destructive">
                      <Trash2 aria-hidden className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t('dictionaryEmpty')}</p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={() => void save()} disabled={disabled}>
          {status?.kind === 'saving' ? t('saving') : t('saveDictionary')}
        </Button>
        {status?.kind === 'saved' ? <span role="status" className="text-sm text-success">{t('dictionarySaved')}</span> : null}
        {status?.kind === 'error' ? <span role="alert" className="text-sm text-destructive">{status.message}</span> : null}
      </div>
    </div>
      {deleteDialog}
    </>
  );
}
