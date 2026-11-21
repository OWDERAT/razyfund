import { supabase } from '@/integrations/supabase/client';
import { usernameSchema } from './access-rules';

export const accountBridge = {
  async token() { const { data } = await supabase.auth.getSession(); return data.session?.access_token; },
  async user() { const { data } = await supabase.auth.getUser(); return data.user ? { id: data.user.id } : null; },
  async signup(username: string, email: string, password: string) {
    if (!usernameSchema.safeParse(username).success) return { error: 'Username must be 3–20 letters, numbers, dots, dashes or underscores.' };
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
