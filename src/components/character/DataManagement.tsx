'use client';

import { useRef, useState } from 'react';

import { GameButton } from '@/components/ui/GameButton';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { SCHEMA_VERSION } from '@/store/persistence';
import { useAppStore } from '@/store/useAppStore';
import { cloudEnabled } from '@/cloud/config';

/**
 * Export, import and reset.
 *
 * Export writes the whole store, schema version included, so a file can be
 * migrated forward when the shape changes. Import replaces everything, which
 * is destructive, so it is confirmed first.
 */
export function DataManagement({ open, onClose }: { open: boolean; onClose: () => void }) {
  const exportData = useAppStore((s) => s.exportData);
  const importData = useAppStore((s) => s.importData);
  const resetAll = useAppStore((s) => s.resetAll);

  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const onExport = () => {
    const json = exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `menu-export-${stamp}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage({ tone: 'ok', text: 'Exported. The file contains everything, including the XP ledger.' });
  };

  const onPickFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    setPendingImport(text);
  };

  const runImport = () => {
    if (!pendingImport) return;
    const result = importData(pendingImport);
    setPendingImport(null);
    if (fileRef.current) fileRef.current.value = '';
    setMessage(
      result.ok
        ? { tone: 'ok', text: 'Imported. Everything on screen now comes from that file.' }
        : { tone: 'error', text: result.error },
    );
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={cloudEnabled ? 'Account data' : 'Local data'}
        description={`${cloudEnabled ? 'Changes sync to your account on every device. Import and reset replace the shared account data.' : 'Everything lives in this browser only.'} Schema version ${SCHEMA_VERSION}.`}
        size="sm"
        footer={
          <GameButton variant="ghost" onClick={onClose}>
            Close
          </GameButton>
        }
      >
        <div className="flex flex-col gap-4">
          <section>
            <h3 className="label-caps mb-1.5 text-gold">Export</h3>
            <p className="mb-2 text-base leading-relaxed text-ivory-dim">
              Writes a single JSON file containing the profile, skill hierarchy, quests, abilities,
              inventory and the complete XP ledger.
            </p>
            <GameButton variant="secondary" icon="box" onClick={onExport}>
              Export everything
            </GameButton>
          </section>

          <div className="divider-diamond" />

          <section>
            <h3 className="label-caps mb-1.5 text-gold">Import</h3>
            <p className="mb-2 text-base leading-relaxed text-ivory-dim">
              Replaces everything currently stored. Export first if you want to keep it.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              onChange={(e) => void onPickFile(e.target.files?.[0])}
              className="field text-sm file:mr-3 file:rounded-[2px] file:border file:border-gold/40 file:bg-transparent file:px-2 file:py-1 file:text-xs file:uppercase file:tracking-wider2 file:text-ivory"
            />
          </section>

          <div className="divider-diamond" />

          <section>
            <h3 className="label-caps mb-1.5 text-danger">Reset</h3>
            <p className="mb-2 text-base leading-relaxed text-ivory-dim">
              Clears everything and returns to the opening choice between sample data and an empty
              character.
            </p>
            <GameButton variant="danger" onClick={() => setConfirmReset(true)}>
              Reset everything
            </GameButton>
          </section>

          {message && (
            <p
              role="status"
              className={
                message.tone === 'ok'
                  ? 'text-sm text-teal'
                  : 'text-sm text-danger'
              }
            >
              {message.text}
            </p>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={pendingImport !== null}
        title="Replace everything?"
        body="Importing overwrites the profile, every quest, the whole skill hierarchy, all abilities, the inventory and the entire XP ledger. This cannot be undone."
        confirmLabel="Import and replace"
        destructive
        onConfirm={runImport}
        onCancel={() => {
          setPendingImport(null);
          if (fileRef.current) fileRef.current.value = '';
        }}
      />

      <ConfirmDialog
        open={confirmReset}
        title="Reset everything?"
        body="Every quest, every logged activity and the entire XP ledger will be discarded, and the app returns to first launch. Export first if there is anything worth keeping."
        confirmLabel="Reset"
        destructive
        onConfirm={() => {
          resetAll();
          setConfirmReset(false);
          onClose();
        }}
        onCancel={() => setConfirmReset(false)}
      />
    </>
  );
}
