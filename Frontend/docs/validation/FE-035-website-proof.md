# FE-035 — اتصال تأیید مالکیت

تاریخ: ۲۰۲۶-۱۰-۲۲، منطقهٔ زمانی Asia/Tehran. وضعیت اولیهٔ Git پاک، Branch برابر
main و HEAD برابر `2119b15` بود. راهنماهای مشترک و Frontend، cookbook، طراحی مصوب،
تصمیم‌های MVP/UX، Backlog، گزارش‌های FE-016/FE-034/BE-020 و کد و OpenAPI واقعی
بررسی شدند. پیش‌نیازها تکمیل بودند؛ Backend در این تسک تغییر نکرد.

## پلن و معیارهای پذیرش

پلن پیش از پیاده‌سازی: اتصال صفحهٔ موجود به نشست و سایت مالکانه؛ صدور و بررسی واقعی
از client تولیدشده، نگه‌داری موقت کد و مدیریت انقضا/تمدید؛ هدایت موفق به اتصال منابع
همان سایت با آمادگی گزارش مستقل؛ TDD، تست قرارداد/مرورگر و Backend/PostgreSQL واقعی،
سپس مستندسازی و به‌روزرسانی فقط FE-035.

| معیار | پیاده‌سازی و شاهد |
|---|---|
| کد واقعی کپی و نتیجهٔ واقعی نمایش داده شود | POST صدور BE-020 با `{}`، نمایش و کپی دقیق meta_tag سرور به‌صورت متن inert، POST بررسی با `{}` و موفقیت فقط از Website تأییدشدهٔ پاسخ معتبر. تست مرورگر با TLS و دیتابیس واقعی، body/کد قبلی را 409 و meta معتبر head را 200 دید. |
| سایت تأییدشدهٔ بدون منبع به اتصال منابع هدایت شود | CTA موفقیت با خواندن مالکانهٔ تازه به `/websites/{id}/connect` می‌رود. سایت تأییدشدهٔ فهرست نیز همین ورودی مدیریت منابع را باز می‌کند. ورودی اتصال نشست، ID و مالکیت را دوباره بررسی می‌کند؛ برای کاربر معتبر پیام ورود اشتباه نمایش نمی‌دهد. |
| تأیید به‌تنهایی گزارش آماده تلقی نشود | Website عمومی هیچ فیلد readiness ندارد؛ از verified فقط وضعیت مالکیت گرفته می‌شود. فهرست گزارش را unknown نگه می‌دارد؛ CTA به dashboard/receive نمی‌رود و اتصال گوگل یا دادهٔ موفق جعل نمی‌شود. |

فقط checkbox FE-035 در Backlog تکمیل شد؛ سایر شناسه‌ها، معیارها، وضعیت‌ها و Epic تغییر نکردند.

## قرارداد، state و امنیت

- صفحه‌ها Server Component باقی ماندند؛ params فقط ID را به injector می‌دهند و
  SessionBoundary موجود دسترسی را کنترل می‌کند. query/role/token/state در URL شاهد
  مالکیت نیستند. بازگشت ورود فقط مسیر دقیق verify/connect با ID ساده را می‌پذیرد؛
  مسیر خارجی، encoded، query، fragment و داشبورد همچنان در این allowlist نیستند.
- Hook جدید `useWebsiteProof` و توابع data در `websiteProof.ts` از client واقعی Orval
  استفاده می‌کنند. guardهای FE-034 بدون تغییر رفتار export و مجدداً استفاده شدند؛
  هویت نشست قبل و بعد از عملیات، تعویض Query نشست و AbortSignal بررسی می‌شوند.
  خروج/تغییر حساب و پاسخ دیررس نمی‌توانند کد یا موفقیت حساب قبلی را منتشر کنند.
- GET جزئیات مستقیماً مالکانه است و deep link به فهرست از پیش بارگذاری‌شده نیاز ندارد.
  ID پاسخ با مسیر تطبیق داده می‌شود؛ 404 خارجی و missing به حالت یکسان می‌روند.
- صدور کد اقدام صریح است، نه side effect render/query. بازکردن و reload، challenge
  را خودکار rotate نمی‌کنند. اگر pending در head سایت قرار دارد، بدون بازیابی plaintext
  قابل بررسی است. «درخواست کد تازه» قبلی را باطل می‌کند و این اثر در راهنما بیان می‌شود.
- parser پاسخ، Website عمومی، ID/hostname/scheme، وضعیت pending، انقضای ۲۴ساعته و
  تطبیق دقیق token/meta_tag را کنترل می‌کند. HTML در DOM درج نمی‌شود؛ textarea read-only
  و LTR است. Clipboard عین رشتهٔ سرور را می‌گیرد؛ در شکست، همان متن برای کپی دستی
  focus/select می‌شود. پاسخ دیررس clipboard پس از انقضا/عملیات تازه موفقیت اعلام نمی‌کند.
- tag فقط در state صفحهٔ mounted است؛ نه query/mutation cache، نه URL، نه localStorage
  و sessionStorage. فقط metadata عمومی بازسازی‌شده با کلید owner/site وارد QueryClient
  می‌شود. unmount درخواست را abort و نتیجهٔ کپی دیررس را بی‌اعتبار می‌کند.
- countdown از expiry واقعی است؛ زمان/اعطای مالکیت نهایی با سرور است. UI کد منقضی را
  برای copy/check غیرفعال می‌کند و تمدید فقط پس از پاسخ موفق، کد را جایگزین می‌کند.
  ساعت مرورگر برای نمایش و غیرفعال‌سازی اولیه استفاده می‌شود؛ امنیت به آن وابسته نیست.
- single flight با ref از POST تکراری جلوگیری می‌کند؛ retry خودکار یا polling اضافه نشد.
  خطای مبهم/abort می‌تواند بعد از commit سرور رخ دهد، بنابراین metadata detail/list
  invalidated می‌شود؛ موفقیت فقط از پاسخ معتبر به detail می‌رود. فهرست کامل حدس زده
  نمی‌شود و هنگام بازگشت دوباره از سرور خوانده می‌شود.
- 409 بررسی، شکست اثبات است؛ 401، 403، 404، 429 و خطای سرویس پیام فارسی امن دارند.
  متن/stack/owner/token خطای سرور به UI منتقل نمی‌شود. در 429 کاربر صبر می‌کند؛
  POST خودکار تکرار نمی‌شود. شکست قابل بازیابی، کد و راهنما را حفظ می‌کند.

## مرز اتصال منابع و حفظ طراحی

دادهٔ فعلی Website، وضعیت source/report ندارد. فهرست برای سایت تأییدشده تنها مقصد
مدیریت/اتصال منابع را می‌دهد و report unknown باقی می‌ماند؛ نبود منبع از verified
استنتاج نمی‌شود. صفحهٔ اتصال اکنون سایت و مالکیت واقعی را نشان می‌دهد و چون عملیات
provider هنوز API مصرف‌شدنی ندارد، عدم دسترسی عملیاتی را صریح و کوتاه نشان می‌دهد.
OAuth و انتخاب property در FE-036/FE-038/FE-040 باقی‌اند و شروع نشده‌اند. صفحهٔ review
FE-017 و سناریوهای آن تغییر نکردند؛ اتصال و دادهٔ ساختگی وارد محصول نشد.

هویت بصری FE-016 حفظ شد: AccountLayout، عرض max-w-2xl، پنل دامنه، Card گرد، رنگ‌ها،
آیکن، textarea و کنترل‌های ۴۸px. تغییرات لازم در همان Card شامل دریافت اولیه، بررسی
بدون plaintext پس از reload، تمدید صریح و برچسب CTA «اتصال منابع گوگل» است. focus پس
از موفقیت به بازخورد می‌رود؛ countdown هر ثانیه live announce نمی‌شود. component UI
به API/model وابسته نشد. globals.css، هدر/فوتر/brand، controllerهای خصوصی FE-016 و
FE-017، translations قبلی، package.json و lockfile با HEAD عیناً یکسان‌اند؛ ۹ مسیر
کلیدی با مقایسهٔ بایتی بررسی شدند. رنگ، فونت، shell یا primitive جدید ساخته نشد.

تصاویر product در ۳۹۰px روشن و ۱۴۴۰px تیره و موفقیت دسکتاپ با view_image بررسی شدند؛
چیدمان و خوانایی با design system سازگارند. تست ۳۲۰/۳۹۰/۷۶۸/۱۴۴۰px، تم‌ها، متن ۲۰۰٪،
RTL، LTR کد و حرکت keyboard از textarea به copy بدون overflow موفق است. ابزارهای dev
در تصاویر development وجود دارند؛ ادعای وجود آن‌ها در UI production مطرح نیست.

## TDD و آزمون‌ها

Node 24.19.0، pnpm 11.25.0، Next.js 16.2.6، Orval 8.10.0 و Playwright 1.62.1 موجود
استفاده شدند؛ dependency نصب/ارتقا داده نشد. Browser از Chrome نصب‌شده استفاده کرد.
OpenAPI واقعی با Config مستقل از env خصوصی صادر شد: **۲۵ path** و JSON دقیقاً برابر
BE-020. هر دو target functions/hooks Orval بازتولید شدند؛ خروجی همچنان ignored است.

دستورات واقعی از Frontend:

```sh
OPENAPI_JSON_URL=/private/tmp/datano-fe035/openapi.json pnpm api:generate
pnpm test:websites
pnpm test:session
pnpm test:transport
PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e tests/e2e/website-proof-product.spec.ts
PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e tests/e2e/website-verification.spec.ts tests/e2e/websites-product.spec.ts tests/e2e/add-website.spec.ts tests/e2e/websites.spec.ts
PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e tests/e2e/website-proof-product.spec.ts tests/e2e/google-connections.spec.ts
DATANO_WEBSITES_API_URL=http://127.0.0.1:8315 DATANO_PROOF_PUBLISH_URL=http://127.0.0.1:8516/publish PLAYWRIGHT_CHANNEL=chrome pnpm test:websites:integration
DATANO_WEBSITES_API_URL=http://127.0.0.1:8315 DATANO_PROOF_PUBLISH_URL=http://127.0.0.1:8516/publish PLAYWRIGHT_CHANNEL=chrome pnpm test:websites:integration proof.browser.spec.ts
pnpm exec tsc --noEmit --incremental false
pnpm lint
NEXT_PUBLIC_API_URL_V1= UI_REVIEW_ENABLED=1 pnpm build
PLAYWRIGHT_CHANNEL=chrome pnpm exec playwright test --config=/private/tmp/datano-fe035/playwright.production.config.ts
git diff --check
```

- Red اولیه: **۱ failed**؛ stub به‌جای meta_tag واقعی رشتهٔ خالی برمی‌گرداند؛ شکست
  رفتار بود، نه import یا dependency. همان تست پس از پیاده‌سازی **۱ passed، ۴۹۶ms** شد.
- data/قرارداد: **۴۱ passed، ۱٫۱s**؛ ۱۷ تست جدید و ۲۴ رگرسیون سایت. malformed proof،
  بررسی موفقیت واقعی، privacy cache، خطاهای HTTP، لغو و پاسخ دیررس حتی پس از ورود دوبارهٔ
  همان حساب بررسی شدند. mutation cache هیچ token/envelope نمی‌گیرد.
- session: **۸ passed، ۷۴۲ms**؛ transport: **۳۳ passed، ۸۹۹ms**.
- مرورگر نخست جریان جدید: **۱۶ passed، ۲۱٫۶s**؛ مجموعهٔ نهایی جریان جدید + اتصال منابع:
  **۴۲ passed، ۵۸٫۴s**. رگرسیون تأیید/افزودن/فهرست قبلی: **۸۸ passed، ۲٫۲min**.
  اعداد اجراهای تکراری با هم جمع نشده‌اند.
- Backend/PostgreSQL واقعی: **۴ passed، ۲۵٫۱s**؛ شامل دو FE-034 و دو FE-035 در موبایل/
  دسکتاپ. اجرای نهایی دو سناریوی proof پس از آخرین اصلاح انقضای UI: **۲ passed، ۱۶٫۹s**.
- build production موفق، شامل TypeScript build، ۱۸ صفحهٔ static و مسیرهای dynamic
  verify/connect. smoke production: **۴ passed، ۵٫۱s**؛ شامل جریان کپی/تأیید/اتصال
  با API کنترل‌شده و پاسخ 404 مسیرهای review حتی با UI_REVIEW_ENABLED=1.
- lint بدون warning/error و TypeScript مستقل پس از پایان تولید typeها موفق‌اند.
  whitespace نیز موفق است. هیچ lint/type rule ضعیف یا type تولیدشده دستی اصلاح نشد.

توقف‌ها و اصلاحات محیط/تست نیز ثبت می‌شوند: sandbox ابتدا bind پورت ۳۱۰۰ را با EPERM
رد کرد؛ اجرا با دسترسی لازم انجام شد. Chromium همراه نصب نبود؛ به‌جای نصب/ارتقا از
Chrome موجود استفاده شد. اجرای TypeScript هم‌زمان با نوشتن typeهای Next خطاهای
ناهماهنگی فایل‌های generated داد؛ یک ناسازگاری نوع در fixture جدید هم اصلاح شد.
بعد از پایان تولید typeها، TypeScript مستقل و build موفق شدند. warning محیطی
NO_COLOR/FORCE_COLOR پنهان نشد. build اولیه فقط به دریافت‌نشدن فونت‌های فعلی Google
Fonts شکست خورد؛ با دسترسی شبکه موفق شد و فونت/پیکربندی طراحی تغییر نکرد.

## محیط واقعی و پاکسازی

کانتینر اختصاصی `datano-fe035-validation` از تصویر موجود
`postgres@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24`،
دیتابیس تازهٔ `datano_test_fe035` روی tmpfs و loopback استفاده کرد؛ volume موجودی
mount نشد. migrationهای موجود فقط روی این دیتابیس به head اعمال شدند. Backend عادی
با lifespan، نشست، CSRF و repositoryهای واقعی روی ۸۳۱۵ اجرا شد؛ SMTP خاموش بود.
سقف فنی ثبت/ورود/اثبات در Config خصوصی تست ۱۰۰ بود؛ تنظیمات محصول عوض نشد.

تنها dependency دریافت HTML به SafeWebsiteHTMLFetcher واقعی با resolver و TCP routing
تستی تزریق شد: IP عمومی بررسی‌شده به peer loopback با گواهی wildcard موقت .test وصل
می‌شود؛ TLS verify، Host/SNI و parser واقعی پابرجا هستند. peer محلی جدا روی ۸۵۱۶ فقط
fixture HTML را برای تست منتشر می‌کند؛ endpoint محصول یا publish روی سایت کاربر
نیست. token، مالکیت، نشست، digest و verified_at stub نشدند. آزمون از ثبت‌نام/ورود،
ثبت سایت، صدور و کپی شروع می‌شود؛ meta در body، rotation و meta قبلی را رد می‌کند،
سپس meta صحیح head را قبول می‌کند. reload، ادامه، فهرست و حساب دوم نیز بررسی می‌شوند.

Config/runner و کلید گواهی در پوشهٔ محدود `/private/tmp/datano-fe035` قرار گرفتند؛ env
و key دارای mode 0600 بودند و credential چاپ یا وارد Git نشد. trace/screenshot/video
آزمون واقعی خاموش‌اند. بررسی نهایی PostgreSQL **17.11**، head برابر **0009_websites**، SELECT 1 موفق، **۸ سایت آزمایشی و ۴ سایت تأییدشده** را نشان داد. tmpfs، loopback و AutoRemove تأیید شدند؛ سپس فقط Backend/peer همین تسک و کانتینر اختصاصی آن متوقف شدند و --rm کانتینر را حذف کرد. فایل credential و کلید خصوصی موقت پس از آزمون حذف شدند؛ تصویر موجود و volumeهای قبلی دست‌نخورده ماندند.

## محدودیت‌های روشن

Backend، schema و migration محصول تغییر نکردند؛ suite کامل Backend دوباره اجرا نشد،
چون تغییر Backend نداریم و مسیرهای واقعی مرتبط در integration مرورگر آزموده شدند.
Google/SMTP، DNS عمومی و سایت شخص ثالث، deployment و egress واقعی آزموده نشدند.
production smoke از API کنترل‌شده استفاده دارد و جای آزمون واقعی PostgreSQL بالا را
نمی‌گیرد. مرورگر routine از پاسخ API کنترل‌شده برای خطا/زمان استفاده می‌کند.
سناریوهای private طراحی از محصول جدا هستند. اتصال گوگل و آمادگی گزارش بعدی همچنان
در Backlog مستقل باقی‌اند؛ هیچ معیار پذیرش این تسک بررسی‌نشده باقی نمانده است.

## فایل‌ها و Git

۲۳ مسیر در Frontend و مستندات مشترک:

- [Frontend/README.md](</Users/azin/Documents/Datano/Frontend/README.md>)
- [Frontend/app/(product)/(account)/websites/[websiteId]/connect/page.tsx](</Users/azin/Documents/Datano/Frontend/app/(product)/(account)/websites/[websiteId]/connect/page.tsx>)
- [Frontend/app/(product)/(account)/websites/[websiteId]/verify/page.tsx](</Users/azin/Documents/Datano/Frontend/app/(product)/(account)/websites/[websiteId]/verify/page.tsx>)
- [Frontend/components/feature/websites/GoogleConnections/DatanoGoogleConnections.tsx](</Users/azin/Documents/Datano/Frontend/components/feature/websites/GoogleConnections/DatanoGoogleConnections.tsx>)
- [Frontend/components/feature/websites/WebsiteList/DatanoWebsiteList.tsx](</Users/azin/Documents/Datano/Frontend/components/feature/websites/WebsiteList/DatanoWebsiteList.tsx>)
- [Frontend/components/feature/websites/WebsiteList/WebsiteListController.tsx](</Users/azin/Documents/Datano/Frontend/components/feature/websites/WebsiteList/WebsiteListController.tsx>)
- [Frontend/components/feature/websites/WebsiteVerification/DatanoWebsiteVerification.tsx](</Users/azin/Documents/Datano/Frontend/components/feature/websites/WebsiteVerification/DatanoWebsiteVerification.tsx>)
- [Frontend/components/feature/websites/WebsiteVerification/index.tsx](</Users/azin/Documents/Datano/Frontend/components/feature/websites/WebsiteVerification/index.tsx>)
- [Frontend/data/feature/session/routing.ts](</Users/azin/Documents/Datano/Frontend/data/feature/session/routing.ts>)
- [Frontend/data/feature/websites/useWebsiteProof.ts](</Users/azin/Documents/Datano/Frontend/data/feature/websites/useWebsiteProof.ts>)
- [Frontend/data/feature/websites/websiteProof.ts](</Users/azin/Documents/Datano/Frontend/data/feature/websites/websiteProof.ts>)
- [Frontend/data/feature/websites/websites.ts](</Users/azin/Documents/Datano/Frontend/data/feature/websites/websites.ts>)
- [Frontend/docs/validation/FE-035-website-proof.md](</Users/azin/Documents/Datano/Frontend/docs/validation/FE-035-website-proof.md>)
- [Frontend/playwright.websites.config.ts](</Users/azin/Documents/Datano/Frontend/playwright.websites.config.ts>)
- [Frontend/playwright.websites.integration.config.ts](</Users/azin/Documents/Datano/Frontend/playwright.websites.integration.config.ts>)
- [Frontend/tests/e2e/google-connections.spec.ts](</Users/azin/Documents/Datano/Frontend/tests/e2e/google-connections.spec.ts>)
- [Frontend/tests/e2e/website-proof-product.spec.ts](</Users/azin/Documents/Datano/Frontend/tests/e2e/website-proof-product.spec.ts>)
- [Frontend/tests/e2e/website-verification.spec.ts](</Users/azin/Documents/Datano/Frontend/tests/e2e/website-verification.spec.ts>)
- [Frontend/tests/e2e/websites-product.spec.ts](</Users/azin/Documents/Datano/Frontend/tests/e2e/websites-product.spec.ts>)
- [Frontend/tests/session/session.spec.ts](</Users/azin/Documents/Datano/Frontend/tests/session/session.spec.ts>)
- [Frontend/tests/websites/proof.browser.spec.ts](</Users/azin/Documents/Datano/Frontend/tests/websites/proof.browser.spec.ts>)
- [Frontend/tests/websites/proof.spec.ts](</Users/azin/Documents/Datano/Frontend/tests/websites/proof.spec.ts>)
- [docs/backlog.md](</Users/azin/Documents/Datano/docs/backlog.md>)

staged diff خالی، Branch همان main و HEAD همان `2119b15` مانده‌اند. هیچ Stage، Commit،
Push، تغییر Branch، انتشار یا شروع تسک بعدی انجام نشد.

پیام Commit پیشنهادی، بدون اجرا:

```text
feat(frontend): connect FE-035 website ownership verification
```
