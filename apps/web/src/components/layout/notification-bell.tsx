'use client';

import { NotificationListSchema, type AppNotification } from '@obgyn/types';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@obgyn/ui';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { bffFetch } from '@/lib/client-fetch';

/** How often the unread badge refreshes while the page is open and visible. */
const POLL_MS = 60_000;

/**
 * Bell in the header: unread badge, latest notifications, mark one or all as
 * read. Opening a notification marks it read and goes to its page.
 */
export function NotificationBell() {
  const t = useTranslations('Notifications');
  const format = useFormatter();
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [busy, setBusy] = useState<string | null>(null);
  const loaded = useRef(false);

  const refreshCount = useCallback(async () => {
    try {
      const res = await bffFetch('/api/proxy/notifications/unread-count');
      if (res.ok) setUnread(((await res.json()) as { unreadCount: number }).unreadCount ?? 0);
    } catch {
      // Offline or signed out: keep the last count.
    }
  }, []);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const res = await bffFetch('/api/proxy/notifications');
      if (!res.ok) throw new Error(String(res.status));
      const list = NotificationListSchema.parse(await res.json());
      setItems(list.items);
      setUnread(list.unreadCount);
      loaded.current = true;
      setState('idle');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => {
    void refreshCount();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void refreshCount();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [refreshCount]);

  const open = async (item: AppNotification) => {
    setBusy(item.id);
    if (!item.readAt) {
      await bffFetch(`/api/proxy/notifications/${item.id}/read`, { method: 'POST' }).catch(
        () => undefined,
      );
      setItems(
        (current) =>
          current?.map((n) =>
            n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n,
          ) ?? null,
      );
      setUnread((count) => Math.max(0, count - 1));
    }
    setBusy(null);
    if (item.link) router.push(item.link);
  };

  const markAll = async () => {
    setBusy('all');
    await bffFetch('/api/proxy/notifications/read-all', { method: 'POST' }).catch(() => undefined);
    const now = new Date().toISOString();
    setItems((current) => current?.map((n) => ({ ...n, readAt: n.readAt ?? now })) ?? null);
    setUnread(0);
    setBusy(null);
  };

  const describe = (item: AppNotification) => {
    const d = item.data;
    const values = {
      courseTitle: d.courseTitle ?? '',
      lessonTitle: d.lessonTitle ?? '',
      subject: d.subject ?? '',
    };
    const detail =
      item.kind === 'COURSE_CHANGES_REQUESTED' || item.kind === 'APPLICATION_REJECTED'
        ? d.note || null
        : item.kind === 'ASSIGNMENT_REVIEWED' || item.kind === 'WORKING_REVIEWED'
          ? d.outcome && ['APPROVED', 'RETURNED', 'VERIFIED'].includes(d.outcome)
            ? t(`outcome.${d.outcome as 'APPROVED' | 'RETURNED' | 'VERIFIED'}`)
            : null
          : item.kind === 'CONTACT_MESSAGE' && d.fromName
            ? t('from', { name: d.fromName })
            : null;
    return { title: t(`kind.${item.kind}`, values), detail };
  };

  return (
    <DropdownMenu
      onOpenChange={(isOpen) => {
        if (isOpen) void load();
      }}
    >
      <DropdownMenuTrigger
        aria-label={unread > 0 ? t('openUnread', { count: unread }) : t('open')}
        className="relative flex size-10 items-center justify-center rounded-full border border-border bg-card transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
      >
        <Bell aria-hidden className="size-4" />
        {unread > 0 ? (
          <span className="absolute -end-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-semibold leading-5 text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(92vw,380px)] p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <p className="font-semibold">{t('title')}</p>
          {unread > 0 ? (
            <button
              type="button"
              onClick={() => void markAll()}
              disabled={busy === 'all'}
              className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-primary hover:bg-primary-light disabled:opacity-60"
            >
              {busy === 'all' ? (
                <Loader2 aria-hidden className="size-3.5 animate-spin" />
              ) : (
                <CheckCheck aria-hidden className="size-3.5" />
              )}
              {t('markAll')}
            </button>
          ) : null}
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {state === 'loading' && !loaded.current ? (
            <p
              role="status"
              className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground"
            >
              <Loader2 aria-hidden className="size-4 animate-spin" />
              {t('loading')}
            </p>
          ) : state === 'error' && !items ? (
            <p role="alert" className="p-6 text-center text-sm text-destructive">
              {t('loadFailed')}
            </p>
          ) : !items || items.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">{t('empty')}</p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => {
                const { title, detail } = describe(item);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => void open(item)}
                      className={`flex w-full gap-3 px-4 py-3 text-start transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none ${item.readAt ? '' : 'bg-primary-light/40'}`}
                    >
                      <span
                        aria-hidden
                        className={`mt-1.5 size-2 shrink-0 rounded-full ${item.readAt ? 'bg-transparent' : 'bg-primary'}`}
                      />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className={`text-sm ${item.readAt ? '' : 'font-semibold'}`}>
                          {title}
                        </span>
                        {detail ? (
                          <span className="line-clamp-2 text-sm text-muted-foreground">
                            {detail}
                          </span>
                        ) : null}
                        <span className="text-xs text-muted-foreground">
                          {format.relativeTime(new Date(item.createdAt))}
                        </span>
                      </span>
                      {busy === item.id ? (
                        <Loader2 aria-hidden className="mt-1 size-4 shrink-0 animate-spin" />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
