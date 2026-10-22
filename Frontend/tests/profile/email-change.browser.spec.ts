import { readFileSync } from "node:fs";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { isRecord } from "../../lib/api-error";

const origin = 'http://127.0.0.1:3100';
function settings() {
  const api=process.env.DATANO_EMAIL_CHANGE_API_URL;
  const capture=process.env.DATANO_EMAIL_CHANGE_CAPTURE_PATH;
  if(!api||!capture)throw new Error('Dedicated disposable backend and capture path required');
  return {api,capture};
}
async function register(context:BrowserContext,email:string,password:string) {
  const {api}=settings();const csrf=await context.request.get(`${api}/api/auth/csrf`,{headers:{Origin:origin}});
  expect(csrf.status()).toBe(200);
  const created=await context.request.post(`${api}/api/auth/register`,{headers:{Origin:origin,'X-CSRF-Token':(await csrf.json()).payload.csrf_token},
    data:{first_name:'کاربر',last_name:'آزمایش',email,password}});
  expect(created.status()).toBe(201);
}
async function login(page:Page,email:string,password:string) {
  await page.goto('/login?returnTo=%2Fprofile');await page.getByLabel('ایمیل',{exact:true}).fill(email);
  await page.getByLabel('رمز عبور',{exact:true}).fill(password);
  await page.getByRole('button',{name:'ورود به حساب',exact:true}).click();await expect(page).toHaveURL('/profile');
}
function capturedCode(email:string):string|undefined {
  const data:unknown=JSON.parse(readFileSync(settings().capture,'utf8'));
  if(!isRecord(data)||typeof data[email]!=='string')return undefined;
  return data[email].match(/[0-9]{8}/)?.[0];
}
async function requestCode(page:Page,email:string) {
  await page.getByLabel('ایمیل جدید',{exact:true}).fill(email);
  await page.getByRole('button',{name:'ادامه برای تأیید',exact:true}).click();
  await expect(page.getByLabel('کد تأیید ایمیل',{exact:true})).toBeVisible();
  await expect.poll(()=>Boolean(capturedCode(email))).toBe(true);
  const code=capturedCode(email);if(!code)throw new Error('Test mail not captured');return code;
}

test('real mailbox proof persists, rotates cookie, grants and removes Admin, and navigation follows fresh server identity',async({page,context},testInfo)=>{
  const {api}=settings();const email=`fe033-${crypto.randomUUID()}@example.test`;
  const password=`Email fixture ${crypto.randomUUID()}`;const adminTarget=`admin-${testInfo.project.name}-fe033@example.test`;
  const finalTarget=`final-${crypto.randomUUID()}@example.test`;
  await register(context,email,password);await login(page,email,password);
  const before=(await context.cookies()).find(cookie=>cookie.name==='datano_session_dev')?.value;
  expect(Boolean(before)).toBe(true);
  const code=await requestCode(page,adminTarget);
  await expect(page.locator('[data-profile-current-email]')).toHaveText(email);
  await page.getByLabel('کد تأیید ایمیل',{exact:true}).fill(code);
  const verified=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/auth/email-change/verify');
  await page.getByRole('button',{name:'تأیید ایمیل جدید',exact:true}).click();expect((await verified).status()).toBe(200);
  await expect(page.getByText('ایمیل شما تغییر کرد.',{exact:true})).toBeVisible();
  await expect(page.locator('[data-profile-current-email]')).toHaveText(adminTarget);
  const fresh=(await context.cookies()).find(cookie=>cookie.name==='datano_session_dev')?.value;
  expect(Boolean(fresh)&&fresh!==before).toBe(true);
  const identity=await context.request.get(`${api}/api/auth/me`);expect(identity.status()).toBe(200);
  expect((await identity.json()).payload.effective_role).toBe('Admin');
  const revoked=await context.request.get(`${api}/api/auth/me`,{headers:{Cookie:`datano_session_dev=${before}`}});expect(revoked.status()).toBe(401);
  await page.goto('/account?role=User');await expect(page).toHaveURL('/admin/users');
  await page.goto('/profile');const nextCode=await requestCode(page,finalTarget);
  await page.getByLabel('کد تأیید ایمیل',{exact:true}).fill(nextCode);
  await page.getByRole('button',{name:'تأیید ایمیل جدید',exact:true}).click();
  await expect(page.locator('[data-profile-current-email]')).toHaveText(finalTarget);
  const downgraded=await context.request.get(`${api}/api/auth/me`);expect((await downgraded.json()).payload.effective_role).toBe('User');
  await page.goto('/admin/users');await expect(page).toHaveURL('/profile');
  await page.goto('/account?role=Admin');await expect(page).toHaveURL('/profile');
  await page.reload();await expect(page.locator('[data-profile-current-email]')).toHaveText(finalTarget);
  await page.getByRole('button',{name:'خروج از حساب',exact:true}).click();
  await page.getByRole('button',{name:'تأیید خروج',exact:true}).click();await expect(page).toHaveURL('/login');
  await login(page,finalTarget,password);
  await expect(page.locator('[data-profile-current-email]')).toHaveText(finalTarget);
  expect(await page.evaluate(()=>({local:{...localStorage},session:{...sessionStorage}}))).toEqual({local:{},session:{}});
});

test('actual invalid proof preserves code/name drafts and a concurrent target claim produces safe 409 without replacing email',async({page,context})=>{
  const email=`fe033-${crypto.randomUUID()}@example.test`;const target=`claimed-${crypto.randomUUID()}@example.test`;
  const password=`Email fixture ${crypto.randomUUID()}`;
  await register(context,email,password);await login(page,email,password);const code=await requestCode(page,target);
  await page.getByLabel('نام',{exact:true}).fill('پیش‌نویس');
  const input=page.getByLabel('کد تأیید ایمیل',{exact:true});await input.fill('bad-code');
  await page.getByRole('button',{name:'تأیید ایمیل جدید',exact:true}).click();
  await expect(page.getByText('کد باید دقیقاً ۸ رقم باشد.',{exact:true})).toBeVisible();
  const wrong=code==='99999999'?'88888888':'99999999';await input.fill(wrong);
  const rejected=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/auth/email-change/verify');
  await page.getByRole('button',{name:'تأیید ایمیل جدید',exact:true}).click();expect((await rejected).status()).toBe(401);
  await expect(input).toHaveValue(wrong);await expect(page.getByLabel('نام',{exact:true})).toHaveValue('پیش‌نویس');
  await register(context,target,password);
  await input.fill(code);const conflict=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/auth/email-change/verify');
  await page.getByRole('button',{name:'تأیید ایمیل جدید',exact:true}).click();expect((await conflict).status()).toBe(409);
  await expect(page.getByLabel('ایمیل جدید',{exact:true})).toHaveValue(target);
  await expect(page.locator('[data-profile-current-email]')).toHaveText(email);
  await expect(page.getByLabel('نام',{exact:true})).toHaveValue('پیش‌نویس');
});
