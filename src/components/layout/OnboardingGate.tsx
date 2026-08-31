'use client';

import { Modal } from '@/components/ui/Modal';
import { GameButton } from '@/components/ui/GameButton';
import { useAppStore } from '@/store/useAppStore';

/**
 * First launch: choose sample data or an empty character.
 *
 * Shown until the user picks. There is no "maybe later", because every screen
 * needs a character to render, and silently seeding one would hide the fact
 * that the numbers are samples.
 */
export function OnboardingGate() {
  const initialized = useAppStore((s) => s.initialized);
  const startWithSampleData = useAppStore((s) => s.startWithSampleData);
  const startEmpty = useAppStore((s) => s.startEmpty);

  if (initialized) return null;

  return (
    <Modal
      open
      onClose={() => {
        /* Deliberately not dismissible: a choice is required. */
      }}
      title="Begin"
      description="Everything below is stored only in this browser. You can export it, import it, or reset it at any time from the Character page."
      size="sm"
    >
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={startWithSampleData}
          className="group rounded-[2px] border border-teal/45 bg-teal/[0.06] p-3.5 text-left transition-colors duration-200 hover:border-teal hover:bg-teal/[0.12]"
        >
          <div className="font-display text-base uppercase tracking-wider2 text-teal-bright">
            Start with sample data
          </div>
          <p className="mt-1.5 text-base leading-relaxed text-ivory-dim">
            A fully populated character: seven skill domains, thirty-four abilities, a live quest
            board and a real inventory. Every value is editable sample data, marked as such
            throughout, and meant to be replaced with your own.
          </p>
        </button>

        <button
          type="button"
          onClick={startEmpty}
          className="group rounded-[2px] border border-gold/35 p-3.5 text-left transition-colors duration-200 hover:border-gold hover:bg-gold/[0.07]"
        >
          <div className="font-display text-base uppercase tracking-wider2 text-gold-bright">
            Start empty
          </div>
          <p className="mt-1.5 text-base leading-relaxed text-ivory-dim">
            Level 1, no XP, no quests and nothing owned. The skill hierarchy, activity rules and
            ability catalogue are kept as scaffolding so there is something to build on - all of it
            editable.
          </p>
        </button>
      </div>
    </Modal>
  );
}

/** Footer control reused by the Character page to re-run onboarding. */
export function ResetControl({ onDone }: { onDone?: () => void }) {
  const resetAll = useAppStore((s) => s.resetAll);
  return (
    <GameButton
      variant="danger"
      onClick={() => {
        resetAll();
        onDone?.();
      }}
    >
      Reset everything
    </GameButton>
  );
}
