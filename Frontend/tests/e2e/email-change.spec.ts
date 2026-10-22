import { expect, test, type Page } from "@playwright/test";

const initial = { id: "email-owner", first_name: "نام", last_name: "مالک", email: "old@example.test", is_active: true, effective_role: "User", roles: [] };
const target = "new@example.test";

test("new mailbox proof updates the real API result and account navigation uses the returned server role", async ({ page }) => {
  let account = { ...initial }; const writes: unknown[] = [];
  await page.route("**/api/auth/**", async route => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    if (path.endsWith('/csrf')) return route.fulfill({ json: { success:true, message:'OK', payload:{csrf_token:'c'.repeat(43)} } });
    if (request.method() === 'POST') {
      writes.push(request.postDataJSON());
      expect(request.headers()['x-csrf-token']).toBe('c'.repeat(43));
      if (path.endsWith('/request')) return route.fulfill({ json:{success:true,message:'Generic acknowledgement',payload:null} });
      account = {...account,email:target,effective_role:'Admin'};
      return route.fulfill({ json:{success:true,message:'OK',payload:{user:account,effective_role:'Admin',csrf_token:'d'.repeat(43)}} });
    }
    return route.fulfill({ json:{success:true,message:'OK',payload:account} });
  });
  await page.goto('/profile?role=User');
  await page.getByLabel('ایمیل جدید',{exact:true}).fill(' NEW@EXAMPLE.TEST ');
  await page.getByRole('button',{name:'ادامه برای تأیید',exact:true}).click();
  const code = page.getByLabel('کد تأیید ایمیل',{exact:true});
  await expect(code).toBeFocused();
  await expect(page.locator('[data-profile-current-email]')).toHaveText(initial.email);
  await code.fill('۰۱۲۳۴۵۶۷');
  await page.getByRole('button',{name:'تأیید ایمیل جدید',exact:true}).click();
  await expect(page.locator('[data-profile-current-email]')).toHaveText(target);
  await expect(page.getByText('ایمیل شما تغییر کرد.',{exact:true})).toBeVisible();
  expect(writes).toEqual([{email:target},{email:target,code:'01234567'}]);
  await page.goto('/account?role=User');
  await expect(page).toHaveURL('/admin/users');
  expect(await page.evaluate(()=>({local:{...localStorage},session:{...sessionStorage}}))).toEqual({local:{},session:{}});
});

async function mockedEmailAPI(page:Page, verifyStatus=401) {
  const writes:{path:string;body:unknown}[]=[];
  await page.route('**/api/auth/**',async route=>{
    const request=route.request();const path=new URL(request.url()).pathname;
    if(path.endsWith('/csrf'))return route.fulfill({json:{success:true,message:'OK',payload:{csrf_token:'c'.repeat(43)}}});
    if(request.method()==='POST') {
      writes.push({path,body:request.postDataJSON()});
      if(path.endsWith('/request'))return route.fulfill({json:{success:true,message:'Generic acknowledgement',payload:null}});
      return route.fulfill({status:verifyStatus,headers:verifyStatus===429?{'Retry-After':'120'}:{},json:{success:false,message:'private-error-never-render',payload:null}});
    }
    return route.fulfill({json:{success:true,message:'OK',payload:initial}});
  });
  return writes;
}
async function requestCode(page:Page) {
  await page.goto('/profile');await page.getByLabel('ایمیل جدید',{exact:true}).fill(target);
  await page.getByRole('button',{name:'ادامه برای تأیید',exact:true}).click();
  await expect(page.getByLabel('کد تأیید ایمیل',{exact:true})).toBeVisible();
}

test('invalid proof retains code and name drafts; the fifth rejected proof locks until resend',async({page})=>{
  const writes=await mockedEmailAPI(page);await requestCode(page);
  await page.getByLabel('نام',{exact:true}).fill('پیش‌نویس');
  const code=page.getByLabel('کد تأیید ایمیل',{exact:true});await code.fill('12345678');
  for(let attempt=0;attempt<5;attempt++){
    await page.getByRole('button',{name:'تأیید ایمیل جدید',exact:true}).click();
    await expect.poll(()=>writes.filter(write=>write.path.endsWith('/verify')).length).toBe(attempt+1);
    await expect(page.getByText(attempt===4?'تعداد تلاش‌ها به پایان رسیده است. کد تازه درخواست کنید.':'کد نامعتبر یا منقضی است. کد را بررسی کنید یا کد تازه درخواست کنید.',{exact:true})).toBeVisible();
  }
  await expect(code).toHaveValue('12345678');await expect(code).toBeDisabled();
  await expect(page.getByLabel('نام',{exact:true})).toHaveValue('پیش‌نویس');
  await expect(page.locator('[data-profile-current-email]')).toHaveText(initial.email);
  await expect(page.getByText('private-error-never-render',{exact:true})).toHaveCount(0);
});

test('wall clock expiry and resend preserve names, clear old code and enforce the cooldown across targets',async({page})=>{
  await page.clock.install();const writes=await mockedEmailAPI(page);await requestCode(page);
  await page.getByLabel('نام',{exact:true}).fill('حفظ شود');
  await page.getByLabel('کد تأیید ایمیل',{exact:true}).fill('12345678');
  const resend=page.getByRole('button',{name:'ارسال مجدد کد',exact:true});await expect(resend).toBeDisabled();
  await page.getByRole('button',{name:'ویرایش ایمیل جدید',exact:true}).click();
  await page.getByLabel('ایمیل جدید',{exact:true}).fill('another@example.test');
  await page.getByRole('button',{name:'ادامه برای تأیید',exact:true}).click();
  await expect(page.getByText('برای درخواست کد تازه، تا پایان فاصلهٔ ارسال مجدد صبر کنید.',{exact:true})).toBeVisible();
  expect(writes.filter(write=>write.path.endsWith('/request'))).toHaveLength(1);
  await page.clock.fastForward(60_000);
  await page.getByRole('button',{name:'ادامه برای تأیید',exact:true}).click();
  const code=page.getByLabel('کد تأیید ایمیل',{exact:true});await expect(code).toHaveValue('');
  await code.fill('12345678');await page.clock.fastForward(600_000);
  await expect(page.getByText('مهلت کد به پایان رسیده است. کد تازه درخواست کنید.',{exact:true})).toBeVisible();
  await expect(code).toBeDisabled();await resend.click();await expect(code).toBeEnabled();await expect(code).toHaveValue('');
  await expect(resend).toBeDisabled();await expect(page.getByLabel('نام',{exact:true})).toHaveValue('حفظ شود');
  expect(writes.filter(write=>write.path.endsWith('/request'))).toHaveLength(3);
  expect(writes.filter(write=>write.path.endsWith('/verify'))).toHaveLength(0);
});

for(const status of [403,422,503])test(`verification ${status} preserves draft inputs with safe error and no automatic replay`,async({page})=>{
  const writes=await mockedEmailAPI(page,status);await requestCode(page);
  await page.getByLabel('کد تأیید ایمیل',{exact:true}).fill('12345678');
  await page.getByRole('button',{name:'تأیید ایمیل جدید',exact:true}).click();
  await expect(page.getByText(status===403?'درخواست تغییر ایمیل تأیید نشد. دوباره تلاش کنید.':status===422?'ایمیل و کد واردشده را بررسی کنید.':'تغییر ایمیل در حال حاضر در دسترس نیست.',{exact:true})).toBeVisible();
  await expect(page.getByLabel('کد تأیید ایمیل',{exact:true})).toHaveValue('12345678');
  expect(writes.filter(write=>write.path.endsWith('/verify'))).toHaveLength(1);
  await expect(page.locator('[data-profile-current-email]')).toHaveText(initial.email);
});

test('canonical conflict returns to the editable email without announcing a change',async({page})=>{
  await mockedEmailAPI(page,409);await requestCode(page);
  await page.getByLabel('کد تأیید ایمیل',{exact:true}).fill('12345678');
  await page.getByRole('button',{name:'تأیید ایمیل جدید',exact:true}).click();
  await expect(page.getByLabel('ایمیل جدید',{exact:true})).toHaveValue(target);
  await expect(page.getByText('این ایمیل دیگر در دسترس نیست. نشانی دیگری وارد کنید و کد تازه بگیرید.',{exact:true})).toBeVisible();
  await expect(page.locator('[data-profile-current-email]')).toHaveText(initial.email);
  await expect(page.getByText('ایمیل شما تغییر کرد.',{exact:true})).toHaveCount(0);
});

test('Retry-After blocks verification and resend until the server delay ends',async({page})=>{
  await page.clock.install();const writes=await mockedEmailAPI(page,429);await requestCode(page);
  await page.getByLabel('کد تأیید ایمیل',{exact:true}).fill('12345678');
  const verify=page.getByRole('button',{name:'تأیید ایمیل جدید',exact:true});await verify.click();
  await expect(page.getByText('تعداد درخواست‌ها زیاد است. کمی صبر کنید و دوباره تلاش کنید.',{exact:true})).toBeVisible();
  await expect(verify).toBeDisabled();await page.clock.fastForward(119_000);await expect(verify).toBeDisabled();
  await page.clock.fastForward(1000);await expect(verify).toBeEnabled();
  expect(writes.filter(write=>write.path.endsWith('/verify'))).toHaveLength(1);
});

test('pending request prevents duplicate submit, preserves typed email on failure and can retry',async({page})=>{
  await mockedEmailAPI(page);let writes=0;let finish:()=>Promise<void>=async()=>{};
  await page.route('**/api/auth/email-change/request',async route=>{
    writes++;
    if(writes===1){finish=()=>route.fulfill({status:503,json:{success:false,message:'private-error',payload:null}});return;}
    await route.fulfill({json:{success:true,message:'ACK',payload:null}});
  });
  await page.goto('/profile');const email=page.getByLabel('ایمیل جدید',{exact:true});await email.fill(target);
  await page.getByRole('button',{name:'ادامه برای تأیید',exact:true}).click();await expect(email).toBeDisabled();
  await page.locator('[data-profile-email-form]').evaluate(form=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  expect(writes).toBe(1);await finish();await expect(email).toBeEnabled();await expect(email).toHaveValue(target);
  await expect(page.getByText('تغییر ایمیل در حال حاضر در دسترس نیست.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'ادامه برای تأیید',exact:true}).click();
  await expect(page.getByLabel('کد تأیید ایمیل',{exact:true})).toBeVisible();expect(writes).toBe(2);
});
