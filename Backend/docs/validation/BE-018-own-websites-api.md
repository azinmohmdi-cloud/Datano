# BE-018 — API افزودن و مشاهدهٔ سایت‌های خود کاربر

تاریخ: ۲۰۲۶-۱۰-۲۲، منطقهٔ زمانی Asia/Tehran. وضعیت اولیهٔ Git پاک و HEAD برابر
`464cc9d` بود. پیش‌نیازهای `BE-017` و `BE-009` در Backlog و کد تکمیل بودند.
راهنماهای مشترک/Backend، تصمیم‌های مصوب MVP، قواعد URL تأییدشدهٔ FE-015، مدل و
repository سایت و قرارداد نشست/CSRF پیش از پیاده‌سازی بررسی شدند.

## نتیجه و معیارهای پذیرش

| معیار | پیاده‌سازی و شاهد |
|---|---|
| owner از نشست | هر سه endpoint فقط `identity.user.id` را از dependency نشست opaque می‌گیرند. body فقط url دارد؛ owner/role/verified/timestamp ورودی پذیرفته نمی‌شود. query مربوط به مالک، حساب را انتخاب نمی‌کند. User عادی بدون مجوز مدیریتی سایت خود را ثبت و می‌خواند. |
| قواعد URL | HTTP(S) و slash ریشهٔ اختیاری؛ trim بیرونی و IDNA/lowercase از BE-017؛ پورت پیش‌فرض متناظر alias است. credential، پورت سفارشی، path حتی `/a/..`، query/fragment حتی خالی، backslash، whitespace/control داخلی، IPهای کوتاه/عددی/hex، localhost و hostname نامعتبر رد می‌شوند. تست مستقیم و HTTP انجام شد. |
| duplicate مصوب | همان مالک، ID/scheme/deadline قبلی را می‌گیرد؛ مالک دیگر روی رزرو معتبر یا سایت تأییدشده فقط 409 عمومی می‌گیرد. رزرو تأییدنشدهٔ منقضی برای دیگری رکورد تازه می‌سازد؛ سابقه و proof منتقل نمی‌شود. رفتار هم‌زمان دو حساب و همان حساب روی PostgreSQL واقعی تست شد. |
| عدم افشای مالک | DTO صریح، بدون owner_id، ایمیل و digest است. conflict پیام ثابت و details خالی دارد. سایت ناموجود، خارجی و released پاسخ 404 یکسان دارند. خطاهای DTO/JSON مقدار ورودی و credential را بازنمی‌گردانند. |
| رد دسترسی بین کاربران | list/count/detail فقط owner نشست را می‌خوانند. Admin اثبات‌شده نیز نمی‌تواند سایت دیگری را بخواند. نشست مفقود/نامعتبر/منقضی/لغوشده، حساب غیرفعال و JWT قدیمی رد می‌شوند. Origin و CSRF نامعتبر/بین‌نشستی پیش از mutation رد می‌شوند. |

## قرارداد واقعی API

| مسیر | رفتار |
|---|---|
| `POST /api/websites/` | body سخت‌گیرانهٔ `{url:string}`؛ 200 برای ثبت تازه و تکرار همان مالک؛ بدون صدور challenge یا تأیید مالکیت |
| `GET /api/websites/` | envelope با pagination داخل payload؛ page/size موجود، اندازهٔ ۱ تا ۱۰۰ و ترتیب created_at/id؛ حساب بی‌سایت فهرست خالی دارد |
| `GET /api/websites/{website_id}` | فقط رکورد جاری مالک نشست؛ ID ناموجود، متعلق به دیگری یا released همگی 404 ثابت دارند |

فیلدهای عمومی: `id`، `hostname`، `scheme`، `url` ریشهٔ canonical، `is_verified`،
`challenge_status`، `reservation_expires_at`، `challenge_expires_at`، `verified_at`،
`created_at` و `updated_at`. زمان‌ها timezone-aware هستند. not-issued، pending،
expired و verified به‌صورت metadata واقعی عرضه می‌شوند؛ ثبت سایت گزارش یا proof
آماده تلقی نمی‌شود. پاسخ‌های خصوصی و خطاهای سایت no-store هستند؛ پاسخ‌های معمول
مسیر و domain/validation error بر اساس Cookie نیز vary می‌شوند.

در POST، کنترل Origin و CSRF موجود بدون bypass پابرجاست. با CSRF معتبر، نشست
نامعتبر 401 می‌گیرد؛ کنترل امنیت مرورگر نامعتبر 403، ورودی/pagination نامعتبر 422،
hostname اشغال‌شده 409 و ID خارجی/ناموجود 404 است. شکست transaction پاسخ 500
عمومی می‌دهد و درج جزئی باقی نمی‌گذارد.

## معماری و تصمیم‌ها

- سه Use Case مستقل با request/responseهای frozen و قرارداد repository موجود؛
  controller فقط owner معتبر، DTO، پاسخ و pagination را هماهنگ می‌کند.
- سیاست duplicate، انقضا، قفل و transaction در repository تأییدشدهٔ BE-017 باقی
  ماند؛ هیچ مدل، migration یا ساختار ذخیره‌سازی آن بازنویسی نشد.
- URL پیش از نرمال‌سازی permissive بررسی می‌شود تا مسیرهای dot-segment یا marker
  خالی پنهان نشوند. هیچ DNS lookup، دریافت HTML یا درخواست خارجی انجام نمی‌شود.
  کنترل DNS/IP عمومی و SSRF متعلق به BE-019 و اثبات HTML متعلق به BE-020 است.
- مالکیت، activation، نقش و زمان از body/browser storage گرفته نمی‌شوند. DI
  زمان ایجاد رزرو را از clock_timestamp دیتابیس همان transaction فراهم می‌کند.
  اختلاف ساعت میزبان Python و PostgreSQL نمی‌تواند ثبت معتبر را به‌خاطر آینده‌بودن
  زمان محلی رد کند. Use Case با clock تزریق‌شده مستقل از SQL می‌ماند.
- پیام‌ها و پاسخ‌های قبلی API تغییر نکردند. helper حریم خصوصی در exception handler
  فقط مسیرهای سایت را هدف می‌گیرد؛ ساختار validation و Retry-After قبلی حفظ شد.

## TDD و بررسی‌های اجراشده

- Red اولیه: ثبت معتبر روی اپ واقعی و PostgreSQL با `404 != 200` شکست خورد:
  **۱ failed، ۱٫۰۳ ثانیه**. شکست به‌دلیل route غایب بود، نه import یا fixture.
- Green نخست به‌طور گذرا 422 داد. اندازه‌گیری ساعت PostgreSQL حدود ۱ تا ۲
  میلی‌ثانیه اختلاف با Python نشان داد. تست کنترل‌شده با clock برنامهٔ جلوتر،
  `Website reservation is not current` را بازتولید کرد: **۱ failed، ۱٫۰۵ ثانیه**.
  DI ساعت دیتابیس را فراهم کرد و regression اکنون موفق است.
- تست privacy ابتدا نبود no-store روی 404 را نشان داد:
  **۱ failed، ۱٫۲۳ ثانیه**؛ پاسخ domain/validation سایت اصلاح و regression حفظ شد.
- اجرای گسترش‌یافته **۱۱۰ passed و ۸ failed** داشت: پنج assertion تست، واژهٔ
  «inputs» در متن Pydantic را با فیلد JSON اشتباه می‌گرفتند و سه تست چند lifespan
  را روی همان app باز می‌کردند. assertion به بررسی کلیدهای واقعی type/loc/msg و
  عدم افشای مقدار اصلاح شد؛ clientها app مستقل روی همان DB دارند. هیچ کنترل محصول
  برای عبور تست ضعیف یا bypass نشد.
- مجموعهٔ متمرکز پس از این اصلاح‌ها: **۱۱۹ passed، ۱۶٫۹۴ ثانیه**.
- مجموعهٔ نهایی شامل تست‌های URL و HTTP جدید و ۸۰ تست domain قبلی:
  **۲۰۴ passed، ۲۵٫۷۷ ثانیه**؛ **۱۷۸/۱۷۸ statement و تمام ۱۴ branch** ماژول‌های
  مشخص‌شده در پوشش، موفق و **۱۰۰٪** هستند. این عدد آستانه یا coverage کل پروژه نیست.
- suite کامل Backend: **۱۱۲۹ passed، ۱۵۶٫۶۸ ثانیه**؛ بدون شکست، skip یا warning.
  تمام ۱۰۰۵ تست قبلی به‌همراه ۱۲۴ تست جدید موفق شدند، شامل persistence و migration
  قبلی، هویت، نشست، CSRF و جریان‌های حساب.

Python 3.12.14 و PDM 2.29.2 موجود استفاده شدند؛ وابستگی، lockfile و تنظیم خصوصی
پروژه عوض نشدند. runner خصوصی فقط DATANO_TEST_DATABASE_URL دیتابیس ایزوله را
بدون چاپ رمز تنظیم کرد. دستورات واقعی از Backend:

```sh
pdm run pytest tests/unit/test_website_api_use_cases.py tests/integration/test_websites_http.py -q --tb=short --show-capture=no
pdm run pytest tests/unit/test_website_api_use_cases.py tests/unit/test_website_entity.py \
  tests/integration/test_websites_http.py --cov=app.application.use_cases.website \
  --cov=app.domain.website --cov=app.interface.controller.website_controller \
  --cov=app.interface.dependencies.website_dependencies --cov=app.interface.dto.website_dto \
  --cov=app.interface.mappers.website_mapper --cov-branch --cov-report=term-missing \
  -q --tb=short --show-capture=no
pdm run pytest -q --tb=short --show-capture=no
pdm run python -m compileall -q app tests/unit/test_website_api_use_cases.py tests/integration/test_websites_http.py
pdm lock --check
git diff --check
```

compileall فقط بررسی syntax است؛ linter یا static type-checker بک‌اند پیکربندی
نشده است. تست persistence قبلی، migration و سایر جریان‌ها در suite کامل اجرا شدند.

## OpenAPI و مصرف‌کنندهٔ تولیدشده

OpenAPI واقعی بدون اجرای lifespan/اتصال SMTP صادر شد: **۲۳ path**، با دو path
جدید و سه operation. تمام path/operationها و schemaهای قبلی با خروجی واقعی BE-017
مقایسه شدند و عیناً حفظ شده‌اند. تست schema، امنیت opaque cookie، هدرهای CSRF،
بدنهٔ سخت‌گیرانه و DTO فاقد اطلاعات خصوصی را نیز تأیید می‌کند.

Node 24.19.0، pnpm 11.25.0 و Orval 8.10.0 موجود استفاده شدند. از Frontend:

```sh
OPENAPI_JSON_URL=/private/tmp/datano-be018/openapi.json pnpm api:generate
pnpm exec tsc --noEmit --incremental false
pnpm lint
pnpm test:transport
pnpm exec playwright test --config=/private/tmp/datano-be018/playwright.generated.config.ts
```

هر دو target تولید شدند؛ output زیر lib/api همچنان Git-ignored است و دستی ویرایش
نشد. TypeScript و lint موفق‌اند؛ transport قبلی **۳۳ passed، ۱٫۲ ثانیه** و بررسی
موقت عملیات سایت در هر دو mutator **۸ passed، ۵۵۵ میلی‌ثانیه** دارد. بررسی موقت
ایجاد با CSRF/credentials، حفظ envelope و pagination، ID جزئیات و cancellation
را با adapter کنترل‌شده تست می‌کند؛ ادعای مرورگر یا اتصال UI واقعی نیست.
warning محیطی NO_COLOR/FORCE_COLOR در runner Node پنهان نشد.

هیچ فایل tracked از Frontend، UI، CSS، صفحه یا طراحی تأییدشده تغییر نکرد.
build و suite مرورگر UI اجرا نشدند چون route/rendering/dependency فرانت‌اند تغییر
نکرده است. اتصال UI همچنان FE-034 است و خودکار شروع نشده است.

## محیط آزمون و مرز تحویل

کانتینر اختصاصی `datano-be018-validation` از تصویر موجود زیر، بدون دانلود، اجرا شد:

```text
postgres@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24
```

داده فقط در tmpfs متعلق به تسک و دیتابیس `datano_test_be018` بود؛ publication
فقط loopback بود. fixture موجود برای هر تست schema مستقل ساخت و پاک کرد.
هیچ volume یا دیتابیس application قبلی استفاده نشد. تنظیمات و runner زیر
`/private/tmp/datano-be018` با دسترسی محدود و بیرون مخزن هستند؛ credential چاپ نشد.
هیچ ایمیل واقعی، تماس با گوگل یا fetch سایت خارجی انجام نشد.

بررسی نهایی PostgreSQL نسخهٔ 17.11، موفقیت `SELECT 1` و صفر schema آزمایشی
باقی‌مانده را تأیید کرد. inspect کانتینر، tmpfs، publication فقط روی 127.0.0.1 و
AutoRemove را تأیید کرد. سپس فقط کانتینر همین تسک متوقف و با سیاست `--rm` حذف شد؛
تصویر موجود و volumeهای قبلی حفظ شدند.

این تسک شامل تولید challenge، تأیید HTML، گزارش تحلیلی، حذف/انتقال سایت، integration
گوگل یا اتصال صفحات Frontend نیست. هیچ Stage، Commit، Push یا تغییر Branch
انجام نشده است.

تمام معیارهای `BE-018` تأیید شدند؛ فقط checkbox همین تسک در Backlog به `[x]`
تغییر کرد. سایر وضعیت‌ها، شناسه‌ها، ترتیب و شرح تسک‌ها حفظ شدند. هیچ تسک بعدی
شروع نشده و staged diff خالی است.
بازبینی نهایی محدوده، هر ۱۶ فایل تغییرکرده را با فهرست و لینک‌های این گزارش
تطبیق داد؛ Frontend، schema، migration، dependency/lockfile و persistence قبلی
تغییر نکرده‌اند. whitespace و لینک‌های فایل‌ها نیز بررسی و تأیید شدند.

## فایل‌های تغییرکرده

- [Backend/app/domain/website.py](../../app/domain/website.py)
- [Backend/app/domain/error/exception_handlers.py](../../app/domain/error/exception_handlers.py)
- [Backend/app/application/use_cases/website/__init__.py](../../app/application/use_cases/website/__init__.py)
- [Backend/app/application/use_cases/website/create_use_case.py](../../app/application/use_cases/website/create_use_case.py)
- [Backend/app/application/use_cases/website/get_all_use_case.py](../../app/application/use_cases/website/get_all_use_case.py)
- [Backend/app/application/use_cases/website/get_by_id_use_case.py](../../app/application/use_cases/website/get_by_id_use_case.py)
- [Backend/app/interface/controller/api.py](../../app/interface/controller/api.py)
- [Backend/app/interface/controller/website_controller.py](../../app/interface/controller/website_controller.py)
- [Backend/app/interface/dependencies/website_dependencies.py](../../app/interface/dependencies/website_dependencies.py)
- [Backend/app/interface/dto/website_dto.py](../../app/interface/dto/website_dto.py)
- [Backend/app/interface/mappers/website_mapper.py](../../app/interface/mappers/website_mapper.py)
- [Backend/tests/unit/test_website_api_use_cases.py](../../tests/unit/test_website_api_use_cases.py)
- [Backend/tests/integration/test_websites_http.py](../../tests/integration/test_websites_http.py)
- [Backend/README.md](../../README.md)
- [Backend/docs/validation/BE-018-own-websites-api.md](BE-018-own-websites-api.md)
- [docs/backlog.md](../../../docs/backlog.md)

پیام Commit پیشنهادی، بدون اجرای Commit:

```text
feat(backend): implement BE-018 owner-scoped website APIs
```
