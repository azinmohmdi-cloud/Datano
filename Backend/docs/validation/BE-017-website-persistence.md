# BE-017 — مدل و ذخیره‌سازی پایدار سایت

تاریخ: ۲۰۲۶-۱۰-۲۲، منطقهٔ زمانی Asia/Tehran. پیش‌نیازهای `FE-030` و `BE-003`
در Backlog تکمیل بودند و کد و گزارش‌هایشان بررسی شد. وضعیت اولیهٔ Git پاک بود.
محدودهٔ این تسک Backend و مستندات مرتبط است؛ Frontend و طراحی تأییدشده حفظ شدند.

## پیاده‌سازی و معیارهای پذیرش

| معیار | پیاده‌سازی و شاهد |
|---|---|
| hostname canonical | lowercase، IDNA با UTS #46 غیرانتقالی و حذف نقطهٔ انتهایی؛ آزمون دامنهٔ فارسی، punycode، طول label/hostname، ورودی مخرب و تفاوت `faß.de` با `fass.de` موفق است. |
| استقلال www و subdomain | دامنهٔ اصلی، www و زیردامنه رکوردهای مستقل می‌گیرند؛ یک حساب چند سایت دارد و میزبان‌های مستقل می‌توانند مالکان متفاوت داشته باشند. |
| مالک یکتا | `owner_id` اجباری و FK به users است؛ حذف مستقیم مالک با RESTRICT رد می‌شود؛ روش تغییر مالک وجود ندارد و تمام خواندن‌های repository به owner محدودند. |
| وضعیت challenge | رکورد جدید تأییدنشده با رزرو ۲۴ساعته است؛ فقط digest ۳۲بایتی، زمان صدور، انقضا و تأیید ذخیره می‌شوند. بدون صدور واقعی، challenge تهی می‌ماند. وضعیت از زمان‌های ذخیره‌شده مشتق می‌شود؛ مرز دقیق انقضا تست شده است. |
| قیود دیتابیس | migration جدید، FK، NOT NULL، CHECKهای hostname/scheme/زمان‌ها و سازگاری challenge و unique index میزبان جاری روی PostgreSQL واقعی آزمایش شده‌اند. |
| رقابت ثبت | ثبت هم‌زمان دو مالک و ثبت تکراری یک مالک، canonicalهای هم‌ارز و جایگزینی رزرو منقضی تست شدند؛ درج مستقیم هم‌زمان بدون repository هم با unique index فقط یک برنده دارد. |

## تصمیم‌های ذخیره‌سازی

- ساختار لایه‌ای `Backend/app/` حفظ شده است: entity و canonical‌سازی در domain،
  قرارداد repository در interface و ORM/پیاده‌سازی SQL در infrastructure.
- هر hostname جاری فقط یک رکورد دارد؛ شاخص یکتای شرطی `released_at IS NULL`
  این قاعده را اعمال می‌کند. قفل advisory در سطح transaction بر hostname canonical
  و قفل سطر، ثبت و تغییر وضعیت را با هم هماهنگ می‌کنند. زمان انقضا از ساعت PostgreSQL
  **پس از گرفتن قفل** بررسی می‌شود؛ transaction را caller مدیریت می‌کند.
- ثبت تکراری همان مالک همان ID را برمی‌گرداند و scheme یا زمان رزرو را تمدید نمی‌کند.
  ثبت حساب دیگر روی رزرو معتبر یا سایت تأییدشده فقط خطای ثابت
  `Website is unavailable` می‌دهد؛ اطلاعات مالک در خطا نیست.
- رزرو تأییدنشدهٔ منقضی برای مالک دیگر قابل جایگزینی است. رکورد قبلی با مالک و ID
  سابق حفظ و از حالت جاری خارج می‌شود؛ رکورد تازه هیچ proof یا سابقه‌ای به ارث
  نمی‌برد. آزادسازی قبلی و درج جدید با هم commit/rollback می‌شوند.
- ورودی نامعتبر پیش از هر تغییر رزرو رد می‌شود. شکست FK یا عملیات بعدی، تمام تغییرات
  transaction را rollback می‌کند. این رفتار با خواندن مجدد state آزمایش شده است.
- `save_verification` صرفاً primitive ذخیره‌سازی state معتبر است؛ هویت/مالک/scheme
  را تغییر نمی‌دهد، timestamp قبلی را با CAS کنترل می‌کند و رکورد stale، released
  یا تأییدشده را بازنویسی نمی‌کند. تولید token، تطبیق digest با HTML و اثبات مالکیت
  در این تسک پیاده‌سازی نشده‌اند و متعلق به `BE-020` هستند.
- `idna` نسخهٔ 3.11 از قبل در گروه default و محیط نصب‌شده بود. وابستگی مستقیم آن
  در pyproject ثبت شد. هیچ نسخه، hash بسته یا بستهٔ نصب‌شده‌ای عوض نشد؛ فقط
  content_hash فایل قفل توسط API محلی PDM هماهنگ و `pdm lock --check` تأیید شد.

## migration و سازگاری

revision جدید `0009_websites` پس از `0008_admin_grants` فقط جدول websites و
قیود/شاخص‌های آن را اضافه می‌کند. نصب خالی، ارتقا از revision قبلی، اجرای دوباره،
تطبیق metadata با ORM و downgrade روی schemaهای آزمایشی بررسی شدند. داده‌های
قبلی حساب‌ها، نقش‌ها و نشست‌ها پیش و پس از migration مقایسه و حفظ شدند.

startup در صورت نبود جدول سایت‌ها خطای `run alembic upgrade head` می‌دهد و schema
نمی‌سازد. migration هیچ دیتابیس application یا production اجرا نشده است.
downgrade به `0008_admin_grants` رکوردهای سایت را حذف می‌کند؛ این پیامد در README
ثبت شده و آزمایش downgrade فقط روی schema موقت انجام شده است.

تست تاریخی migration مدیر اکنون به‌صراحت revision خودش، `0008_admin_grants`، را
هدف می‌گیرد؛ بررسی نهایی metadata همچنان بعد از ارتقا به head اجرا می‌شود. هیچ
assertion مربوط به حفظ داده یا کنترل schema حذف نشده است.

OpenAPI واقعی با خروجی واقعی ثبت‌شدهٔ `FE-033` مقایسه شد و دقیقاً یکسان است:
۲۱ path. بنابراین تولید Orval یا تغییر مصرف‌کنندهٔ Frontend لازم نبود.

## TDD و اعتبارسنجی

- Red نخست: تست migration روی PostgreSQL واقعی با نبود جدول websites شکست خورد:
  **۱ failed، ۰٫۸۲ ثانیه**. شکست import/fixture نبود. بعد از پیاده‌سازی همان تست موفق شد.
- Red مرزی: درخواست رزرو منقضی/آینده، در صورت catch شدن خطا، رزرو قبلی را آزاد
  می‌کرد: **۲ failed، ۰٫۹۷ ثانیه**. اعتبارسنجی پیش از mutation منتقل شد؛ هر دو
  regression همراه مجموعهٔ نهایی موفق‌اند.
- مجموعهٔ مرتبط با migrationهای قبلی: **۱۵۶ passed، ۱۱٫۶۰ ثانیه**.
- مجموعهٔ اختصاصی نهایی با branch coverage: **۱۳۳ passed، ۱۰٫۹۵ ثانیه**؛
  domain entity و canonical‌سازی ۱۰۰٪، repository برابر ۹۴٪ و مجموع ۹۷٪.
  سه statement پوشش‌نداده مربوط به ترجمهٔ خطاهای دفاعی CHECK/NOT NULL/طول و
  بازپرتاب خطاهای ناشناختهٔ driver است؛ مسیرهای معمول پیش از SQL اعتبارسنجی می‌شوند.
  آستانهٔ coverage سراسری ادعا نشده است.
- suite کامل Backend: **۱۰۰۵ passed، ۱۳۵٫۹۰ ثانیه**؛ بدون شکست، skip یا warning.
  تمام ۸۷۲ تست قبلی و ۱۳۳ تست جدید، شامل migrationها، قیود، هویت، مجوز و نشست‌ها
  اجرا و موفق شدند.

دستورات اجراشده از Backend، با Python 3.12.14 و PDM 2.29.2:

```sh
pdm run pytest tests/unit/test_website_entity.py \
  tests/integration/test_website_persistence.py tests/integration/test_website_migration.py \
  tests/integration/test_admin_grants.py tests/integration/test_persistence_migrations.py \
  -q --tb=short --show-capture=no
pdm run pytest tests/unit/test_website_entity.py \
  tests/integration/test_website_persistence.py tests/integration/test_website_migration.py \
  --cov=app.domain.website --cov=app.domain.entities.website_entity \
  --cov=app.infra.repositories.postgres.website_repository \
  --cov-branch --cov-report=term-missing -q --tb=short --show-capture=no
pdm run pytest -q --tb=short --show-capture=no
pdm run python -m compileall -q app migrations tests/unit/test_website_entity.py \
  tests/integration/test_website_persistence.py tests/integration/test_website_migration.py
pdm lock --check
git diff --check
```

بررسی syntax، تطبیق lock و مقایسهٔ OpenAPI موفق‌اند. compileall فقط بررسی syntax
است؛ linter یا type-checker بک‌اند پیکربندی نشده است.

اجرای نخست تست PostgreSQL در sandbox به‌دلیل منع اتصال localhost شکست زیرساختی
داشت و Red رفتاری محسوب نشد؛ اجرای مجاز خارج از محدودیت شبکه روی محیط ایزوله انجام شد.
`pdm lock --refresh` ابتدا به مسیر لاگ دسترسی نداشت و اجرای مجاز آن در بازخوانی
hashها معطل ماند و متوقف شد؛ این فرمان موفق گزارش نشده است. هماهنگ‌سازی آفلاین
metadata با API خود PDM، برابری تمام packageها/hashها و lock-check مستقل تأیید شدند.

## محیط ایزوله و مرز تحویل

PostgreSQL از تصویر موجود با digest زیر اجرا شد، بدون دانلود تصویر یا نصب بسته:

```text
postgres@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24
```

کانتینر `datano-be017-validation` فقط tmpfs متعلق به تسک، publication روی loopback
و دیتابیس `datano_test_be017` داشت؛ هیچ volume قبلی mount نشد. fixture موجود
برای هر تست schema مستقل می‌سازد و پاک می‌کند. تنظیمات و runner خصوصی زیر
`/private/tmp/datano-be017`، بیرون مخزن و با دسترسی محدود قرار دارند؛ رمز چاپ نشده است.

بررسی نهایی PostgreSQL نسخهٔ 17.11، موفقیت `SELECT 1` و صفر schema آزمایشی
باقی‌مانده را تأیید کرد. inspect کانتینر، tmpfs و publication فقط روی 127.0.0.1
و AutoRemove را تأیید کرد. سپس فقط کانتینر همین تسک متوقف شد و با سیاست `--rm`
حذف شد؛ تصویر موجود و volumeهای قبلی حفظ شدند.

این تسک API ثبت سایت، URL parsing، DNS/SSRF، دریافت HTML، صدور challenge یا اتصال
Frontend را تحویل نمی‌دهد. تست Frontend/build/Orval اجرا نشد چون هیچ فایل Frontend
یا قرارداد HTTP عوض نشد. هیچ ایمیل واقعی یا تماس با گوگل/سایت خارجی انجام نشد.

هیچ Stage، Commit، Push یا تغییر Branch انجام نشده است.

## فایل‌ها و وضعیت نهایی

فایل‌های تغییرکرده یا افزوده‌شده:

- [Backend/app/domain/website.py](../../app/domain/website.py)
- [Backend/app/domain/entities/website_entity.py](../../app/domain/entities/website_entity.py)
- [Backend/app/domain/entities/__init__.py](../../app/domain/entities/__init__.py)
- [Backend/app/interface/repository/website_repository_interface.py](../../app/interface/repository/website_repository_interface.py)
- [Backend/app/infra/repositories/postgres/website_repository.py](../../app/infra/repositories/postgres/website_repository.py)
- [Backend/app/infra/database/models.py](../../app/infra/database/models.py)
- [Backend/app/main.py](../../app/main.py)
- [Backend/migrations/env.py](../../migrations/env.py)
- [Backend/migrations/versions/0009_websites.py](../../migrations/versions/0009_websites.py)
- [Backend/pyproject.toml](../../pyproject.toml)
- [Backend/pdm.lock](../../pdm.lock)
- [Backend/tests/unit/test_website_entity.py](../../tests/unit/test_website_entity.py)
- [Backend/tests/integration/test_website_persistence.py](../../tests/integration/test_website_persistence.py)
- [Backend/tests/integration/test_website_migration.py](../../tests/integration/test_website_migration.py)
- [Backend/tests/integration/test_admin_grants.py](../../tests/integration/test_admin_grants.py)
- [Backend/README.md](../../README.md)
- [Backend/docs/validation/BE-017-website-persistence.md](BE-017-website-persistence.md)
- [docs/backlog.md](../../../docs/backlog.md)

تمام معیارهای `BE-017` تأیید شدند و فقط checkbox همین تسک به `[x]` تغییر کرد؛
شناسه‌ها، شرح تسک‌ها، سایر وضعیت‌ها و Epicها حفظ شدند. هیچ تسک بعدی شروع نشد.
تغییرات unstaged هستند و staged diff خالی است.

پیام Commit پیشنهادی، بدون اجرای Commit:

```text
feat(backend): implement BE-017 website persistence
```
