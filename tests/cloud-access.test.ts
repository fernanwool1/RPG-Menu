import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/cloud/config', () => ({ cloudEnabled: true }));
import { guardActions, setCloudWritable } from '@/cloud/access';

afterEach(() => { setCloudWritable(false); vi.unstubAllGlobals(); });
describe('cloud write guard', () => {
  it('blocks mutations before login and initial download', () => {
    vi.stubGlobal('navigator', { onLine: true });
    const action = vi.fn();
    guardActions({ completeQuest: action }).completeQuest();
    expect(action).not.toHaveBeenCalled();
  });
  it('blocks offline edits even if a form was already open', () => {
    vi.stubGlobal('navigator', { onLine: false }); setCloudWritable(true);
    const action = vi.fn();
    const state = guardActions({ logActivity: action });
    expect(state.logActivity()).toEqual(expect.objectContaining({ ok: false }));
    expect(action).not.toHaveBeenCalled();
  });
  it('permits online mutations and preserves return values', () => {
    vi.stubGlobal('navigator', { onLine: true }); setCloudWritable(true);
    const action = vi.fn(() => 'new-id');
    expect(guardActions({ addItem: action }).addItem()).toBe('new-id');
  });
  it('always allows exporting a recovery copy', () => {
    expect(guardActions({ exportData: () => 'backup' }).exportData()).toBe('backup');
  });
});
