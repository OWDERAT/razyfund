import { createFileRoute } from '@tanstack/react-router';
import { addAudit, addEvent, allAudit, allEvents, allUsers, findUser, loginBlocked, loginFailed, loginSucceeded, stopEvent, usernameTaken } from '@/lib/standalone-store';

const COOKIE='razy_admin';
const enc=new TextEncoder();
const b64=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unb64=(value:string)=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const readCookie=(r:Request)=>(r.headers.get('cookie')??'').split(/;\s*/).find(v=>v.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
const originOkay=(r:Request)=>r.headers.get('origin')===new URL(r.url).origin;
const json=(data:unknown,status=200,headers?:HeadersInit)=>{const h=new Headers(headers);h.set('content-type','application/json');h.set('cache-control','no-store');return new Response(JSON.stringify(data),{status,headers:h});};
function adminSecret(){return process.env['ADMIN_SESSION_SECRET']||process.env['WALLET_SECRET']||'';}
async function key(){const s=adminSecret();if(s.length<32)throw new Error('ADMIN_SESSION_SECRET or WALLET_SECRET must be at least 32 characters');return crypto.subtle.importKey('raw',enc.encode(s),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
async function makeSession(){const body=b64(enc.encode(String(Date.now())));const sig=new Uint8Array(await crypto.subtle.sign('HMAC',await key(),enc.encode(body)));return `${body}.${b64(sig)}`;}
async function validSession(r:Request){try{const [body,sig]=(readCookie(r)??'').split('.');if(!body||!sig)return false;const ok=await crypto.subtle.verify('HMAC',await key(),unb64(sig),enc.encode(body));const issued=Number(new TextDecoder().decode(unb64(body)));return ok&&Number.isFinite(issued)&&issued<=Date.now()&&Date.now()-issued<4*60*60*1000;}catch{return false;}}
async function verifyPassword(password:string){const encoded=process.env['ADMIN_PASSWORD_HASH'];if(!encoded)return false;const [saltText,hashText]=encoded.split('.');if(!saltText||!hashText)return false;try{const material=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);const bits=new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:unb64(saltText),iterations:310000,hash:'SHA-256'},material,256));const expected=unb64(hashText);if(bits.length!==expected.length)return false;let diff=0;for(let i=0;i<bits.length;i++)diff|=bits[i]!^expected[i]!;return diff===0;}catch{return false;}}

export const Route=createFileRoute('/api/admin')({server:{handlers:{
 GET:async({request})=>{
  if(!(await validSession(request)))return json({error:'unauthorized'},401);
  return json({users:allUsers().map(u=>({player_id:u.player_id,balance:u.balance,votes:u.votes,updated_at:u.updated_at,user_profiles:{username:u.username}})),events:allEvents(),audit:allAudit()});
 },
 POST:async({request})=>{
  if(!originOkay(request))return json({error:'forbidden'},403);
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
  if(!body||typeof body.action!=='string')return json({error:'invalid_request'},400);
  if(body.action==='logout')return json({ok:true},200,{'set-cookie':`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`});
  if(body.action==='login'){
   const ip=request.headers.get('cf-connecting-ip')??request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()??'unknown';
   if(loginBlocked(ip))return json({error:'too_many_attempts'},429);
   const password=typeof body.password==='string'?body.password:'';
   if(!password||password.length>256||!(await verifyPassword(password))){loginFailed(ip);return json({error:'invalid_credentials'},401);}
   loginSucceeded(ip);return json({ok:true},200,{'set-cookie':`${COOKIE}=${await makeSession()}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=14400`});
  }
  if(!(await validSession(request)))return json({error:'unauthorized'},401);
  if(body.action==='adjust_tokens'){
   const id=typeof body.player_id==='string'?body.player_id:'';const amount=Number(body.amount);const mode=String(body.mode);
   if(!/^[0-9a-f-]{36}$/i.test(id)||!Number.isSafeInteger(amount)||amount<0||amount>10000000||!['add','remove','set'].includes(mode))return json({error:'invalid_values'},400);
   const user=findUser(id);if(!user)return json({error:'user_not_found'},404);
   user.balance=Math.max(0,Math.min(10000000,mode==='set'?amount:mode==='add'?user.balance+amount:user.balance-amount));user.updated_at=new Date().toISOString();addAudit({action:'adjust_tokens',target_player:id,details:{mode,amount,new_balance:user.balance}});
  } else if(body.action==='rename_user'){
   const id=typeof body.player_id==='string'?body.player_id:'';const name=typeof body.username==='string'?body.username.replace(/[^\p{L}\p{N}_.-]/gu,'').slice(0,20):'';
   if(!/^[0-9a-f-]{36}$/i.test(id)||name.length<3)return json({error:'invalid_values'},400);
   const user=findUser(id);if(!user)return json({error:'user_not_found'},404);if(usernameTaken(name,id))return json({error:'username_taken'},409);
   user.username=name;user.updated_at=new Date().toISOString();addAudit({action:'rename_user',target_player:id,details:{username:name}});
  } else if(body.action==='create_event'){
   const type=String(body.event_type??'');const title=typeof body.title==='string'?body.title.slice(0,100):'';const image=typeof body.image_url==='string'?body.image_url:null;const sound=typeof body.sound_url==='string'?body.sound_url:null;
   const valid=(v:string|null)=>!v||(v.length<=2048&&/^https:\/\//i.test(v));const duration=Number(body.duration_minutes??10);const count=Number(body.count??14);
   if(!['rain','announcement','banner','maintenance'].includes(type)||!valid(image)||!valid(sound)||(type==='rain'&&!image))return json({error:'invalid_event'},400);
   if(!Number.isInteger(duration)||duration<1||duration>1440||!Number.isInteger(count)||count<1||count>35)return json({error:'invalid_event_settings'},400);
   const now=new Date();const event=addEvent({event_type:type,title,image_url:image,sound_url:sound,payload:{count},starts_at:now.toISOString(),ends_at:new Date(now.getTime()+duration*60000).toISOString(),active:true});addAudit({action:'create_event',details:{event_id:event.id,event_type:type}});
  } else if(body.action==='stop_event'){
   const id=typeof body.event_id==='string'?body.event_id:'';if(!stopEvent(id))return json({error:'event_not_found'},404);addAudit({action:'stop_event',details:{event_id:id}});
  } else return json({error:'unknown_action'},400);
  return json({ok:true});
 }
}}});
