'use client';

import { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { ItemArtwork } from '@/components/inventory/ItemArtwork';
import { ItemEditor } from '@/components/inventory/ItemEditor';
import { MobileFab } from '@/components/quests/MobileQuestExtras';
import { ResponsiveStage } from '@/components/layout/ResponsiveStage';
import { DetailActions, SectionLabel, StatList, StatRow } from '@/components/ui/DetailPanel';
import { EmptyState } from '@/components/ui/EmptyState';
import { GameButton } from '@/components/ui/GameButton';
import { GamePanel } from '@/components/ui/GamePanel';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { NavList, NavListItem } from '@/components/ui/NavList';
import { formatRelativeDay } from '@/domain/ids';
import { CONDITION_LABEL, MASKED_VALUE, formatMoney } from '@/domain/inventory';
import type { Id } from '@/domain/types';
import { useAssetTotals } from '@/store/selectors';
import { useAppStore } from '@/store/useAppStore';
import { iconFor } from '@/lib/icons';
import { useIsMobile } from '@/lib/useBreakpoint';
import { cn } from '@/lib/cn';


export default function InventoryPage() {
  const locations = useAppStore((s) => s.locations);
  const items = useAppStore((s) => s.items);
  const finances = useAppStore((s) => s.finances);
  const hidden = useAppStore((s) => s.hiddenFinancials);
  const togglePrivacy = useAppStore((s) => s.toggleFinancialPrivacy);
  const setAllPrivacy = useAppStore((s) => s.setAllFinancialPrivacy);
  const setFinances = useAppStore((s) => s.setFinances);
  const toggleCarried = useAppStore((s) => s.toggleCarried);
  const moveItem = useAppStore((s) => s.moveItem);
  const archiveItem = useAppStore((s) => s.archiveItem);
  const updateItem = useAppStore((s) => s.updateItem);

  const totals = useAssetTotals();

  const sortedLocations = useMemo(
    () => [...locations].sort((a, b) => a.order - b.order),
    [locations],
  );

  const [locationId, setLocationId] = useState<Id>('loc_bag');
  const [selectedItemId, setSelectedItemId] = useState<Id | null>('itm_laptop');
  const [paneIndex, setPaneIndex] = useState(1);
  const isMobile = useIsMobile();
  // A drill-down starts at its first level on a phone, never mid-stack.
  useEffect(() => {
    if (isMobile) setPaneIndex(0);
  }, [isMobile]);

  const [editing, setEditing] = useState<{ open: boolean; itemId: Id | null }>({
    open: false,
    itemId: null,
  });
  const [showMove, setShowMove] = useState(false);
  const [showBulkMove, setShowBulkMove] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [showMoney, setShowMoney] = useState<'cash' | 'bank' | null>(null);
  const [revealSensitive, setRevealSensitive] = useState(false);

  const activeLocation = sortedLocations.find((l) => l.id === locationId) ?? sortedLocations[0];

  const visibleItems = useMemo(() => {
    const live = items.filter((i) => !i.archived);
    if (!activeLocation || activeLocation.virtual) return live;
    return live.filter((i) => i.locationId === activeLocation.id);
  }, [items, activeLocation]);

  const selectedItem = items.find((i) => i.id === selectedItemId && !i.archived) ?? null;
  const carriedCount = visibleItems.filter((i) => i.carried).length;

  const countFor = (id: Id) => {
    const live = items.filter((i) => !i.archived);
    const location = sortedLocations.find((l) => l.id === id);
    return location?.virtual ? live.length : live.filter((i) => i.locationId === id).length;
  };

  /* ---------------- financial cards ---------------- */

  const financeCards = isMobile ? (
    /*
     * On a phone Total Assets is the headline and Cash / Bank sit beneath it
     * in a snap rail, so a six-figure number never has to share a row.
     */
    <div className="mb-2.5 shrink-0 space-y-2">
      <MoneyCard
        icon="chart"
        label="Total Assets"
        value={totals.total}
        currency={finances.currency}
        hidden={hidden.total}
        onToggle={() => togglePrivacy('total')}
        derived={`${formatMoney(totals.cash, finances.currency)} cash + ${formatMoney(
          totals.bank,
          finances.currency,
        )} bank + ${formatMoney(totals.itemValue, finances.currency)} in ${totals.itemCount} items`}
        layout="headline"
      />

      <div className="rail">
        <div className="w-[15rem]">
          <MoneyCard
            icon="wallet"
            label="Cash"
            value={finances.cash}
            currency={finances.currency}
            hidden={hidden.cash}
            onToggle={() => togglePrivacy('cash')}
            onEdit={() => setShowMoney('cash')}
            layout="stacked"
          />
        </div>
        <div className="w-[15rem]">
          <MoneyCard
            icon="bank"
            label="Bank"
            value={finances.bank}
            currency={finances.currency}
            hidden={hidden.bank}
            onToggle={() => togglePrivacy('bank')}
            onEdit={() => setShowMoney('bank')}
            layout="stacked"
          />
        </div>
      </div>
    </div>
  ) : (
    <div className="mb-2.5 grid shrink-0 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
      <MoneyCard
        icon="wallet"
        label="Cash"
        value={finances.cash}
        currency={finances.currency}
        hidden={hidden.cash}
        onToggle={() => togglePrivacy('cash')}
        onEdit={() => setShowMoney('cash')}
      />
      <MoneyCard
        icon="bank"
        label="Bank"
        value={finances.bank}
        currency={finances.currency}
        hidden={hidden.bank}
        onToggle={() => togglePrivacy('bank')}
        onEdit={() => setShowMoney('bank')}
      />
      <MoneyCard
        icon="chart"
        label="Total Assets"
        value={totals.total}
        currency={finances.currency}
        hidden={hidden.total}
        onToggle={() => togglePrivacy('total')}
        derived={`${formatMoney(totals.cash, finances.currency)} cash + ${formatMoney(
          totals.bank,
          finances.currency,
        )} bank + ${formatMoney(totals.itemValue, finances.currency)} in ${totals.itemCount} items`}
      />
    </div>
  );

  /* ---------------- panels ---------------- */

  const locationsPanel = (
    <GamePanel title="Locations" className="h-full" bodyClassName="flex min-h-0 flex-1 flex-col p-3">
      <NavList label="Storage locations">
        {sortedLocations.map((location) => (
          <NavListItem
            key={location.id}
            icon={location.icon}
            label={location.name}
            meta={countFor(location.id)}
            selected={location.id === activeLocation?.id}
            onSelect={() => {
              setLocationId(location.id);
              setPaneIndex(1);
            }}
          />
        ))}
      </NavList>

      <DetailActions>
        <GameButton
          variant="secondary"
          block
          icon="sparkles"
          onClick={() => setEditing({ open: true, itemId: null })}
        >
          + Add item
        </GameButton>
        <GameButton
          variant="ghost"
          block
          size="sm"
          onClick={() => setAllPrivacy(!(hidden.cash && hidden.bank && hidden.total))}
        >
          {hidden.cash && hidden.bank && hidden.total ? 'Show all values' : 'Hide all values'}
        </GameButton>
      </DetailActions>
    </GamePanel>
  );

  const loadoutPanel = (
    <GamePanel
      title={activeLocation?.virtual ? 'All Assets' : 'Current Loadout'}
      subtitle={activeLocation?.name.toUpperCase()}
      className="h-full"
      bodyClassName="flex min-h-0 flex-1 flex-col p-3"
    >
      {isMobile && (
        <div className="rail mb-3 shrink-0" role="group" aria-label="Filter by location">
          {sortedLocations.map((location) => {
            const active = location.id === activeLocation?.id;
            return (
              <button
                key={location.id}
                type="button"
                aria-pressed={active}
                onClick={() => setLocationId(location.id)}
                className={cn(
                  'tap-target inline-flex items-center gap-2 rounded-full border px-3.5 text-sm transition-colors duration-200',
                  active
                    ? 'border-teal/60 bg-teal/10 text-teal-bright'
                    : 'border-gold/30 text-ivory-dim',
                )}
              >
                <span className="whitespace-nowrap">{location.name}</span>
                <span className={cn('tabular-nums', active ? 'text-teal' : 'text-gold')}>
                  {countFor(location.id)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {visibleItems.length === 0 ? (
        <EmptyState
          icon="box"
          title="Nothing here yet"
          body={`${activeLocation?.name ?? 'This location'} is empty. Add an item, or move one in from somewhere else.`}
          action={
            <GameButton variant="primary" onClick={() => setEditing({ open: true, itemId: null })}>
              Add item
            </GameButton>
          }
        />
      ) : (
        <ul className="grid min-h-0 flex-1 auto-rows-min grid-cols-1 gap-2 overflow-y-auto scroll-thin min-[340px]:grid-cols-2 sm:grid-cols-3">
          {visibleItems.map((item) => {
            const selected = item.id === selectedItemId;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedItemId(item.id);
                    setRevealSensitive(false);
                    setPaneIndex(2);
                  }}
                  aria-current={selected ? 'true' : undefined}
                  className={cn(
                    'flex h-full w-full flex-col items-center justify-between gap-1.5 rounded-[2px] border p-2.5',
                    'transition-[border-color,background-color,box-shadow] duration-200',
                    selected
                      ? 'border-teal/70 bg-teal/[0.07] shadow-glow'
                      : 'border-gold/25 hover:border-gold/55 hover:bg-gold/[0.04]',
                  )}
                >
                  <ItemArtwork kind={item.image} />
                  <span className="text-center text-sm leading-tight text-ivory">
                    {item.name}
                  </span>
                  {item.carried && (
                    <span className="label-caps text-2xs text-teal">Carried</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-2.5 flex shrink-0 items-center justify-between gap-2 border-t border-gold/20 pt-2.5">
        <span className="text-sm text-ivory-dim">
          {carriedCount} {carriedCount === 1 ? 'item' : 'items'} carried
        </span>
        <GameButton variant="secondary" size="sm" onClick={() => setShowBulkMove(true)}>
          Move items
        </GameButton>
      </div>
    </GamePanel>
  );

  const detailPanel = (
    <GamePanel className="h-full" bodyClassName="flex min-h-0 flex-1 flex-col p-3.5">
      {!selectedItem ? (
        <EmptyState
          icon="search"
          title="No item selected"
          body="Pick something from the loadout to inspect it."
        />
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto scroll-thin pr-1">
          <h2 className="text-center font-display text-xl uppercase tracking-wider3 text-gold-bright">
            {selectedItem.name}
          </h2>

          <div className="my-3 flex justify-center rounded-[2px] border border-gold/20 bg-ink-950/40 py-4">
            <ItemArtwork kind={selectedItem.image} size="lg" />
          </div>

          <StatList>
            <StatRow
              label="Location"
              value={locations.find((l) => l.id === selectedItem.locationId)?.name ?? 'Unassigned'}
            />
            <StatRow label="Status" value={selectedItem.carried ? 'Carried' : 'Stored'} />
            <StatRow label="Category" value={selectedItem.category} />
            <StatRow label="Condition" value={CONDITION_LABEL[selectedItem.condition]} />
            <StatRow
              label="Estimated Value"
              value={formatMoney(selectedItem.estimatedValue, finances.currency)}
            />
            <StatRow
              label="Last Checked"
              value={formatRelativeDay(selectedItem.lastCheckedAt)}
            />
            {selectedItem.purchaseDate && (
              <StatRow
                label="Purchased"
                value={new Date(selectedItem.purchaseDate).toLocaleDateString()}
              />
            )}
          </StatList>

          {selectedItem.notes && (
            <p className="mt-3 text-sm leading-relaxed text-ivory-dim">{selectedItem.notes}</p>
          )}

          <div className="mt-3">
            <SectionLabel className="mb-2">Quick actions</SectionLabel>
            <div className="flex flex-col gap-2">
              <GameButton
                variant={selectedItem.carried ? 'secondary' : 'primary'}
                block
                onClick={() => toggleCarried(selectedItem.id)}
              >
                {selectedItem.carried ? 'Mark as stored' : 'Mark as carried'}
              </GameButton>
              <GameButton variant="secondary" block onClick={() => setShowMove(true)}>
                Move to location
              </GameButton>
              <GameButton
                variant="secondary"
                block
                onClick={() => setEditing({ open: true, itemId: selectedItem.id })}
              >
                Edit item
              </GameButton>
              <GameButton variant="ghost" block size="sm" onClick={() => setConfirmArchive(true)}>
                Archive item
              </GameButton>
            </div>
          </div>

          </div>

          <div className="shrink-0 pt-3">
            {selectedItem.sensitiveIdentifier ? (
              <div className="rounded-[2px] border border-gold/25 bg-ink-950/40 p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="label-caps text-gold">Identifier</span>
                  <button
                    type="button"
                    onClick={() => setRevealSensitive((v) => !v)}
                    className="text-xs uppercase tracking-wider2 text-teal transition-colors duration-200 hover:text-teal-bright"
                  >
                    {revealSensitive ? 'Hide' : 'Reveal'}
                  </button>
                </div>
                <div className="mt-1 font-mono text-base text-ivory">
                  {revealSensitive ? selectedItem.sensitiveIdentifier : MASKED_VALUE}
                </div>
              </div>
            ) : (
              <p className="text-center text-xs text-ivory-faint">
                Sensitive identifiers are hidden.
              </p>
            )}
          </div>
        </>
      )}
    </GamePanel>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {financeCards}

      <ResponsiveStage
        activeIndex={paneIndex}
        onActiveIndexChange={setPaneIndex}
        panes={[
          // On mobile the locations sidebar becomes chips inside the loadout,
          // so it does not also need a drill-down level of its own.
          ...(isMobile
            ? []
            : [
                {
                  id: 'locations',
                  label: 'Locations',
                  node: locationsPanel,
                  className: 'w-[24rem] shrink-0',
                },
              ]),
          { id: 'loadout', label: 'Loadout', node: loadoutPanel, className: 'flex-1' },
          {
            id: 'detail',
            label: selectedItem?.name ?? 'Detail',
            node: detailPanel,
            className: 'w-[24rem] shrink-0',
          },
        ]}
      />

      {isMobile && paneIndex === 0 && (
        <MobileFab label="+ Add Item" onClick={() => setEditing({ open: true, itemId: null })} />
      )}

      <ItemEditor
        open={editing.open}
        item={items.find((i) => i.id === editing.itemId) ?? null}
        locations={locations}
        onClose={() => setEditing({ open: false, itemId: null })}
      />

      {/* Edit cash / bank */}
      <MoneyEditor
        open={showMoney !== null}
        which={showMoney}
        finances={finances}
        onSave={(value) => {
          if (showMoney) setFinances({ [showMoney]: value });
          setShowMoney(null);
        }}
        onClose={() => setShowMoney(null)}
      />

      {/* Move one item */}
      <Modal
        open={showMove && selectedItem !== null}
        onClose={() => setShowMove(false)}
        title={`Move ${selectedItem?.name ?? 'item'}`}
        size="sm"
        footer={
          <GameButton variant="ghost" onClick={() => setShowMove(false)}>
            Cancel
          </GameButton>
        }
      >
        <NavList label="Choose a location">
          {sortedLocations
            .filter((l) => !l.virtual)
            .map((location) => (
              <NavListItem
                key={location.id}
                icon={location.icon}
                label={location.name}
                selected={location.id === selectedItem?.locationId}
                onSelect={() => {
                  if (selectedItem) moveItem(selectedItem.id, location.id);
                  setShowMove(false);
                }}
              />
            ))}
        </NavList>
      </Modal>

      {/* Move everything currently listed */}
      <Modal
        open={showBulkMove}
        onClose={() => setShowBulkMove(false)}
        title="Move items"
        description={`Moves all ${visibleItems.length} items currently listed under ${activeLocation?.name ?? ''}.`}
        size="sm"
        footer={
          <GameButton variant="ghost" onClick={() => setShowBulkMove(false)}>
            Cancel
          </GameButton>
        }
      >
        <NavList label="Choose a destination">
          {sortedLocations
            .filter((l) => !l.virtual && l.id !== activeLocation?.id)
            .map((location) => (
              <NavListItem
                key={location.id}
                icon={location.icon}
                label={`Move everything to ${location.name}`}
                onSelect={() => {
                  visibleItems.forEach((item) => moveItem(item.id, location.id));
                  setShowBulkMove(false);
                }}
              />
            ))}
        </NavList>
      </Modal>

      <ConfirmDialog
        open={confirmArchive}
        title="Archive this item?"
        body={
          <>
            <strong className="text-ivory">{selectedItem?.name}</strong> will be removed from your
            loadout and stop counting toward Total Assets. Nothing is deleted - archived items can
            be restored by editing them.
          </>
        }
        confirmLabel="Archive"
        onConfirm={() => {
          if (selectedItem) {
            archiveItem(selectedItem.id);
            setSelectedItemId(null);
          }
          setConfirmArchive(false);
        }}
        onCancel={() => setConfirmArchive(false)}
        alternative={
          selectedItem
            ? {
                label: 'Just mark it unchecked',
                onSelect: () => {
                  updateItem(selectedItem.id, { lastCheckedAt: null });
                  setConfirmArchive(false);
                },
              }
            : undefined
        }
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Money cards                                                         */
/* ------------------------------------------------------------------ */

function MoneyCard({
  icon,
  label,
  value,
  currency,
  hidden,
  onToggle,
  onEdit,
  derived,
  layout = 'inline',
}: {
  icon: string;
  label: string;
  value: number;
  currency: string;
  hidden: boolean;
  onToggle: () => void;
  onEdit?: () => void;
  derived?: string;
  /**
   * inline    label — value on one row (the approved desktop treatment)
   * stacked   value on its own line, so a narrow card cannot squeeze it away
   * headline  stacked at display size, for Total Assets on mobile
   */
  layout?: 'inline' | 'stacked' | 'headline';
}) {
  const Icon = iconFor(icon);

  return (
    <div className="relative rounded-[2px] border border-gold/30 bg-[var(--panel-fill)] px-3.5 py-2.5 backdrop-blur-[2px]">
      <span aria-hidden className="pointer-events-none absolute left-[3px] top-[3px] h-2.5 w-2.5 border-l border-t border-gold/50" />
      <span aria-hidden className="pointer-events-none absolute right-[3px] top-[3px] h-2.5 w-2.5 border-r border-t border-gold/50" />
      <span aria-hidden className="pointer-events-none absolute bottom-[3px] left-[3px] h-2.5 w-2.5 border-b border-l border-gold/50" />
      <span aria-hidden className="pointer-events-none absolute bottom-[3px] right-[3px] h-2.5 w-2.5 border-b border-r border-gold/50" />

      <div className="flex items-center gap-3">
        <Icon aria-hidden className="h-5 w-5 shrink-0 text-gold" strokeWidth={1.2} />

        <div className="min-w-0 flex-1">
          {layout !== 'inline' ? (
            <>
              <span className="block font-display text-base uppercase tracking-wider3 text-ivory">
                {label}
              </span>
              {/* Its own line, wrapping rather than truncating: a currency
                  value must never be clipped or squeezed to nothing. */}
              <span
                className={cn(
                  'mt-0.5 block break-words font-display leading-tight text-gold-bright',
                  layout === 'headline' ? 'text-3xl' : 'text-xl',
                )}
              >
                {hidden ? MASKED_VALUE : formatMoney(value, currency)}
              </span>
            </>
          ) : (
          <div className="flex items-baseline gap-2">
            <span className="min-w-0 truncate font-display text-base uppercase tracking-wider3 text-ivory">
              {label}
            </span>
            <span aria-hidden className="shrink-0 text-gold/50">
              —
            </span>
            {/* The figure never shrinks or truncates; if anything has to give
                at a narrow width it is the label, not the money. */}
            <span className="shrink-0 whitespace-nowrap font-display text-lg text-gold-bright">
              {hidden ? MASKED_VALUE : formatMoney(value, currency)}
            </span>
          </div>
          )}
          {derived && !hidden && (
            <p className="mt-0.5 truncate text-2xs text-ivory-faint" title={derived}>
              {derived}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              title={`Edit ${label}`}
              aria-label={`Edit ${label}`}
              className="rounded-[2px] px-1.5 py-0.5 text-2xs uppercase tracking-wider2 text-ivory-faint transition-colors duration-200 hover:text-ivory"
            >
              Edit
            </button>
          )}
          <button
            type="button"
            onClick={onToggle}
            aria-pressed={hidden}
            title={hidden ? `Show ${label}` : `Hide ${label}`}
            aria-label={hidden ? `Show ${label}` : `Hide ${label}`}
            className="inline-flex h-6 w-6 items-center justify-center rounded-[2px] text-gold transition-colors duration-200 hover:text-gold-bright"
          >
            {hidden ? (
              <EyeOff aria-hidden className="h-4 w-4" strokeWidth={1.3} />
            ) : (
              <Eye aria-hidden className="h-4 w-4" strokeWidth={1.3} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function MoneyEditor({
  open,
  which,
  finances,
  onSave,
  onClose,
}: {
  open: boolean;
  which: 'cash' | 'bank' | null;
  finances: { cash: number; bank: number; currency: string };
  onSave: (value: number) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState('0');
  const [error, setError] = useState('');

  const label = which === 'cash' ? 'Cash' : 'Bank';

  // Re-seed the field each time the dialog opens, so saving without typing
  // writes back the current balance rather than zero.
  useEffect(() => {
    if (!open || !which) return;
    setValue(String(finances[which]));
    setError('');
  }, [open, which, finances]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Edit ${label}`}
      description="Held locally in this browser. No account is connected and no credentials are ever requested."
      size="sm"
      footer={
        <>
          <GameButton variant="ghost" onClick={onClose}>
            Cancel
          </GameButton>
          <GameButton
            variant="primary"
            onClick={() => {
              const parsed = Number(value);
              if (!Number.isFinite(parsed) || parsed < 0) {
                setError('Enter a number of zero or more.');
                return;
              }
              setError('');
              onSave(Math.round(parsed * 100) / 100);
            }}
          >
            Save
          </GameButton>
        </>
      }
    >
      <label>
        <span className="field-label">{label} balance</span>
        <input
          className="field"
          type="number"
          min={0}
          step="0.01"
          autoFocus
          aria-invalid={Boolean(error)}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        {error && (
          <span role="alert" className="mt-1 block text-xs text-danger">
            {error}
          </span>
        )}
      </label>
    </Modal>
  );
}
