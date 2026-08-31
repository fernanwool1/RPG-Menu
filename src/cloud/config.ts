// Public configuration only. Never put a service-role key in a browser build.
export const cloudEnabled = process.env.NEXT_PUBLIC_SYNC_MODE === 'cloud'
  || Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

