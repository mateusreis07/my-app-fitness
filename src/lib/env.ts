export type SupabaseConfig = { url: string; publishableKey: string };
export type ConfigResult =
  { status: 'missing' } | { status: 'invalid' } | { status: 'ready'; config: SupabaseConfig };

// Accept only the new public key format. A server secret must never enter the bundle.
export function parseSupabaseConfig(url?: string, key?: string): ConfigResult {
  const cleanUrl = url?.trim();
  const cleanKey = key?.trim();
  if (!cleanUrl && !cleanKey) return { status: 'missing' };
  if (!cleanUrl || !cleanKey || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(cleanKey)) {
    return { status: 'invalid' };
  }
  try {
    const parsed = new URL(cleanUrl);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
    if (
      (parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      parsed.pathname !== '/'
    )
      return { status: 'invalid' };
    return { status: 'ready', config: { url: parsed.origin, publishableKey: cleanKey } };
  } catch {
    return { status: 'invalid' };
  }
}

export function getSupabaseConfig(): ConfigResult {
  // Expo replaces direct EXPO_PUBLIC accesses during bundling.
  return parseSupabaseConfig(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
