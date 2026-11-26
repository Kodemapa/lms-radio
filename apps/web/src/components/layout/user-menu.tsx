'use client';

import { type UserProfile } from '@obgyn/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  toastAfterReload,
} from '@obgyn/ui';
import {
  BookOpen,
  Bookmark,
  ChevronDown,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Settings,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ConfirmDialog } from '@/components/instructor/confirm-dialog';
import { useRouter } from '@/i18n/navigation';
import { GlobalLoader } from './page-loader';
import { useSessionWatch } from './session-watch';
import { announceSessionEnded, setSessionScope } from '@/lib/client-fetch';
import { AvatarContent } from '@/components/account/avatar';
import { UserId } from '@/components/account/user-id';
import { showNavigationLoader } from '@/components/layout/navigation-progress';

export interface UserMenuLabels {
  myLearning: string;
  wishlist: string;
  account: string;
  instructorDashboard: string;
  adminDashboard: string;
  becomeInstructor: string;
  signOut: string;
  myAccount: string;
}

export function UserMenu({ user, labels }: { user: UserProfile; labels: UserMenuLabels }) {
  const router = useRouter();
  const tCommon = useTranslations('Common');
  // True from "Sign out" until the page reloads: shows the global loader meanwhile.
  const [signingOut, setSigningOut] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  // Signed in on every page that shows this menu: sign out here if the session ends elsewhere.
  useSessionWatch();
  // Scope this tab's client caches to this account and role (see lib/client-fetch.ts).
  useEffect(() => setSessionScope(user.id, user.role), [user.id, user.role]);
  const go = (href: '/account/learning' | '/account/wishlist' | '/account/profile' | '/admin' | '/instructor' | '/become-instructor') => {
    showNavigationLoader(href);
    router.push(href);
  };
  const isAdmin = user.role === 'ADMIN';
  const isInstructor = user.role === 'FACULTY' || user.role === 'ADMIN';

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
          aria-label={labels.myAccount}
        >
          <span className="flex size-10 items-center justify-center overflow-hidden rounded-full bg-primary-light font-semibold text-primary">
            <AvatarContent name={user.displayName} assetId={user.avatarAssetId} />
          </span>
          <span className="hidden max-w-[10rem] truncate font-medium 2xl:inline">
            {user.displayName}
          </span>
          <ChevronDown aria-hidden className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>
            <span className="block truncate">{user.displayName}</span>
            <span className="block truncate text-xs font-normal text-muted-foreground">
              {user.email ?? user.phone}
            </span>
            <UserId id={user.id} short className="mt-1 font-normal" />
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {!isAdmin ? (
            <>
              <DropdownMenuItem onSelect={() => go('/account/learning')}>
                <BookOpen aria-hidden className="size-4" />
                {labels.myLearning}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => go('/account/wishlist')}>
                <Bookmark aria-hidden className="size-4" />
                {labels.wishlist}
              </DropdownMenuItem>
            </>
          ) : null}
          <DropdownMenuItem onSelect={() => go('/account/profile')}>
            <Settings aria-hidden className="size-4" />
            {labels.account}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {isAdmin ? (
            <DropdownMenuItem onSelect={() => go('/admin')}>
              <LayoutDashboard aria-hidden className="size-4" />
              {labels.adminDashboard}
            </DropdownMenuItem>
          ) : isInstructor ? (
            <DropdownMenuItem onSelect={() => go('/instructor')}>
              <LayoutDashboard aria-hidden className="size-4" />
              {labels.instructorDashboard}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => go('/become-instructor')}>
              <GraduationCap aria-hidden className="size-4" />
              {labels.becomeInstructor}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {/* Asks first: a stray click shouldn't end the session (and stop a lesson or quiz). */}
          <DropdownMenuItem onSelect={() => setConfirmSignOut(true)}>
            <LogOut aria-hidden className="size-4" />
            {labels.signOut}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {/* Outside the menu, so it stays open after the menu closes. */}
      <ConfirmDialog
        open={confirmSignOut}
        onOpenChange={setConfirmSignOut}
        title={tCommon('signOutConfirmTitle')}
        body={tCommon('signOutConfirmBody')}
        confirmLabel={labels.signOut}
        confirmVariant="default"
        onConfirm={async () => {
          // The loader stays up through the full page load that follows.
          setSigningOut(true);
          toastAfterReload('success', tCommon('toast.signedOut'));
          await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
          // Other open tabs go to sign-in now rather than at their next session check.
          announceSessionEnded();
          // A full page load re-runs the theme script, so the signed-out site uses the admin default.
          window.location.assign('/');
        }}
      />
      {/* Rendered on <body>: the header's backdrop blur would otherwise pin it inside the header. */}
      {signingOut ? createPortal(<GlobalLoader label={tCommon('signingOut')} source="nav" />, document.body) : null}
    </>
  );
}
