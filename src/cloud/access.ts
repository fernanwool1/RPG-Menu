import { cloudEnabled } from './config';

let writable = false;
export function setCloudWritable(value: boolean) { writable = value; }
export function canWrite() {
  return !cloudEnabled || (writable && typeof navigator !== 'undefined' && navigator.onLine);
}

/** Gate actions, not just buttons: timers and already-open forms must obey offline mode too. */
export function guardActions<T extends object>(state: T): T {
  const resultActions = new Set(['importData', 'logActivity', 'replaceDailyQuest',
    'addDailyCheckEntry', 'correctDailyCheckEntry', 'completeDailyCheck', 'setDailyQuestPinned']);
  return Object.fromEntries(Object.entries(state).map(([key, value]) => [key,
    typeof value !== 'function' || key === 'exportData' ? value : (...args: unknown[]) => {
      if (canWrite()) return value(...args);
      return resultActions.has(key)
        ? { ok: false, error: 'Connect and wait for synchronization before making changes.' } : null;
    },
  ])) as T;
}
