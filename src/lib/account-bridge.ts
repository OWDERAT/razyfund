import { supabase } from '@/integrations/supabase/client';
import { signupUsernameSchema } from './access-rules';
import { usernameAddress } from './username-account';

export const accountBridge = {
  async token() { const { data } = await supabase.auth.getSession(); return data.session?.access_token; },
  async user() { const { data } = await supabase.auth.getUser(); return data.user ? { id: data.user.id } : null; },
  async createUsername(username: string, password: string) {
    const parsed = signupUsernameSchema.safeParse(username.normalize('NFKC'));
    if (!parsed.success) return { error: 'Use 3–20 letters, numbers, dots, dashes or underscores (some names are reserved).' };
    if (password.length < 12 || password.length > 256) return { error: 'Use a password between 12 and 256 characters.' };
    const { data: current } = await supabase.auth.getUser();
    if (current.user) return { error: 'Sign out before creating another account.' };
    const { data, error } = await supabase.auth.signUp({ email: await usernameAddress(parsed.data), password, options: { data: { username: parsed.data }, emailRedirectTo: window.location.origin } });
    if (!error) return { error: data.session ? null : 'Account created, but sign-in is unavailable. Please contact the site owner.' };
    const code = (error as { code?: string }).code ?? '';
    const status = (error as { status?: number }).status ?? 0;
    if (status === 429 || code.includes('rate_limit')) return { error: 'Too many accounts from your network. Try again later.' };
    return { error: 'That username is taken or unavailable. Try another.' };
  },
  async signinUsername(username: string, password: string) {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: await usernameAddress(username), password });
      return { error: error ? 'Sign-in failed. Check your original username and password.' : null };
    } catch { return { error: 'Enter a valid username.' }; }
  },
  async signout() { const { error } = await supabase.auth.signOut(); return { error: error ? 'Could not sign out. Try again.' : null }; },
  watchEvents(callback: () => void) {
    const channel = supabase.channel(`razy-events-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_events' }, callback)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scoobert_votes' }, callback)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wallet_accounts' }, callback)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, callback).subscribe();
    return () => { void supabase.removeChannel(channel); };
  },
};

declare global { interface Window { razyAccounts?: typeof accountBridge } }
