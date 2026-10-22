# FE-034 — اتصال فهرست، انتخاب و افزودن سایت

تاریخ: ۲۰۲۶-۱۰-۲۲، منطقهٔ زمانی Asia/Tehran. وضعیت اولیهٔ Git پاک و HEAD برابر
`37663a7` بود. پیش‌نیازهای FE-014، FE-015، FE-030 و BE-018 تکمیل بودند.
راهنماهای مشترک و Frontend، معماری صفحه/Injector/Hook، تصمیم‌های MVP، Backlog،
قرارداد واقعی API و گزارش‌های قبلی سایت/نشست/حساب پیش از پیاده‌سازی بررسی شدند.
پلن اجرایی شامل اتصال نشست و client تولیدشده، cache حساب، ثبت واقعی، انتخاب معتبر،
تست مرورگر/Backend واقعی و حفظ طراحی بود.

## نتیجه و معیارهای پذیرش

| معیار | پیاده‌سازی و شاهد |
|---|---|
| سایت واقعی ساخته و در فهرست دیده شود | فرم مصوب از POST واقعی BE-018 استفاده می‌کند؛ فقط پاسخ معتبر سرور نتیجهٔ ثبت می‌سازد. بازگشت به فهرست آن را تازه می‌خواند. تست مرورگر با Backend/PostgreSQL ثبت، reload و ماندگاری را تأیید کرد. |
| سایت انتخابی معتبر باشد | انتخاب فقط عضو فهرست همان owner است؛ یک سایت خودکار انتخاب می‌شود و چند سایت به انتخاب صریح نیاز دارند. پس از ثبت، ID برگشتی انتخاب می‌شود. پیش از ادامه، GET جزئیات با نشست جاری اجرا و ID پاسخ تطبیق داده می‌شود. 404 انتخاب را پاک و فهرست را تازه می‌کند؛ ID خارجی درخواست جزئیات نمی‌فرستد. |
| cache و وضعیت بدون سایت هماهنگ باشند | کلیدها شامل owner ID هستند؛ فهرست فقط پس از دریافت تمام صفحات معتبر منتشر می‌شود. شکست فهرست با empty متفاوت و قابل تلاش مجدد است. ثبت، cache قبلی را باطل می‌کند؛ دادهٔ حدسی به‌عنوان فهرست کامل درج نمی‌شود. خروج/تغییر حساب/نقش/ایمیل و پاسخ دیررس، دادهٔ حساب قبلی را وارد حساب تازه نمی‌کنند. |

فقط وضعیت FE-034 در Backlog تکمیل شد؛ Epic 07 و سایر تسک‌ها تغییر وضعیت ندادند.
هیچ معیار پذیرش این تسک بررسی‌نشده باقی نمانده است.

## قرارداد، معماری و تصمیم‌ها

- دو صفحهٔ Server Component با SessionBoundary موجود ترکیب شدند. Injectorها از
  context حساب تأییدشده و Hookهای تایپ‌شدهٔ جدید استفاده می‌کنند. مدیریت درخواست،
  query key، ابطال و انتخاب در `data/feature/websites` است؛ UI از client تولیدشده
  یا مدل API واردات ندارد.
- client و hooks با Orval از OpenAPI واقعی Backend (۲۳ path) دوباره تولید شدند؛
  هیچ API، DTO، schema، migration یا فایل Backend تغییر نکرد. فایل‌های تولیدشده
  همچنان Git-ignored هستند و دستی ویرایش نشده‌اند.
- GET فهرست با page و size=100 تا انتها خوانده می‌شود؛ تعداد، شماره صفحه، اندازه،
  pages، ثبات total و یکتایی IDها بررسی می‌شوند. تغییر هم‌زمان pagination خطای
  قابل تلاش مجدد می‌سازد؛ فهرست ناقص به‌عنوان empty/success عرضه نمی‌شود. این تصمیم
  محدودیت ۱۰۰ سایت در UI ایجاد نمی‌کند و کنترل بصری تازه‌ای به طراحی نمی‌افزاید.
- DTO عمومی هنگام اجرا بررسی و بازسازی می‌شود: ID امن، hostname canonical، URL
  ریشهٔ متناظر، scheme، زمان‌ها و سازگاری verified/status. فیلد اضافی owner یا
  digest، پیام سرور، envelope و دادهٔ منابع در cache موفق قرار نمی‌گیرند.
- POST فقط URL canonical را با cookie و CSRF مشترک می‌فرستد؛ retry خودکار ندارد.
  هم ثبت تازه و هم پاسخ تکراری همان مالک پذیرفته می‌شوند؛ scheme/ID/مالکیت موجود
  از پاسخ سرور حفظ می‌شوند. hostname پاسخ باید همان hostname ارسالی باشد.
- در pending، ورودی/ارسال غیرفعال و guard هم‌زمان از ارسال دوباره جلوگیری می‌کند؛
  unmount درخواست را abort می‌کند. 409 پیام عمومی بدون نام مالک دارد؛ 422 و سایر
  خطاها ورودی را حفظ می‌کنند. حتی خطای مبهم cache فهرست را باطل می‌کند؛ بازگشت به
  فهرست وضعیت واقعی را می‌خواند. شکست بررسی نشست پس از POST، موفقیت ساختگی در UI
  ایجاد نمی‌کند؛ تکرار همان مالک طبق BE-018 همان رکورد را برمی‌گرداند.
- هویت cookie پیش و پس از هر عملیات با GET me بررسی می‌شود، بدون loading/remount
  فرم در خطای قابل بازیابی. guard، هویت owner/email/role، AbortSignal و خود Query
  نشست را نگه می‌دارد؛ خروج و ورود دوباره حتی برای همان owner پاسخ قبلی را بی‌اعتبار
  می‌کند. پاکسازی cache خصوصی نمی‌تواند نشست تازه‌تر را با پاسخ قدیمی بازنویسی کند.
- انتخاب در حافظهٔ QueryClient است؛ localStorage/sessionStorage استفاده نمی‌شود.
  انتخابی که دیگر عضو فهرست موفق نیست از cache پاک می‌شود. پس از reload، تک‌سایت
  خودکار انتخاب می‌شود؛ چند سایت انتخاب تازه می‌خواهند. queryهای URL، ID و role
  نمایشی هیچ مرجع هویتی/دسترسی نیستند.
- allowlist بازگشت ورود فقط `/websites` و `/websites/new` را برای User/Admin معتبر
  اضافه کرده است. مسیر خارجی، encoded/ambiguous یا deep link سایت همچنان رد می‌شود.
- API فعلی readiness منابع/گزارش ندارد؛ سایت تأییدشده وضعیت گزارش «در دسترس نیست»
  می‌گیرد و به اتصال/گزارش ساختگی هدایت نمی‌شود. سایت تأییدنشده پس از GET مالکانه
  به مسیر موجود verify تحویل داده می‌شود. اتصال proof واقعی FE-035 است؛ حذف واقعی
  FE-047 است و پیام عدم دسترسی موجود حفظ شد. هیچ‌کدام خودکار شروع نشدند.

## حفظ طراحی و بررسی بصری

فایل UI فرم افزودن، globals.css، هدر، فوتر و pnpm-lock.yaml با SHA-256 ابتدای تسک
عیناً یکسان‌اند. تمام classNameهای literal فهرست نیز با نسخهٔ HEAD مقایسه و حفظ
شدند؛ فقط action اختیاری «تلاش دوباره» در خطای فهرست با سبک دکمهٔ موجود اضافه شد.
تغییر package.json فقط دو script تست است؛ dependency یا lockfile تغییر نکرد.

کنترلرها همان UI و سناریوهای خصوصی مصوب را استفاده می‌کنند؛ تولید محصول fixture
و پیام «مقصد نمونه» ندارد. بازخورد آدرس معتبر هنگام تایپ نمایش داده می‌شود تا افزودن
آن در blur، دکمه را بین pointerdown و click جابه‌جا و اولین کلیک ثبت را خنثی نکند.
چیدمان/استایل همان حالت معتبر قبلی است؛ خطای ورودی پس از blur/submit باقی می‌ماند.

تست‌های قبلی keyboard/focus، حذف نمایشی، loading/error، فونت فارسی، تم‌ها، متن بزرگ
و حالت بدون JavaScript موفق‌اند. تصاویر فرم/فهرست واقعی محصول در production در
۳۹۰ و ۱۴۴۰ پیکسل، روشن و تیره ثبت شدند؛ تصاویر موبایل فرم روشن و دسکتاپ فهرست تیره
و نمونه‌های development به‌صورت بصری نیز بازبینی شدند. جهت RTL، دامنه/ورودی LTR،
شکست متن، فضای کارت‌ها و نبود overflow تأیید شد. screenshot و traceهای تست ignored
یا زیر `/private/tmp/datano-fe034` هستند و وارد Git نشده‌اند.

## آزمون‌های اجراشده

دستورات pnpm از `Frontend/` با Node 24.19.0، pnpm 11.25.0، Orval 8.10.0 و Chrome
موجود اجرا شدند؛ نصب یا ارتقای وابستگی انجام نشد.

| دستور واقعی | نتیجهٔ نهایی |
|---|---|
| `OPENAPI_JSON_URL=/private/tmp/datano-fe034/openapi.json pnpm api:generate` | هر دو target موفق |
| `pnpm test:websites` | ۲۴ passed؛ آخرین اجرا ۹۸۱ میلی‌ثانیه |
| `pnpm test:transport` | ۳۳ passed؛ ۱٫۱ ثانیه |
| `pnpm test:session` | ۸ passed؛ ۵۷۶ میلی‌ثانیه |
| `pnpm test:profile` | ۳۶ passed؛ ۷۸۱ میلی‌ثانیه |
| `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e websites-product.spec.ts websites.spec.ts add-website.spec.ts` | ۶۸ passed؛ ۱٫۵ دقیقه، موبایل و دسکتاپ |
| `DATANO_WEBSITES_API_URL=http://127.0.0.1:8314 PLAYWRIGHT_CHANNEL=chrome pnpm test:websites:integration` | ۲ passed؛ آخرین اجرا ۱۳٫۹ ثانیه، Backend/PostgreSQL واقعی |
| `PLAYWRIGHT_CHANNEL=chrome pnpm exec playwright test --config=/private/tmp/datano-fe034/playwright.production.config.ts` | ۴ passed؛ ۱۰٫۳ ثانیه، production و پاسخ‌های کنترل‌شده |
| `pnpm lint` | موفق؛ بدون diagnostic |
| `pnpm exec tsc --noEmit --incremental false` | موفق |
| `pnpm build` | موفق؛ compile و TypeScript و تمام routeها |
| `git diff --check` | موفق |

در مجموع ۱۷۵ سناریو در مجموعه‌های فوق موفق‌اند؛ اجراهای تکراری دوباره شمرده نشده‌اند.
هیچ تست skip یا bypass نشد. suite کامل Backend/کل Frontend یا CI اجرا نشده است؛
Backend تغییری ندارد و دامنهٔ رگرسیون مرتبط بالا، همراه اتصال واقعی، اجرا شد.
coverage عددی یا آستانهٔ جدیدی ادعا نمی‌شود.

شواهد Red/Green و شکست‌های حین توسعه:

- تست جدید empty-account ابتدا به‌علت placeholder قبلی **۱ failed** داشت؛ پس از
  اتصال نشست/فهرست همان تست موفق شد.
- اجرای گسترش‌یافته **۵۲ passed، ۱۶ failed** داشت؛ حالت‌های ثبت در هر دو اندازهٔ
  صفحه اولین کلیک را به‌علت جابه‌جایی blur از دست می‌دادند. زمان بازخورد معتبر اصلاح
  شد؛ همان سناریوها اکنون سبزند. assertion خطا نیز روی alert خود فرم مشخص شد تا
  alert خالی Next.js شاهد خطای ثبت شمرده نشود.
- تست تازهٔ انقضای نشست **۲۳ passed، ۱ failed** داشت؛ لغو Query زودتر از اتمام
  پاکسازی/انتشار نشست Promise ناظر را رد می‌کند. assertion نشست با expect.poll منتظر
  نتیجهٔ واقعی پاکسازی می‌ماند؛ نه تأخیر ثابت، نه حذف assertion. نتیجه ۲۴ passed است.
- نخستین integration در مرحله خروج **۲ failed** داشت؛ تست فقط بازکنندهٔ تأیید را
  زده بود. مرحلهٔ «تأیید خروج» موجود به تست افزوده شد؛ منطق محصول تغییر نکرد.
  دو اجرای بعدی موفق بودند، از جمله آخرین نسخه پس از بازبینی guard پاسخ دیررس.
- build محدود به sandbox به‌علت دریافت‌نشدن فونت‌های فعلی Google Fonts شکست خورد؛
  با دسترسی شبکه اجرا و موفق شد. فونت یا تنظیمات طراحی عوض نشد.
- warning محیطی NO_COLOR/FORCE_COLOR در runnerها پنهان نشد. دو فراخوانی اولیه pnpm
  از ریشهٔ فاقد manifest عملیاتی انجام ندادند؛ دستورات اصلی از Frontend اجرا شدند.

## اتصال واقعی و ایزوله‌سازی

کانتینر اختصاصی `datano-fe034-validation` از تصویر موجود زیر بدون دانلود و بدون
mount هیچ volume قبلی اجرا شد:

```text
postgres@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24
```

فقط دیتابیس تازهٔ `datano_test_fe034` روی tmpfs به head موجود `0009_websites`
رسید. port فقط loopback بود و AutoRemove تأیید شد. Backend عادی با lifespan و
Config خصوصی، Origin محلی ۳۱۰۰، cookie محلی و SMTP خاموش روی ۸۳۱۴ اجرا شد؛ adapter
یا dependency احراز هویت/سایت/دیتابیس جایگزین نشد. برای تکرار fixtureها سقف فنی ثبت
و ورود در همین Config موقت ۲۰ بود؛ تنظیمات محصول تغییر نکردند. هیچ ایمیل واقعی،
درخواست Google API، DNS lookup یا fetch سایت خارجی انجام نشد.

تست مرورگر بدون stub از ثبت کاربر/ورود شروع می‌کند؛ URL uppercase و default port،
ثبت canonical، نتیجهٔ تأییدنشده، فهرست/reload، تکرار با HTTP و حفظ ID/scheme قبلی،
www مستقل، انتخاب از چند سایت، GET مالکانه و تحویل verify را بررسی می‌کند. سپس با
خروج واقعی و ورود حساب دوم، empty و 404 خارجی و 409 بدون افشای مالک را تأیید می‌کند.
trace/screenshot/video این integration خاموش‌اند؛ تمام ایمیل‌ها `.test` هستند.

اجرای production جداگانه با پاسخ API کنترل‌شده است و ادعای اتصال واقعی DB ندارد؛
مسیرهای review حتی با UI_REVIEW_ENABLED=1 در runtime پاسخ 404 دارند. جست‌وجوی markerهای
خصوصی منتخب سایت در خروجی server/static نیز بدون match بود.

بررسی نهایی PostgreSQL نسخهٔ 17.11، head برابر 0009_websites، SELECT 1 موفق و
۱۲ کاربر/۱۲ سایت کاملاً آزمایشی را نشان داد (شامل اجراهای اولیه و تکرار). سپس فقط
Backend همین تسک و کانتینر tmpfs آن متوقف شدند؛ کانتینر با --rm حذف شد. سرورهای
development/production خود Playwright نیز با پایان اجرا بسته شدند. تصویر موجود،
volumeهای قبلی و داده/تنظیمات پروژه حفظ شدند. فایل‌های خصوصی runtime بیرون مخزن
در پوشهٔ محدود `/private/tmp/datano-fe034` باقی‌اند؛ credential چاپ یا مستند نشده است.

## فایل‌های تغییرکرده و Git

۲۵ مسیر: ۱۶ فایل tracked تغییرکرده و ۹ فایل جدید؛ همگی unstaged هستند. تنها تغییر
Backlog، checkbox FE-034 است. Branch همان main و HEAD همان 37663a7 مانده؛ staged
diff خالی است. هیچ Stage، Commit، Push، تغییر Branch یا انتشار انجام نشد.

- [Frontend/README.md](</Users/azin/Documents/Datano/Frontend/README.md>)
- [Frontend/app/(product)/(account)/websites/new/page.tsx](</Users/azin/Documents/Datano/Frontend/app/(product)/(account)/websites/new/page.tsx>)
- [Frontend/app/(product)/(account)/websites/page.tsx](</Users/azin/Documents/Datano/Frontend/app/(product)/(account)/websites/page.tsx>)
- [Frontend/components/feature/websites/AddWebsiteForm/AddWebsiteFormController.tsx](</Users/azin/Documents/Datano/Frontend/components/feature/websites/AddWebsiteForm/AddWebsiteFormController.tsx>)
- [Frontend/components/feature/websites/AddWebsiteForm/DatanoAddWebsite.tsx](</Users/azin/Documents/Datano/Frontend/components/feature/websites/AddWebsiteForm/DatanoAddWebsite.tsx>)
- [Frontend/components/feature/websites/WebsiteList/DatanoWebsiteList.tsx](</Users/azin/Documents/Datano/Frontend/components/feature/websites/WebsiteList/DatanoWebsiteList.tsx>)
- [Frontend/components/feature/websites/WebsiteList/WebsiteListController.tsx](</Users/azin/Documents/Datano/Frontend/components/feature/websites/WebsiteList/WebsiteListController.tsx>)
- [Frontend/components/feature/websites/WebsiteList/content.ts](</Users/azin/Documents/Datano/Frontend/components/feature/websites/WebsiteList/content.ts>)
- [Frontend/components/feature/websites/WebsiteList/index.tsx](</Users/azin/Documents/Datano/Frontend/components/feature/websites/WebsiteList/index.tsx>)
- [Frontend/components/feature/websites/WebsiteList/navigation.ts](</Users/azin/Documents/Datano/Frontend/components/feature/websites/WebsiteList/navigation.ts>)
- [Frontend/data/feature/session/routing.ts](</Users/azin/Documents/Datano/Frontend/data/feature/session/routing.ts>)
- [Frontend/data/feature/websites/useWebsiteActions.ts](</Users/azin/Documents/Datano/Frontend/data/feature/websites/useWebsiteActions.ts>)
- [Frontend/data/feature/websites/useWebsites.ts](</Users/azin/Documents/Datano/Frontend/data/feature/websites/useWebsites.ts>)
- [Frontend/data/feature/websites/websites.ts](</Users/azin/Documents/Datano/Frontend/data/feature/websites/websites.ts>)
- [Frontend/docs/validation/FE-034-owned-websites.md](</Users/azin/Documents/Datano/Frontend/docs/validation/FE-034-owned-websites.md>)
- [Frontend/package.json](</Users/azin/Documents/Datano/Frontend/package.json>)
- [Frontend/playwright.websites.config.ts](</Users/azin/Documents/Datano/Frontend/playwright.websites.config.ts>)
- [Frontend/playwright.websites.integration.config.ts](</Users/azin/Documents/Datano/Frontend/playwright.websites.integration.config.ts>)
- [Frontend/tests/e2e/add-website.spec.ts](</Users/azin/Documents/Datano/Frontend/tests/e2e/add-website.spec.ts>)
- [Frontend/tests/e2e/websites-product.spec.ts](</Users/azin/Documents/Datano/Frontend/tests/e2e/websites-product.spec.ts>)
- [Frontend/tests/e2e/websites.spec.ts](</Users/azin/Documents/Datano/Frontend/tests/e2e/websites.spec.ts>)
- [Frontend/tests/session/session.spec.ts](</Users/azin/Documents/Datano/Frontend/tests/session/session.spec.ts>)
- [Frontend/tests/websites/product.browser.spec.ts](</Users/azin/Documents/Datano/Frontend/tests/websites/product.browser.spec.ts>)
- [Frontend/tests/websites/websites.spec.ts](</Users/azin/Documents/Datano/Frontend/tests/websites/websites.spec.ts>)
- [docs/backlog.md](</Users/azin/Documents/Datano/docs/backlog.md>)

پیام Commit پیشنهادی (اجرا نشده):

```text
feat(frontend): connect FE-034 owned website flows
```
