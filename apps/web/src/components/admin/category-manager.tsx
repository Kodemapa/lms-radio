'use client';

import { CategoryInputSchema, slugify, type AdminCategory } from '@obgyn/types';
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
  toast,
} from '@obgyn/ui';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type FormEvent, useMemo, useState } from 'react';
import { ConfirmDialog } from '@/components/instructor/confirm-dialog';
import { ApiClientError, api } from '@/lib/instructor-api';
import { RequiredLabel } from './required-label';

type Form = { id: string | null; name: string; slug: string; description: string; parentId: string };
const EMPTY: Form = { id: null, name: '', slug: '', description: '', parentId: '' };

function errorKey(error: unknown): string {
  const code = error instanceof ApiClientError ? error.body?.code : undefined;
  switch (code) {
    case 'SLUG_TAKEN':
      return 'slugTaken';
    case 'CATEGORY_DEPTH':
      return 'depth';
    case 'CATEGORY_IN_USE':
      return 'inUse';
    case 'CATEGORY_HAS_CHILDREN':
      return 'hasChildren';
    default:
      return 'failed';
  }
}

/** Category tree editor: add, rename, move between parents, reorder, delete. */
export function CategoryManager({ initial }: { initial: AdminCategory[] }) {
  const t = useTranslations('Admin.categories');
  const tCommon = useTranslations('Common');
  const [categories, setCategories] = useState(initial);
  const [form, setForm] = useState<Form | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [deleting, setDeleting] = useState<AdminCategory | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const roots = useMemo(
    () => categories.filter((category) => !category.parentId).sort((a, b) => a.position - b.position),
    [categories],
  );
  const childrenOf = (id: string) =>
    categories.filter((category) => category.parentId === id).sort((a, b) => a.position - b.position);

  const refresh = async () => setCategories(await api<AdminCategory[]>('GET', 'admin/categories'));

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!form) return;
    const parsed = CategoryInputSchema.safeParse({
      name: form.name,
      slug: form.slug,
      description: form.description || null,
      parentId: form.parentId || null,
    });
    if (!parsed.success) return setFormError(parsed.error.issues[0]?.message ?? t('errors.failed'));
    setPending(true);
    setFormError(null);
    try {
      if (form.id) await api('PATCH', `admin/categories/${form.id}`, parsed.data);
      else await api('POST', 'admin/categories', parsed.data);
      await refresh();
      toast.success(t(form.id ? 'updated' : 'created', { name: parsed.data.name }));
      setForm(null);
    } catch (error) {
      setFormError(t(`errors.${errorKey(error)}`));
    } finally {
      setPending(false);
    }
  };

  /** Swap a category with its neighbour among its siblings and save the sibling order. */
  const move = async (category: AdminCategory, direction: -1 | 1) => {
    const siblings = category.parentId ? childrenOf(category.parentId) : roots;
    const index = siblings.findIndex((item) => item.id === category.id);
    const target = index + direction;
    if (target < 0 || target >= siblings.length) return;
    const reordered = [...siblings];
    [reordered[index], reordered[target]] = [reordered[target]!, reordered[index]!];
    setStatus(null);
    try {
      setCategories(
        await api<AdminCategory[]>('PUT', 'admin/categories/order', {
          items: reordered.map((item, position) => ({ id: item.id, parentId: item.parentId, position })),
        }),
      );
      toast.success(t('moved', { name: category.name }));
    } catch (error) {
      setStatus(t(`errors.${errorKey(error)}`));
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await api('DELETE', `admin/categories/${deleting.id}`);
      await refresh();
      toast.success(t('deleted', { name: deleting.name }));
    } catch (error) {
      setStatus(t(`errors.${errorKey(error)}`));
    }
  };

  const row = (category: AdminCategory, siblings: AdminCategory[], depth: 0 | 1) => {
    const index = siblings.findIndex((item) => item.id === category.id);
    return (
      <div
        className={`flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 ${depth ? 'ms-8' : ''}`}
      >
        <div className="min-w-0 flex-1">
          <p className="font-medium">{category.name}</p>
          <p className="text-xs text-muted-foreground">
            /{category.slug} · {t('courseCount', { count: category.courseCount })}
            {depth === 0 ? ` · ${t('childCount', { count: category.childCount })}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" aria-label={t('moveUp', { name: category.name })} disabled={index === 0} onClick={() => move(category, -1)}>
            <ArrowUp aria-hidden className="size-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label={t('moveDown', { name: category.name })}
            disabled={index === siblings.length - 1}
            onClick={() => move(category, 1)}
          >
            <ArrowDown aria-hidden className="size-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label={t('edit', { name: category.name })}
            onClick={() => {
              setFormError(null);
              setForm({
                id: category.id,
                name: category.name,
                slug: category.slug,
                description: category.description ?? '',
                parentId: category.parentId ?? '',
              });
            }}
          >
            <Pencil aria-hidden className="size-4" />
          </Button>
          <Button size="sm" variant="ghost" aria-label={t('delete', { name: category.name })} onClick={() => setDeleting(category)}>
            <Trash2 aria-hidden className="size-4" />
          </Button>
        </div>
      </div>
    );
  };

  // A category with sub-categories can't be moved under another (two levels at most).
  const parentChoices = roots.filter((root) => root.id !== form?.id);
  const editingHasChildren = !!form?.id && childrenOf(form.id).length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t('depthHint')}</p>
        <Button
          onClick={() => {
            setFormError(null);
            setForm(EMPTY);
          }}
        >
          <Plus aria-hidden className="size-4" />
          {t('add')}
        </Button>
      </div>
      <p role="status" aria-live="polite" className="text-sm">{status}</p>

      {roots.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {roots.map((root) => {
            const children = childrenOf(root.id);
            return (
              <li key={root.id} className="flex flex-col gap-2">
                {row(root, roots, 0)}
                {children.length ? (
                  <ul className="flex flex-col gap-2" aria-label={t('subcategoriesOf', { name: root.name })}>
                    {children.map((child) => (
                      <li key={child.id}>{row(child, children, 1)}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={form !== null} onOpenChange={(open) => !open && !pending && setForm(null)}>
        {form ? (
          <DialogContent closeLabel={tCommon('close')}>
            <form onSubmit={save} className="flex flex-col gap-4" noValidate>
              <DialogHeader>
                <DialogTitle>{form.id ? t('editTitle') : t('addTitle')}</DialogTitle>
                <DialogDescription>{t('formHint')}</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-1.5">
                <RequiredLabel htmlFor="category-name">{t('name')}</RequiredLabel>
                <Input id="category-name" required maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="category-slug">{t('slug')}</Label>
                <Input
                  id="category-slug"
                  maxLength={80}
                  value={form.slug}
                  placeholder={slugify(form.name)}
                  aria-describedby="category-slug-hint"
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                />
                <p id="category-slug-hint" className="text-xs text-muted-foreground">{t('slugHint')}</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="category-parent">{t('parent')}</Label>
                <Select
                  id="category-parent"
                  value={form.parentId}
                  disabled={editingHasChildren}
                  aria-describedby={editingHasChildren ? 'category-parent-hint' : undefined}
                  onChange={(e) => setForm({ ...form, parentId: e.target.value })}
                >
                  <option value="">{t('topLevel')}</option>
                  {parentChoices.map((root) => (
                    <option key={root.id} value={root.id}>{root.name}</option>
                  ))}
                </Select>
                {editingHasChildren ? (
                  <p id="category-parent-hint" className="text-xs text-muted-foreground">{t('hasChildrenHint')}</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="category-description">{t('description')}</Label>
                <Textarea
                  id="category-description"
                  rows={3}
                  maxLength={500}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              {formError ? <p role="alert" className="text-sm text-destructive">{formError}</p> : null}
              <DialogFooter>
                <Button type="button" variant="outline" disabled={pending} onClick={() => setForm(null)}>{tCommon('cancel')}</Button>
                <Button type="submit" disabled={pending || form.name.trim().length < 2}>
                  {pending ? tCommon('saving') : tCommon('save')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t('deleteTitle', { name: deleting?.name ?? '' })}
        body={t('deleteBody')}
        confirmLabel={tCommon('delete')}
        onConfirm={remove}
      />
    </div>
  );
}
