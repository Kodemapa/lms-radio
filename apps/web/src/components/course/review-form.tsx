'use client';

import { Button, Label, Textarea, toast } from '@obgyn/ui';
import { Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { api } from '@/lib/instructor-api';
import { ConfirmDialog } from '@/components/instructor/confirm-dialog';

export function ReviewForm({
  slug,
  initial,
}: {
  slug: string;
  initial: { rating: number; comment: string | null } | null;
}) {
  const t = useTranslations('Reviews');
  const tCommon = useTranslations('Common');
  const router = useRouter();
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState(initial?.comment ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!rating) return;
    setPending(true);
    setError(false);
    try {
      await api('PUT', `courses/${slug}/review`, { rating, comment: comment.trim() || null });
      toast.success(t(initial ? 'toastUpdated' : 'toastSubmitted'));
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-4 surface p-5">
      <h3 className="font-semibold">{initial ? t('editTitle') : t('writeTitle')}</h3>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">
          {t('yourRating')}
          <span aria-hidden="true" className="ms-1 text-destructive">*</span>
        </legend>
        <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((value) => (
            <label key={value} className="cursor-pointer" onMouseEnter={() => setHover(value)}>
              <input
                type="radio"
                name="rating"
                value={value}
                checked={rating === value}
                onChange={() => setRating(value)}
                className="peer sr-only"
              />
              <span className="sr-only">{t('star', { count: value })}</span>
              <Star
                aria-hidden
                className={`size-8 rounded text-rating peer-focus-visible:outline-2 peer-focus-visible:outline-ring ${
                  value <= (hover || rating) ? 'fill-rating' : ''
                }`}
              />
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-2">
        <Label htmlFor="review-comment">{t('comment')}</Label>
        <Textarea id="review-comment" rows={3} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || !rating}>
          {pending ? t('saving') : initial ? t('update') : t('submit')}
        </Button>
        {initial ? (
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => setConfirmingDelete(true)}
          >
            {t('delete')}
          </Button>
        ) : null}
        {error ? <span role="alert" className="text-sm text-destructive">{tCommon('genericError')}</span> : null}
      </div>
      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={t('deleteConfirmTitle')}
        body={tCommon('deleteConfirmBody')}
        confirmLabel={t('delete')}
        successMessage={t('toastDeleted')}
        onConfirm={async () => {
          await api('DELETE', `courses/${slug}/review`);
          router.refresh();
        }}
      />
    </form>
  );
}
