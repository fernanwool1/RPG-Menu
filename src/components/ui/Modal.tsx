'use client';

import { useCallback, useEffect, useRef, type ReactNode } from 'react';

import { useIsMobile } from '@/lib/useBreakpoint';
import { cn } from '@/lib/cn';
import { GameButton, IconButton } from './GameButton';

/**
 * Dialog primitive.
 *
 * Native <dialog> is avoided so the backdrop can be styled and animated
 * consistently; the focus trap, Escape handling, scroll lock and
 * focus-restoration are implemented here instead.
 *
 * Below 768px it becomes a bottom sheet anchored to the bottom of the screen:
 * the header and the action row stay pinned while the body scrolls, so the
 * Save button never disappears behind the software keyboard. The same
 * component, the same props, the same focus behaviour - only the geometry
 * changes.
 */
export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const isMobile = useIsMobile();

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!open) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [open, onClose],
  );

  useEffect(() => {
    if (!open) return;

    restoreRef.current = document.activeElement as HTMLElement | null;
    document.addEventListener('keydown', onKeyDown);

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    // Focus the first control rather than the panel, so keyboard users land
    // on something actionable.
    const timer = window.setTimeout(() => {
      const target = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      (target ?? panelRef.current)?.focus();
    }, 0);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      window.clearTimeout(timer);
      restoreRef.current?.focus?.();
    };
  }, [open, onKeyDown]);

  if (!open) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex',
        isMobile ? 'items-end justify-center p-0' : 'items-center justify-center p-4 sm:p-6',
      )}
    >
      <button
        type="button"
        aria-label="Close dialog"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink-950/85 backdrop-blur-sm animate-fade-in"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby={description ? 'modal-description' : undefined}
        tabIndex={-1}
        className={cn(
          'relative flex w-full flex-col border border-gold/40',
          'bg-[var(--panel-fill-solid)] shadow-panel',
          isMobile
            ? 'sheet-max rounded-t-[10px] border-b-0 animate-rise-in'
            : cn('max-h-[88vh] rounded-[3px] animate-scale-in', SIZES[size]),
        )}
        style={isMobile ? { paddingBottom: 'var(--safe-bottom)' } : undefined}
      >
        {isMobile && (
          <span
            aria-hidden
            className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-gold/40"
          />
        )}
        {!isMobile && (
          <>
            <span aria-hidden className="pointer-events-none absolute left-[3px] top-[3px] h-3 w-3 border-l border-t border-gold/50" />
            <span aria-hidden className="pointer-events-none absolute right-[3px] top-[3px] h-3 w-3 border-r border-t border-gold/50" />
            <span aria-hidden className="pointer-events-none absolute bottom-[3px] left-[3px] h-3 w-3 border-b border-l border-gold/50" />
            <span aria-hidden className="pointer-events-none absolute bottom-[3px] right-[3px] h-3 w-3 border-b border-r border-gold/50" />
          </>
        )}

        <header className="shrink-0 px-5 pb-2 pt-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h2 id="modal-title" className="panel-title text-left">
                {title}
              </h2>
              {description && (
                <p id="modal-description" className="mt-1.5 text-base text-ivory-dim">
                  {description}
                </p>
              )}
            </div>
            <IconButton icon="generic" label="Close" onClick={onClose} size="sm" className="mt-0.5" />
          </div>
          <div className="divider-diamond mt-3" />
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto scroll-thin px-5 py-3">{children}</div>

        {footer && (
          <footer
            className={cn(
              'shrink-0 border-t border-gold/20 px-5 py-3',
              isMobile && 'bg-[var(--panel-fill-solid)]',
            )}
          >
            <div
              className={cn(
                'flex flex-wrap items-center gap-2',
                // Stacked and full-width on a phone: easier to hit, and the
                // primary action lands under the thumb.
                isMobile ? 'justify-stretch [&>*]:flex-1' : 'justify-end',
              )}
            >
              {footer}
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}

/**
 * Confirmation for anything destructive or irreversible. Deletes must go
 * through this; archiving is offered alongside wherever it makes sense.
 */
export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Optional middle path, e.g. "Archive instead". */
  alternative?: { label: string; onSelect: () => void };
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive,
  onConfirm,
  onCancel,
  alternative,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <GameButton variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </GameButton>
          {alternative && (
            <GameButton variant="secondary" onClick={alternative.onSelect}>
              {alternative.label}
            </GameButton>
          )}
          <GameButton variant={destructive ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </GameButton>
        </>
      }
    >
      <div className="text-base leading-relaxed text-ivory-dim">{body}</div>
    </Modal>
  );
}
