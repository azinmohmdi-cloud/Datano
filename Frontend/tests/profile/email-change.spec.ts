import { expect, test } from "@playwright/test";
import { AxiosHeaders, type AxiosAdapter, type InternalAxiosRequestConfig } from "axios";
import { QueryClient } from "@tanstack/react-query";
import { AXIOS_INSTANCE } from "../../lib/fetcher";
import { ApiError } from "../../lib/api-error";
import { parseSession, sessionKey, sessionOptions } from "../../data/feature/session/session";
import { requestEmailChange, verifyEmailChange } from "../../data/feature/profile/email-change";
import { emailChangeFailure } from "../../components/feature/identity/ProfilePage/errors";

const initial = { id:'owner',first_name:'نام',last_name:'مالک',email:'old@example.test',is_active:true,effective_role:'User' };
const target = 'new@example.test'; const code = '01234567';
const original = AXIOS_INSTANCE.defaults.adapter; const clients:QueryClient[] = [];
test.afterEach(()=>{AXIOS_INSTANCE.defaults.adapter=original; for(const client of clients.splice(0)) client.clear();});
function client() {const result=new QueryClient();result.setQueryData(sessionKey,parseSession(initial));clients.push(result);return result;}
function response(config:InternalAxiosRequestConfig,payload:unknown,status=200) {
  return {config,status,statusText:'Test',headers:new AxiosHeaders(),data:{success:status===200,message:'private-server-text',payload}};
}
function adapter(reply:(config:InternalAxiosRequestConfig)=>ReturnType<typeof response>|Promise<ReturnType<typeof response>>) {
  AXIOS_INSTANCE.defaults.adapter=(async config=>config.url?.endsWith('/csrf')
    ? response(config,{csrf_token:'c'.repeat(43)}) : reply(config)) satisfies AxiosAdapter;
}
function loginPayload(role:string|null='User') {return {user:{...initial,email:target},effective_role:role,csrf_token:'d'.repeat(43)};}

test('request uses generated credentials/CSRF and canonical email, with no optimistic account update or mutation cache',async()=>{
  const cache=client(); const signal=new AbortController().signal; const writes:unknown[]=[];
  adapter(config=>{
    expect(config.signal).toBe(signal);expect(config.withCredentials).toBe(true);
    if(config.method==='post') {writes.push(JSON.parse(config.data));expect(config.headers.get('X-CSRF-Token')).toBe('c'.repeat(43));return response(config,null);}
    return response(config,initial);
  });
  await requestEmailChange(cache,initial.id,' NEW@EXAMPLE.TEST ',signal);
  expect(writes).toEqual([{email:target}]);expect(cache.getQueryData(sessionKey)).toEqual(parseSession(initial));
  expect(cache.getMutationCache().getAll()).toEqual([]);
});

for(const role of ['Admin','User',null]) test(`verified server role ${role} replaces public identity and clears all other private caches`,async()=>{
  const cache=client();cache.setQueryData(['private-old'],{secret:'old'});let writes=0;
  adapter(config=>{
    if(config.method==='post'){writes++;expect(JSON.parse(config.data)).toEqual({email:target,code});return response(config,loginPayload(role));}
    return response(config,initial);
  });
  const result=await verifyEmailChange(cache,initial.id,' NEW@EXAMPLE.TEST ',code,new AbortController().signal);
  expect(result).toEqual({...parseSession(initial),email:target,role});expect(writes).toBe(1);
  expect(cache.getQueryData(sessionKey)).toEqual(result);expect(cache.getQueryData(['private-old'])).toBeUndefined();
  const stored=JSON.stringify(cache.getQueryCache().getAll().map(query=>query.state.data));
  expect(stored).not.toContain(code);expect(stored).not.toContain('csrf_token');expect(stored).not.toContain('private-server-text');
  expect(cache.getMutationCache().getAll()).toEqual([]);
});

test('invalid proof 401 does not discard a still valid session or query instance',async()=>{
  const cache=client();const before=cache.getQueryData(sessionKey);const query=cache.getQueryCache().find({queryKey:sessionKey});let reads=0,writes=0;
  adapter(config=>{if(config.method==='post'){writes++;return response(config,null,401);}reads++;return response(config,initial);});
  await expect(verifyEmailChange(cache,initial.id,target,code,new AbortController().signal)).rejects.toMatchObject({status:401});
  expect(reads).toBe(2);expect(writes).toBe(1);expect(cache.getQueryData(sessionKey)).toBe(before);
  expect(cache.getQueryCache().find({queryKey:sessionKey})).toBe(query);
});

test('expired session during verification clears protected data and reconciles to anonymous',async()=>{
  const cache=client();cache.setQueryData(['private-old'],'old');let expired=false;
  adapter(config=>{if(config.method==='post') expired=true;return response(config,expired?null:initial,expired?401:200);});
  await expect(verifyEmailChange(cache,initial.id,target,code,new AbortController().signal)).rejects.toMatchObject({status:401});
  expect(cache.getQueryData(sessionKey)).toBeNull();expect(cache.getQueryData(['private-old'])).toBeUndefined();
});

test('a different cookie owner is reconciled before any email can be sent',async()=>{
  const cache=client();cache.setQueryData(['private-old'],'old');let writes=0;
  adapter(config=>{if(config.method==='post')writes++;return response(config,{...initial,id:'another'});});
  await expect(requestEmailChange(cache,initial.id,target,new AbortController().signal)).rejects.toMatchObject({kind:'protocol'});
  expect(writes).toBe(0);expect(cache.getQueryData(sessionKey)).toMatchObject({id:'another'});expect(cache.getQueryData(['private-old'])).toBeUndefined();
});

for(const payload of [null,{...loginPayload(),user:{...initial,id:'other',email:target}},
  {...loginPayload(),user:{...initial,email:'wrong@example.test'}},{...loginPayload(),effective_role:'invented'},
  {...loginPayload(),user:{...initial,email:target,is_active:false}}]) test(`malformed verification result cannot poison cache: ${JSON.stringify(payload)}`,async()=>{
  const cache=client();adapter(config=>response(config,config.method==='post'?payload:initial));
  await expect(verifyEmailChange(cache,initial.id,target,code,new AbortController().signal)).rejects.toMatchObject({kind:'protocol'});
  expect(cache.getQueryData(sessionKey)).toEqual(parseSession(initial));
});

for(const status of [403,409,422,429,503]) test(`HTTP ${status} is not retried and preserves original cached account`,async()=>{
  const cache=client();let writes=0;adapter(config=>{if(config.method==='post')writes++;return response(config,config.method==='post'?null:initial,config.method==='post'?status:200);});
  await expect(verifyEmailChange(cache,initial.id,target,code,new AbortController().signal)).rejects.toMatchObject({status});
  expect(writes).toBe(1);expect(cache.getQueryData(sessionKey)).toEqual(parseSession(initial));
});

for(const sameOwner of [false,true]) test(`late proof response cannot restore a replaced query, same owner=${sameOwner}`,async()=>{
  const cache=client();let finish:()=>void=()=>{},started:()=>void=()=>{};const ready=new Promise<void>(resolve=>{started=resolve;});
  adapter(config=>config.method==='post'?new Promise(resolve=>{finish=()=>resolve(response(config,loginPayload()));started();}):response(config,initial));
  const operation=verifyEmailChange(cache,initial.id,target,code,new AbortController().signal);const rejected=expect(operation).rejects.toMatchObject({kind:'protocol'});
  await ready;cache.clear();const replacement=parseSession({...initial,id:sameOwner?initial.id:'other'});cache.setQueryData(sessionKey,replacement);
  finish();await rejected;expect(cache.getQueryData(sessionKey)).toEqual(replacement);
});

test('stale session reads are cancelled before publishing verified email',async()=>{
  const cache=client();let first=true,aborted=false,release:()=>void=()=>{};
  adapter(config=>{
    if(config.method==='post')return response(config,loginPayload());
    if(!first)return response(config,initial);first=false;config.signal?.addEventListener?.('abort',()=>{aborted=true;});
    return new Promise(resolve=>{release=()=>resolve(response(config,initial));});
  });
  const read=cache.fetchQuery(sessionOptions(cache)).catch(()=>undefined);
  await verifyEmailChange(cache,initial.id,target,code,new AbortController().signal);release();await read;
  expect(aborted).toBe(true);expect(cache.getQueryData(sessionKey)).toMatchObject({email:target});
});

test('early abort and in-flight cancellation cannot publish a verification result',async()=>{
  const cache=client();const early=new AbortController();early.abort();let calls=0;
  adapter(config=>{calls++;return response(config,initial);});
  await expect(requestEmailChange(cache,initial.id,target,early.signal)).rejects.toMatchObject({name:'AbortError'});expect(calls).toBe(0);
  const controller=new AbortController();let finish:()=>void=()=>{},started:()=>void=()=>{};const ready=new Promise<void>(resolve=>{started=resolve;});
  adapter(config=>{
    expect(config.signal).toBe(controller.signal);
    return config.method==='post'?new Promise(resolve=>{finish=()=>resolve(response(config,loginPayload()));started();}):response(config,initial);
  });
  const operation=verifyEmailChange(cache,initial.id,target,code,controller.signal);const rejected=expect(operation).rejects.toBeDefined();
  await ready;controller.abort();finish();await rejected;expect(cache.getQueryData(sessionKey)).toEqual(parseSession(initial));
});

test('ambiguous network result reads actual identity but never automatically replays proof',async()=>{
  const cache=client();cache.setQueryData(['private-old'],'old');let changed=false,writes=0;
  adapter(config=>{if(config.method==='post'){changed=true;writes++;throw new ApiError('private-provider','network');}
    return response(config,changed?{...initial,email:target}:initial);});
  await expect(verifyEmailChange(cache,initial.id,target,code,new AbortController().signal)).rejects.toMatchObject({kind:'network'});
  expect(writes).toBe(1);expect(cache.getQueryData(sessionKey)).toMatchObject({email:target});expect(cache.getQueryData(['private-old'])).toBeUndefined();
});

test('error messages are Persian, fixed and respect Retry-After without exposing server content',()=>{
  for(const status of [401,403,409,422,429,500,503]){
    const failure=emailChangeFailure(new ApiError('private-secret','http',{raw:'private-secret'},status,undefined,'120'),true);
    expect(failure.message).not.toContain('private-secret');expect(failure.message).toMatch(/[آ-ی]/);
    if(status===429)expect(failure.retryAfter).toBe(120);
    if(status===401)expect(failure.codeRejected).toBe(true);
  }
});
