'use client';

import { APPLICATION_FIELD_TYPES, ApplicationFieldInputSchema, type ApplicationField, type ApplicationFieldType } from '@obgyn/types';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  Textarea,
} from '@obgyn/ui';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { ConfirmDialog } from '@/components/instructor/confirm-dialog';
import { ApiClientError, api } from '@/lib/instructor-api';

type Form = {
  id: string | null;
  key: string;
  label: string;
  labelHi: string;
  helpText: string;
  type: ApplicationFieldType;
  options: string;
  required: boolean;
  active: boolean;
};
const EMPTY: Form = { id: null, key: '', label: '', labelHi: '', helpText: '', type: 'TEXT', options: '', required: false, active: true };

/** Admin editor for the extra questions on "Become an instructor". */
export function ApplicationFieldsManager({ initial }: { initial: ApplicationField[] }) {
  const t = useTranslations('Admin.formFields');
  const tCommon = useTranslations('Common');
  const [fields, setFields] = useState(initial);
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [deleting, setDeleting] = useState<ApplicationField | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const refresh = async () => setFields(await api<ApplicationField[]>('GET', 'admin/application-fields'));

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!form) return;
    const parsed = ApplicationFieldInputSchema.safeParse({
      key: form.key,
      label: form.label,
      labelHi: form.labelHi || null,
      helpText: form.helpText || null,
      type: form.type,
      options: form.type === 'SELECT' ? form.options.split('\n').map((line) => line.trim()).filter(Boolean) : [],
      required: form.required,
      active: form.active,
    });
    if (!parsed.success) return setError(parsed.error.issues.map((issue) => issue.message).join(' '));
    setPending(true);
    setError(null);
    try {
      if (form.id) await api('PATCH', `admin/application-fields/${form.id}`, parsed.data);
      else await api('POST', 'admin/application-fields', parsed.data);
      await refresh();
      setStatus(t('saved', { label: parsed.data.label }));
      setForm(null);
    } catch (requestError) {
      const code = requestError instanceof ApiClientError ? requestError.body?.code : undefined;
      setError(code === 'KEY_TAKEN' ? t('errors.keyTaken') : code === 'PCPNDT_BLOCKED' ? tCommon('pcpndt') : t('errors.failed'));
    } finally {
      setPending(false);
    }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= fields.length) return;
    const ids = fields.map((field) => field.id);
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    try {
      setFields(await api<ApplicationField[]>('PUT', 'admin/application-fields/order', { ids }));
      setStatus(t('moved'));
    } catch {
      setStatus(t('errors.failed'));
    }
  };

  const edit = (field: ApplicationField) => {
    setError(null);
    setForm({
      id: field.id,
      key: field.key,
      label: field.label,
      labelHi: field.labelHi ?? '',
      helpText: field.helpText ?? '',
      type: field.type,
      options: field.options.join('\n'),
      required: field.required,
      active: field.active,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => { setError(null); setForm(EMPTY); }}>
          <Plus aria-hidden className="size-4" />
          {t('add')}
        </Button>
      </div>
      <p role="status" aria-live="polite" className="text-sm">{status}</p>

      {fields.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">{t('empty')}</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {fields.map((field, index) => (
            <li key={field.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {field.label}
                  {field.required ? <span className="ms-1 text-destructive" aria-label={t('required')}>*</span> : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-mono">{field.key}</span> · {t(`types.${field.type}`)}
                  {field.type === 'SELECT' ? ` · ${field.options.join(', ')}` : ''}
                  {!field.active ? ` · ${t('inactive')}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" aria-label={t('moveUp', { label: field.label })} disabled={index === 0} onClick={() => move(index, -1)}>
                  <ArrowUp aria-hidden className="size-4" />
                </Button>
                <Button size="sm" variant="ghost" aria-label={t('moveDown', { label: field.label })} disabled={index === fields.length - 1} onClick={() => move(index, 1)}>
                  <ArrowDown aria-hidden className="size-4" />
                </Button>
                <Button size="sm" variant="ghost" aria-label={t('edit', { label: field.label })} onClick={() => edit(field)}>
                  <Pencil aria-hidden className="size-4" />
                </Button>
                <Button size="sm" variant="ghost" aria-label={t('delete', { label: field.label })} onClick={() => setDeleting(field)}>
                  <Trash2 aria-hidden className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <Dialog open={form !== null} onOpenChange={(open) => !open && !pending && setForm(null)}>
        {form ? (
          <DialogContent closeLabel={tCommon('close')}>
            <form onSubmit={save} noValidate className="flex max-h-[80vh] flex-col gap-4 overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{form.id ? t('editTitle') : t('addTitle')}</DialogTitle>
                <DialogDescription>{t('formHint')}</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="field-label">{t('label')}</Label>
                <Input id="field-label" required maxLength={120} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="field-label-hi">{t('labelHi')}</Label>
                <Input id="field-label-hi" lang="hi" maxLength={120} value={form.labelHi} onChange={(e) => setForm({ ...form, labelHi: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="field-key">{t('key')}</Label>
                <Input
                  id="field-key"
                  required
                  maxLength={40}
                  disabled={!!form.id}
                  value={form.key}
                  aria-describedby="field-key-hint"
                  onChange={(e) => setForm({ ...form, key: e.target.value.toLowerCase() })}
                />
                <p id="field-key-hint" className="text-xs text-muted-foreground">{t('keyHint')}</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="field-type">{t('type')}</Label>
                <Select id="field-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ApplicationFieldType })}>
                  {APPLICATION_FIELD_TYPES.map((type) => (
                    <option key={type} value={type}>{t(`types.${type}`)}</option>
                  ))}
                </Select>
              </div>
              {form.type === 'SELECT' ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="field-options">{t('options')}</Label>
                  <Textarea
                    id="field-options"
                    rows={4}
                    value={form.options}
                    aria-describedby="field-options-hint"
                    onChange={(e) => setForm({ ...form, options: e.target.value })}
                  />
                  <p id="field-options-hint" className="text-xs text-muted-foreground">{t('optionsHint')}</p>
                </div>
              ) : null}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="field-help">{t('helpText')}</Label>
                <Input id="field-help" maxLength={300} value={form.helpText} onChange={(e) => setForm({ ...form, helpText: e.target.value })} />
              </div>
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="size-4" checked={form.required} onChange={(e) => setForm({ ...form, required: e.target.checked })} />
                  {t('required')}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="size-4" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                  {t('active')}
                </label>
              </div>
              {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
              <DialogFooter>
                <Button type="button" variant="outline" disabled={pending} onClick={() => setForm(null)}>{tCommon('cancel')}</Button>
                <Button type="submit" disabled={pending}>{pending ? tCommon('saving') : tCommon('save')}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t('deleteTitle', { label: deleting?.label ?? '' })}
        body={t('deleteBody')}
        confirmLabel={tCommon('delete')}
        onConfirm={async () => {
          if (!deleting) return;
          await api('DELETE', `admin/application-fields/${deleting.id}`);
          await refresh();
          setStatus(t('deleted', { label: deleting.label }));
        }}
      />
    </div>
  );
}
