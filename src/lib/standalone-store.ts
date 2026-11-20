import type { Wallet } from './wallet';

export type StoredUser = {
  player_id: string;
  balance: number;
  votes: number;
  updated_at: string;
  username: string | null;
  lastVote: number;
};
export type StoredEvent = {
  id: string; event_type: string; title: string; image_url: string | null;
  sound_url: string | null; payload: Record<string, unknown>; starts_at: string;
  ends_at: string; active: boolean; created_at: string;
};
export type AuditEntry = { created_at: string; action: string; target_player?: string; details?: unknown };

// Process-local storage: deliberately no SQL, Supabase, or external database.
// On serverless hosting this resets when the worker instance is replaced.
const users = new Map<string, StoredUser>();
const events: StoredEvent[] = [];
const audit: AuditEntry[] = [];
const failedLogins = new Map<string, { count: number; until: number }>();
let globalVotes = 0;

export function getUser(id: string, initial?: Wallet): StoredUser {
  let user = users.get(id);
  if (!user) {
    user = { player_id: id, balance: initial?.balance ?? 0, votes: initial?.votes ?? 0, updated_at: new Date().toISOString(), username: null, lastVote: 0 };
    users.set(id, user);
  }
  return user;
}
export function allUsers() { return [...users.values()].sort((a,b) => b.balance-a.balance).slice(0,200); }
export function findUser(id: string) { return users.get(id); }
export function usernameTaken(name: string, exceptId: string) { return [...users.values()].some(u => u.player_id !== exceptId && u.username?.toLowerCase() === name.toLowerCase()); }
export function leaderboard(id: string) { return [...users.values()].sort((a,b)=>b.balance-a.balance).slice(0,10).map(u=>({name:u.username ?? 'Anonymous',tokens:u.balance,you:u.player_id===id})); }
export function vote(id: string): boolean {
  const user = getUser(id);
  const now = Date.now();
  if (now - user.lastVote < 24 * 60 * 60 * 1000) return false;
  user.lastVote = now; user.votes = Math.min(999, user.votes + 1); user.updated_at = new Date().toISOString(); globalVotes++;
  return true;
}
export function getGlobalVotes() { return globalVotes; }
export function listEvents() { return events.filter(e=>e.active && Date.parse(e.ends_at)>Date.now()); }
export function allEvents() { return [...events].reverse().slice(0,30); }
export function addEvent(input: Omit<StoredEvent,'id'|'created_at'>) {
  const event: StoredEvent = { ...input, id: crypto.randomUUID(), created_at: new Date().toISOString() }; events.push(event); return event;
}
export function stopEvent(id: string) { const event=events.find(e=>e.id===id); if(!event)return false; event.active=false; event.ends_at=new Date().toISOString(); return true; }
export function addAudit(entry: Omit<AuditEntry,'created_at'>) { audit.push({ ...entry, created_at:new Date().toISOString() }); if(audit.length>500)audit.shift(); }
export function allAudit() { return [...audit].reverse().slice(0,30); }
export function loginBlocked(ip: string) { const x=failedLogins.get(ip); return !!x && x.until>Date.now() && x.count>=5; }
export function loginFailed(ip: string) { const x=failedLogins.get(ip); const next={count:(x?.until && x.until>Date.now()?x.count:0)+1,until:Date.now()+15*60*1000}; failedLogins.set(ip,next); }
export function loginSucceeded(ip: string) { failedLogins.delete(ip); }
