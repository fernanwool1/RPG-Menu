import { buildEmptyBundle } from '@/domain/seed';
import { nowIso } from '@/domain/ids';
import { runMigrations, SCHEMA_VERSION } from '@/store/persistence';
import { snapshotSchema, type CloudSnapshot } from './schema';

export function emptyCloudSnapshot(): CloudSnapshot {
  return snapshotSchema.parse({ schemaVersion: SCHEMA_VERSION, initialized: false, data: {
    ...buildEmptyBundle(nowIso()), dailyInstances: [], dailySelections: [], dailyChecks: [],
    dailyHistory: [], dailyActiveDate: null,
  } });
}

export function legacySnapshot(raw: string): CloudSnapshot {
  const envelope = JSON.parse(raw);
  if (!envelope || !Number.isInteger(envelope.version) || envelope.version > SCHEMA_VERSION
    || envelope.version < 1 || !envelope.state?.initialized) {
    throw new Error('No supported, initialized local save was found. Your original data was not changed.');
  }
  return snapshotSchema.parse({ schemaVersion: SCHEMA_VERSION, initialized: true,
    data: { ...emptyCloudSnapshot().data, ...runMigrations(envelope.state, envelope.version) as object } });
}
