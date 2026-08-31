'use client';

import { useState } from 'react';

import { Modal } from '@/components/ui/Modal';
import { GameButton } from '@/components/ui/GameButton';
import { STORAGE_KEY, type StorageHealth } from '@/store/persistence';
import { useAppStore } from '@/store/useAppStore';

/**
 * What the user sees when the saved data cannot be read.
 *
 * The unreadable text is offered for download BEFORE anything is cleared, so
 * a recoverable file is never destroyed to get the app running again.
 */
export function StorageRecovery({ health }: { health: StorageHealth }) {
  const resetAll = useAppStore((s) => s.resetAll);
  const [dismissed, setDismissed] = useState(false);

  if (health.state === 'ok' || health.state === 'empty') return null;
  if (health.state === 'unavailable' && dismissed) return null;

  if (health.state === 'unavailable') {
    return (
      <Modal
        open
        onClose={() => setDismissed(true)}
        title="Nothing can be saved"
        size="sm"
        footer={
          <GameButton variant="primary" onClick={() => setDismissed(true)}>
            Continue anyway
          </GameButton>
        }
      >
        <p className="text-base leading-relaxed text-ivory-dim">
          This browser is refusing local storage, so changes will last only until the tab closes.
          Private browsing and a full storage quota are the usual causes.
        </p>
        <p className="mt-2 text-sm text-ivory-faint">Reported: {health.reason}</p>
      </Modal>
    );
  }

  const downloadRaw = () => {
    const blob = new Blob([health.raw], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${STORAGE_KEY}-unreadable-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal
      open
      onClose={() => {
        /* Not dismissible: the app cannot run on unreadable data. */
      }}
      title="Saved data could not be read"
      size="sm"
      footer={
        <>
          <GameButton variant="secondary" onClick={downloadRaw}>
            Download the raw file
          </GameButton>
          <GameButton variant="danger" onClick={resetAll}>
            Discard and start over
          </GameButton>
        </>
      }
    >
      <p className="text-base leading-relaxed text-ivory-dim">
        The data stored in this browser is damaged and cannot be loaded. Download the raw copy
        first if you want any chance of recovering it - discarding is permanent.
      </p>
      <p className="mt-2 text-sm text-ivory-faint">Reported: {health.reason}</p>
    </Modal>
  );
}
