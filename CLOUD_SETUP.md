# Online-only device sync

The app now supports Supabase email-code sign-in and account-owned cloud saves.
It remains local-only unless cloud environment variables are configured. No local
progress is automatically uploaded. There is no offline edit queue.

## Connect your Supabase project

1. Create a Supabase project in your own account. Keep its database password private.
2. Run `supabase/migrations/202608270001_menu_sync.sql` once in its SQL editor.
   This creates the save table, owner-only read policy, and atomic save function.
3. Enable Email authentication. In the **Magic Link** email template, include
   `{{ .Token }}` instead of a confirmation link so users receive a code they can
   enter directly in the app. Configure your own SMTP provider for delivery beyond
   Supabase's restricted default mail service; review its current delivery limits.
4. Copy `.env.example` to `.env.local` and set your project URL and **publishable
   key** (the legacy anon key also works). Never use a service-role/secret key.
5. Restart `npm run dev`. For a hosted build, set the same public variables in the
   host's environment **before building**. Use HTTPS and the same URL on all devices.
6. Sign in with the same email on each device. On a new account, choose an empty
   character, sample data, or explicitly upload the existing browser save.

No cloud project, email provider, or hosting deployment has been provisioned by
the code changes. The public key is intentionally visible in the browser; access
control depends on Supabase Auth, SQL grants, and row-level security.

## Signing in

Sign-in is a two-step email code, rendered by `CloudBoundary` in place — there
is no `/login` route and no redirect, so there is nothing to loop through and
only one guard.

1. **Continue your journey.** — enter an email, get a code. New and returning
   people use the same door; the first verification creates the account.
2. **Check your email.** — enter the 6-digit code. The destination address is
   masked, the code field takes only digits, and resending is throttled for 45
   seconds (or for however long Supabase asks, when it names a delay).

Provider errors are translated, never relayed verbatim: a wrong or expired code,
a rate limit, a project that has email sign-in switched off, and a request that
never reached Supabase each get their own sentence.

Nothing is visible from the account until the session **and** the first download
have both finished, and the first-run choice (upload this browser's save / start
empty / sample data) is unchanged.

### Checks that need a live project

The following cannot be exercised without your own Supabase project configured,
and were **not** verified here:

- A real code actually arriving by email, and the SMTP path behind it.
- Supabase's genuine rate-limit thresholds and wording.
- Session restoration across a browser restart with a real refresh token.
- The `save_menu` RPC, its revision conflict path, and row-level security.

What was verified locally: the full two-step UI, the client-side validation, a
genuine connection failure, an expired-code rejection, the resend cooldown, the
hand-off from a successful verification into the sync step, sign-out returning
to step one, and local-only mode when no cloud variables are set.

## Existing progress

- Export a backup from the original local app first.
- Automatic detection works only on the same browser **and origin** as the old app.
  `localhost`, `127.0.0.1`, and a hosted domain are different origins.
- The upload button names the data being transferred, including inventory,
  financial amounts, notes, and sensitive identifiers. It is only offered before
  the account has its first cloud save. The original localStorage value is preserved.
- If your new URL cannot see the old browser save, start empty online, then use
  Character → Export, import or reset → Import to import the exported JSON.
- Import and reset replace the **shared account data across all devices**, not just
  the device being used. Export before either action. Import is validated first.
- Cloud character data is kept in memory, not persisted to the old local save.
  The authentication session is remembered in browser storage; sign out on shared devices.

## Behavior and limitations

- Each user has one versioned JSON document. Quest completion and its XP ledger
  update commit atomically. The SQL function uses the authenticated identity;
  callers cannot choose another user's ID or write the table directly.
- Changes save immediately (synchronous changes in the same event are batched).
  Other devices check for updates every five seconds and on window focus.
- This first version does **not** automatically merge concurrent edits. The first
  save wins; a stale second save is rejected. Reload cloud data and repeat the edit
  if needed. An unconfirmed snapshot can be downloaded for recovery.
- A lost response is not blindly retried: it may have already committed. Reload
  the cloud copy and inspect it before repeating the action, avoiding duplicate XP.
- Offline, failed, and unauthenticated states block editing. A network failure
  after a click is reported as an unconfirmed save, never as a successful save.
- Keep the page open until it says **Saved online**. The app warns before unloading
  with an in-flight save/recovery copy, but browser termination cannot be prevented.
- The document has a 10 MB server limit. This model is intended for a personal
  first version, not high-frequency collaborative editing or large file storage.
- Daily resets currently use each device's local timezone. Keep devices in the
  same timezone for predictable Daily Quest dates. A shared account timezone is
  a future improvement.
- The database checks the envelope and size; the app checks full nested structure
  before loading/saving. This is a personal tracker, not an anti-cheat system.

## Verification before relying on it

Local automated tests cover the sync engine, import validation and mutation guard,
and execute the migration in in-memory PostgreSQL to verify account isolation,
revision conflicts, idempotent commits and denied anonymous/direct writes.
The actual hosted service still needs this acceptance test after configuration:

1. Sign in on two devices; add a quest and wait for Saved online. Confirm it appears
   on the other device within five seconds or after focusing that window.
2. Complete the same quest on both devices before synchronization. Confirm one
   save conflicts and only one payout exists after reloading.
3. Disconnect a device. Confirm edits are blocked; reconnect and confirm it reloads.
4. Interrupt a save. Verify the unconfirmed-save message and recovery export.
5. Sign out, then sign in as a different test user. Verify no previous character
   is visible. Verify user B cannot select user A's row via the Data API and that
   direct table writes and anonymous calls to `save_menu` are denied.
6. Verify local export/import migration and that the original local save remains.

Reference: [Email OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless),
[row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security),
[database function security](https://supabase.com/docs/guides/database/functions).

## Dependency maintenance

Next.js and its ESLint configuration were patched to the 15.5.24 release line.
The PostCSS override selects the patched 8.5.26+ implementation rather than Next's
older pinned copy. Sharp was refreshed within Next's supported dependency range.
Keep the lockfile and rerun build/tests when changing these versions.
