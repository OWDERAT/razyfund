import { supabase } from '@/integrations/supabase/client';
import { signupUsernameSchema } from './access-rules';

export const accountBridge = {
  async token() { const { data } = await supabase.auth.getSession(); return data.session?.access_token; },
  async user() { const { data } = await supabase.auth.getUser(); return data.user ? { id: data.user.id } : null; },
  // Username-only account: an anonymous Supabase session whose profile name comes from the metadata below.
  // (Needs "Allow anonymous sign-ins" switched on in the Supabase auth settings.)
  async createUsername(username: string) {
    const parsed = signupUsernameSchema.safeParse(username);
    if (!parsed.success) return { error: 'Use 3–20 letters, numbers, dots, dashes or underscores (some names are reserved).' };
    const { data: current } = await supabase.auth.getSession();
    if (current.session) return { error: 'This browser already has an account.' };
    const { error } = await supabase.auth.signInAnonymously({ options: { data: { username: parsed.data } } });
    if (!error) return { error: null };
    const code = (error as { code?: string }).code ?? '';
    const status = (error as { status?: number }).status ?? 0;
    if (code === 'anonymous_provider_disabled' || /anonymous/i.test(error.message)) return { error: 'Username accounts are not switched on yet. The site owner needs to enable anonymous sign-ins.' };
    if (status === 429 || code.includes('rate_limit')) return { error: 'Too many accounts from your network. Try again later.' };
    return { error: 'That username is taken or unavailable. Try another.' };
  },
  async signup(username: string, email: string, password: string) {
    if (!signupUsernameSchema.safeParse(username).success) return { error: 'Username must be 3–20 letters, numbers, dots, dashes or underscores.' };
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { username }, emailRedirectTo: window.location.origin } });
    return { error: error ? 'Could not create account. Check your details or choose another username.' : null, confirmed: !!data.session };
  },
  async signin(email: string, password: string) { const { error } = await supabase.auth.signInWithPassword({ email, password }); return { error: error ? 'Sign-in failed. Check your email, password and confirmation email.' : null }; },
  async signout() { await supabase.auth.signOut(); },
  async reset(email: string) { const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` }); return { error: error ? 'Could not send reset email. Try again shortly.' : null }; },
  watchEvents(callback: () => void) {
    const channel = supabase.channel(`razy-events-${crypto.randomUUID()}`).on('postgres_changes', { event: '*', schema: 'public', table: 'site_events' }, callback).subscribe();
    return () => { void supabase.removeChannel(channel); };
  },
};

declare global { interface Window { razyAccounts?: typeof accountBridge } }
