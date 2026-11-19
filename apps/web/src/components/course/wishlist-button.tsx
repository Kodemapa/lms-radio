'use client';

import { Bookmark } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { api } from '@/lib/instructor-api';
import { toast } from '@obgyn/ui';

export function WishlistButton({
  courseId,
  initial,
  className = '',
  variant = 'icon',
}: {
  courseId: string;
  initial: boolean;
  className?: string;
  /** `labelled` shows the text next to the icon (course page, player). */
  variant?: 'icon' | 'labelled' | 'dark';
}) {
  const t = useTranslations('Common');
  const [saved, setSaved] = useState(initial);
  const [pending, setPending] = useState(false);
  const label = saved ? t('removeFromWishlist') : t('addToWishlist');
  const toggle = async () => {
    setPending(true);
    try {
      await api(saved ? 'DELETE' : 'PUT', `users/me/wishlist/${courseId}`);
      setSaved(!saved);
      toast.success(t(saved ? 'toast.wishlistRemoved' : 'toast.wishlistAdded'));
    } catch {
      toast.error(t('genericError'));
    } finally {
      setPending(false);
    }
  };

  if (variant !== 'icon') {
    const dark = variant === 'dark';
    return (
      <button
        type="button"
        aria-pressed={saved}
        disabled={pending}
        onClick={toggle}
        className={`flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
          dark
            ? 'border-white/30 hover:bg-white/10'
            : saved
              ? 'border-primary bg-primary-light text-primary'
              : 'border-border hover:border-primary hover:text-primary'
        } ${className}`}
      >
        <Bookmark aria-hidden className={`size-4 ${saved ? 'fill-current' : ''}`} />
        <span className={dark ? 'hidden sm:inline' : ''}>{saved ? t('savedToWishlist') : t('addToWishlist')}</span>
        {dark ? <span className="sr-only sm:hidden">{label}</span> : null}
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={label}
      title={label}
      disabled={pending}
      onClick={toggle}
      className={`rounded-full border bg-white p-2 text-[#010211] shadow-sm transition-colors hover:border-primary hover:text-primary disabled:opacity-50 ${
        saved ? 'border-primary text-primary' : 'border-gray-300'
      } ${className}`}
    >
      <Bookmark aria-hidden className={`size-[18px] ${saved ? 'fill-current' : ''}`} />
    </button>
  );
}
