import { describe, it, expect, vi } from 'vitest';

// ── H-4 — Local Mode boot recovery ──────────────────────────
// In Local Mode (`isSupabaseConfigured === false`) the `supabase` client is
// literally `null`. Before the fix, loadSystemSettings() called
// `supabase.from(...)` unconditionally → TypeError, which aborted app init
// and made the app fall to /login. The guard must short-circuit and return
// the default settings WITHOUT touching the null client.

vi.mock('../supabase', () => ({
  isSupabaseConfigured: false,
  supabase: null,
}));

import { loadSystemSettings, saveSystemSettings } from '../systemSettings';

describe('H-4 — systemSettings in Local Mode', () => {
  it('loadSystemSettings returns DEFAULT_SETTINGS when Supabase is not configured', async () => {
    // Must NOT throw (the bug was a TypeError on null.from(...))
    const settings = await loadSystemSettings();
    expect(settings).toEqual({ projectCreationPolicy: 'all' });
  });

  it('saveSystemSettings is a no-op (does not throw) when Supabase is not configured', async () => {
    await expect(
      saveSystemSettings({ projectCreationPolicy: 'admin_only' }),
    ).resolves.toBeUndefined();
  });
});
