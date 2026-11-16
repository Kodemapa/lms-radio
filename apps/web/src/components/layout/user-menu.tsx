'use client';

import { type UserProfile } from '@obgyn/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@obgyn/ui';
import { BookOpen, Bookmark, ChevronDown, GraduationCap, LayoutDashboard, LogOut, Settings } from 'lucide-react';
import { useRouter as useNextRouter } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { initials } from '@/lib/initials';

export interface UserMenuLabels {
  myLearning: string;
  wishlist: string;
  account: string;
  instructorDashboard: string;
  becomeInstructor: string;
  signOut: string;
  myAccount: string;
}

export function UserMenu({ user, labels }: { user: UserProfile; labels: UserMenuLabels }) {
  const router = useRouter();
  const nextRouter = useNextRouter();
  const isInstructor = user.role === 'FACULTY' || user.role === 'ADMIN';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
        aria-label={labels.myAccount}
      >
        <span className="flex size-10 items-center justify-center rounded-full bg-primary-light font-semibold text-primary">
          {initials(user.displayName) || '•'}
        </span>
        <span className="hidden max-w-[10rem] truncate font-medium lg:inline">{user.displayName}</span>
        <ChevronDown aria-hidden className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <span className="block truncate">{user.displayName}</span>
          <span className="block truncate text-xs font-normal text-muted-foreground">
            {user.email ?? user.phone}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push('/account/learning')}>
          <BookOpen aria-hidden className="size-4" />
          {labels.myLearning}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push('/account/wishlist')}>
          <Bookmark aria-hidden className="size-4" />
          {labels.wishlist}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push('/account/profile')}>
          <Settings aria-hidden className="size-4" />
          {labels.account}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {isInstructor ? (
          <DropdownMenuItem onSelect={() => router.push('/instructor')}>
            <LayoutDashboard aria-hidden className="size-4" />
            {labels.instructorDashboard}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => router.push('/become-instructor')}>
            <GraduationCap aria-hidden className="size-4" />
            {labels.becomeInstructor}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await fetch('/api/auth/logout', { method: 'POST' });
            router.push('/');
            nextRouter.refresh();
          }}
        >
          <LogOut aria-hidden className="size-4" />
          {labels.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
