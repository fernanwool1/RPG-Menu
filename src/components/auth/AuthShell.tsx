'use client';

import type { ReactNode } from 'react';

import { Corners } from '@/components/ui/GamePanel';
import { cn } from '@/lib/cn';

/**
 * The chassis every account screen sits in.
 *
 * Deliberately the same object as the rest of the app: gold hairline, corner
 * brackets, near-black translucent fill, serif display heading, diamond
 * divider. A person arriving at sign-in should already be inside Menu, not on
 * a generic form that happens to precede it.
 */
export function AuthShell({
  eyebrow = 'Semester I',
  title,
  subtitle,
  children,
  footer,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center px-4 py-10">
      {/* The painted atmosphere from globals.css, so the account screens sit on
          the same ground as the app rather than on flat black. */}
      <div aria-hidden className="bg-atmosphere pointer-events-none fixed inset-0 -z-10" />

      <section
        className={cn(
          'relative w-full max-w-[30rem] rounded-[3px] border border-gold/35',
          'bg-[var(--panel-fill)] px-5 py-7 shadow-panel backdrop-blur-[2px] sm:px-8 sm:py-9',
          'motion-safe:animate-rise-in',
        )}
      >
        <Corners />

        <header className="text-center">
          <p className="label-caps text-teal">{eyebrow}</p>

          <h1 className="mt-2.5 font-display text-3xl leading-tight text-gold-bright sm:text-4xl">
            {title}
          </h1>

          {subtitle && (
            <p className="mx-auto mt-2.5 max-w-[26rem] text-base leading-relaxed text-ivory-dim">
              {subtitle}
            </p>
          )}

          <div className="divider-diamond mt-5" />
        </header>

        <div className="mt-6">{children}</div>

        {footer && <div className="mt-7 border-t border-gold/15 pt-4">{footer}</div>}
      </section>
    </main>
  );
}

/**
 * A short line of state under the form: sending, verifying, connecting.
 * Announced politely so a screen reader hears it without losing the field.
 */
export function AuthStatus({
  children,
  tone = 'muted',
}: {
  children: ReactNode;
  tone?: 'muted' | 'teal';
}) {
  return (
    <p
      role="status"
      aria-live="polite"
      className={cn('text-sm leading-relaxed', tone === 'teal' ? 'text-teal' : 'text-ivory-faint')}
    >
      {children}
    </p>
  );
}

/** An error the person needs to act on. Assertive: it interrupts. */
export function AuthError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p
      id={id}
      role="alert"
      className="rounded-[2px] border border-danger-dim bg-danger/[0.07] px-3 py-2.5 text-sm leading-relaxed text-danger"
    >
      {children}
    </p>
  );
}
