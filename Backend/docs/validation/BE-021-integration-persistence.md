# BE-021 — persistence اتصال و نگهداری امن credential

تاریخ: **۲۰۲۶-۱۰-۲۳، Asia/Tehran**. وضعیت اولیهٔ Git پاک، branch برابر `main` و
HEAD برابر `3123542` بود. راهنمای مشترک و Backend، تصمیم‌های MVP، Backlog، مدل و
repository سایت، BE-003/BE-020 و گزارش EXT-001 بررسی شدند. پیش‌نیازهای BE-003 و
BE-020 تکمیل‌اند؛ EXT-001 همچنان باز است و وابستگی این تسک نیست.

## پلن و محدوده

پلن پیش از پیاده‌سازی: مدل immutable اتصال، port ذخیره‌سازی و قرارداد credential؛
رمزنگاری با کلید مستقل؛ migration و repository مالکانه با CAS؛ جداسازی تاریخچهٔ
property؛ TDD، آزمون PostgreSQL/migration و suite کامل، سپس مستندسازی و checkbox.

این تسک زیرساخت داخلی persistence است. endpoint، OAuth، انتخاب property از Google،
صف کار، گزارش تحلیلی یا تغییر Frontend ندارد. ایجاد رکورد، شاهد مجوز Google نیست؛
بررسی permission و ارتباط property/account با سایت در تسک‌های provider انجام می‌شود.

## نتیجهٔ معیارهای پذیرش

| معیار | پیاده‌سازی و شاهد |
|---|---|
| حفظ owner/site/source/property | IntegrationEntity بدون فیلد secret؛ FK مرکب سایت/مالک، source محدود به ga4/gsc/ads و شناسهٔ property/account بدون normalization. persistence پس از تعویض pool و در interpreter مستقل خوانده شد. |
| credential رمزنگاری شود و کلید جدا بماند | refresh token فقط در جدول جدا و به‌صورت AES-256-GCM؛ کلید خصوصی مستقل در تنظیمات Backend و خارج SQL؛ nonce تصادفی، AAD وابسته به هویت/revision، رد ciphertext دست‌کاری‌شده، swap، کلید اشتباه و replay نسخهٔ قبل. |
| تاریخچهٔ تعویض property مخلوط نشود | A→B→A سه integration ID مستقل می‌سازد؛ metadata قبلی retired و credential محلی آن حذف می‌شود. FK آزمایشی تاریخچه روی شناسهٔ قدیمی باقی ماند و به انتخاب جدید منتقل نشد؛ تست رقابت و rollback اتمی موفق‌اند. |

همهٔ معیارهای این تسک با موفقیت بررسی شدند؛ فقط checkbox BE-021 تکمیل شد. EXT-001
و سایر تسک‌ها/شرح معیارهای Backlog تغییر نکردند.

## معماری و قرارداد داخلی

- `IntegrationEntity` هویت و انتقال‌های immutable renew/retire را نگه می‌دارد؛
  برای property متفاوت همیشه رکورد تازه ساخته می‌شود. property و شناسه‌های metadata قدیمی دست‌نخورده
  می‌ماند و فقط وضعیت retirement، زمان به‌روزرسانی و revision آن تغییر می‌کنند.
- `OAuthCredential` قرارداد Application برای refresh token پایدار است؛ token از
  repr حذف شده و اصلاً عضو Entity عمومی نیست. access token کوتاه‌عمر ذخیره نمی‌شود.
  اعتبارسنجی ورودی secret را در پیام خطا تکرار نمی‌کند. سقف ۱۶ KiB برای بایت token،
  ۲۰۴۸ بایت برای property و ۱۲۸ بایت برای شناسه‌های داخلی، حدود فنی persistence
  هستند و سهمیهٔ حساب/پلن نیستند.
- `IIntegrationRepository` قرارداد metadata/selection/secret read را جدا می‌کند.
  dependency موجود FastAPI، همان session و transaction پروژه را به adapter می‌دهد؛
  route جدید یا auth موازی اضافه نشده است. caller آینده باید owner را از هویت
  معتبر سرور بگیرد و نشست زنده را کنترل کند، نه از بدنهٔ ورودی.
- repository در تمام مسیرها حساب فعال و سایت تأییدشدهٔ جاری متعلق به همان owner
  را کنترل می‌کند. missing، foreign، released و unverified خطای ثابت می‌دهند.
  metadata تاریخی فقط در محدودهٔ همان سایت/مالک قابل خواندن است؛ credential تاریخی
  قابل خواندن نیست. نقش Admin مجوز خودکار سایت دیگری ایجاد نمی‌کند.
- نوشتن و خواندن secret، به ترتیب account، hostname advisory و website قفل می‌گیرند؛
  ساعت پس از گرفتن قفل از PostgreSQL خوانده می‌شود. تراکنش متعلق به caller است و
  باید پیش از I/O گوگل تمام شود. job آینده باید مجوز و اتصال را دوباره کنترل کند.
- `save_selection(..., expected=...)` یک CAS صریح است: `None` یعنی هیچ اتصال جاری
  نباید موجود باشد؛ snapshot قبلی باید دقیقاً مطابق رکورد جاری باشد. پاسخ دیررس یا
  رقابت، Conflict می‌دهد. caller نباید با خواندن مجدد و overwrite خاموش، CAS را دور بزند.
- همان property با token تازه، همان ID و revision جدید می‌گیرد. `credential=None`
  فقط برای همان property، credential قبلی را decrypt و با revision تازه encrypt
  می‌کند. property جدید بدون credential رد می‌شود؛ token منبع/property قبلی به آن
  به‌طور ضمنی منتقل نمی‌شود. رمزنگاری پیش از تغییر وضعیت قبلی انجام می‌شود.
- تعویض property، retirement و حذف credential قبلی را با درج هویت/credential جدید
  در یک تراکنش انجام می‌دهد. rollback همهٔ این تغییرها را برمی‌گرداند. این primitive
  ذخیره‌سازی، BE-034 نیست: لغو grant در Google و توقف jobها در این تسک اجرا نمی‌شوند.

## رمزنگاری، کلید و تنظیمات

`INTEGRATION_CREDENTIAL_KEY` یک SecretStr خصوصی با `repr=False` و `exclude=True` است:
base64url canonical دارای padding از دقیقاً ۳۲ بایت تصادفی مستقل. هیچ کلید واقعی در
این تسک تولید/ذخیره نشد؛ تست‌ها فقط کلید و token مصنوعی مستقل از حساب واقعی دارند.
نمونهٔ env تنها placeholder کامنت‌شده است. کلید باید جدا از SQL و backup دیتابیس
و مستقل از کلیدهای CSRF، JWT و ایمیل provision شود؛ در متغیر عمومی Frontend قرار نگیرد.

فرمت envelope برابر نسخهٔ یک‌بایتی، nonce تصادفی ۱۲بایتی و خروجی AES-GCM با tag کامل
است. AAD یک آرایهٔ JSON نسخه‌دار شامل integration ID، owner، website، source، property
و revision است. ciphertext متفاوت برای token یکسان، صحت nonce، tamper، swap و
نامعتبرشدن ciphertext revision قبلی آزموده شده‌اند. خطای decode/decrypt یا کلید
اشتباه به پیام ثابت credential-unavailable تبدیل می‌شود؛ plaintext fallback نداریم.

انتخاب الگوریتم و جداسازی کلید با
[مستندات cryptography 46.0.3](https://cryptography.io/en/46.0.3/hazmat/primitives/aead/)
و [OWASP Cryptographic Storage](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
تطبیق داده شد. dependency موجود cryptography با بازهٔ `>=46.0.3,<47` مستقیم اعلام
شد؛ resolution همان **46.0.3** ماند. مقایسهٔ همهٔ رکوردهای package در lockfile با HEAD
برابری کامل نسخه‌ها و hashها را تأیید کرد؛ فقط content_hash ورودی تغییر کرد.

startup کلید ارائه‌شده را validate و schema جدید را کنترل می‌کند. نبود کلید فقط
پیش از وجود credential row مجاز است؛ dependency اتصال همیشه کلید صریح می‌خواهد.
اگر credential ذخیره شده باشد و کلید حذف شود، startup خطا می‌دهد. کلید دارای فرمت
درست ولی محتوای اشتباه هنگام decrypt رد می‌شود؛ startup همهٔ رکوردها را decrypt
نمی‌کند. این نسخه یک کلید deployment دارد؛ rotation خودکار یا CLI re-encryption
ساخته نشده است. گم‌کردن/تعویض کلید بدون برنامهٔ recovery، envelope قبلی را قابل‌خواندن
نمی‌کند. کلید قبلی باید در سازوکار امن و مستقل بازیابی نگه‌داری شود.

## Migration و سازگاری

`0010_integrations` پس از `0009_websites` اجرا می‌شود:

- Unique مرکب `(id, owner_id)` روی websites برای FK مالکانه.
- `integrations` با FK مرکب `(website_id, owner_id)` و unique جزئی سایت/source جاری؛
  قیود source، شناسه‌ها، timestamp و revision.
- `integration_credentials` با FK به integration و ciphertext دارای framing محدود؛
  بدون ستون key، refresh token یا access token خام.

ارتقا از schema خالی و نسخهٔ قبلی، اجرای مجدد، حفظ همهٔ داده‌های قبلی و برابری
metadata/migration روی PostgreSQL بررسی شدند. downgrade به 0009 فقط جداول اتصال و
credential و constraint اضافه‌شده را حذف می‌کند؛ آزمون با credential رمز‌شده و
دادهٔ قبلی سایت/هویت انجام شد. downgrade مخرب دادهٔ BE-021 است، روش recovery token
نیست و فقط روی دیتابیس موقت اجرا شد.

تست migration قبلی سایت فقط برای head جدید و دو جدول افزوده هماهنگ شد؛ assertion
حفظ داده، metadata و scope downgrade حذف یا ضعیف نشد. OpenAPI واقعی قبل/بعد عیناً
برابر و دارای **۲۵ path** است. Frontend و طراحی مصوب آن تغییر نکردند؛ بازتولید Orval
یا build لازم نبود و اجرا نشد.

## TDD و نتایج آزمون

محیط: Python **3.12.14**، PDM **2.29.2**، Pytest **9.0.1** و cryptography **46.0.3**.
دستورات زیر از Backend و با `DATANO_TEST_DATABASE_URL` دیتابیس موقت اجرا شدند:

```sh
pdm run pytest --ignore=tests/unit/test_integration_credentials.py -q --tb=short --show-capture=no
pdm run pytest tests/unit/test_integration_credentials.py -q --tb=short --show-capture=no
pdm run pytest tests/unit/test_integration_entity.py -q --tb=short --show-capture=no
pdm run pytest tests/integration/test_integration_persistence.py -q --tb=short --show-capture=no
pdm run pytest tests/integration/test_integration_migration.py -q --tb=short --show-capture=no
pdm run pytest tests/unit/test_integration_credentials.py tests/unit/test_integration_entity.py tests/unit/test_integration_settings.py tests/unit/test_integration_storage_errors.py tests/integration/test_integration_persistence.py tests/integration/test_integration_migration.py --cov=app.domain.entities.integration_entity --cov=app.application.use_cases.integration.credentials --cov=app.infra.services.integration_credentials --cov=app.infra.repositories.postgres.integration_repository --cov=app.interface.dependencies.integration_dependencies --cov-branch --cov-report=term-missing -q --tb=short --show-capture=no
pdm run pytest -q --tb=short --show-capture=no
pdm lock --update-reuse
pdm lock --check
pdm run python -m compileall -q app migrations tests
git diff --check
```

- baseline کامل پیش از تغییر رفتار موجود: **۱۴۰۹ passed، ۱۸۰٫۲۶ ثانیه**.
- Red رمزنگاری: **۱ failed، ۰٫۶۶ ثانیه**؛ stub plaintext را بازمی‌گرداند. بعد از
  پیاده‌سازی، ۲۲ تست credential موفق شدند. شکست import یا dependency نبود.
- Red مدل: **۱ failed و ۲۲ passed، ۰٫۵۶ ثانیه**؛ create اسکلت به‌جای Entity مقدار
  None می‌داد. تست‌های مدل بعد از پیاده‌سازی موفق شدند.
- Red ذخیره‌سازی: **۱ failed، ۰٫۸۲ ثانیه**؛ adapter اسکلت رکوردی ذخیره نمی‌کرد.
  Green اولیهٔ مدل/crypto/persistence: **۴۹ passed، ۰٫۹۶ ثانیه**.
- Red startup با نسخهٔ 0009: **۱ failed، ۰٫۹۷ ثانیه**؛ برنامه با schema قدیمی به‌اشتباه
  شروع می‌شد. کنترل revision جدید اضافه شد و همان آزمون موفق شد.
- Red تکمیلی timestampهای None: **۲ failed و ۲۶ passed، ۰٫۵۶ ثانیه**؛ TypeError
  به‌جای ValidationException. validate صریح timestampهای اجباری اصلاح شد.
- مجموعهٔ نهایی متمرکز: **۱۰۷ passed، ۱۲٫۴۶ ثانیه**؛ ۶۷ تست واحد و ۴۰ تست PostgreSQL/
  migration. owner isolation، missing/unverified/released/inactive، CAS، رقابت،
  A→B→A، rollback، constraints، token غایب، tamper، جابه‌جایی ciphertext، کلید اشتباه،
  restart و خطای امن driver بررسی شدند.
- پوشش scoped پنج ماژول: **۹۹٪** از ۲۴۱ statement و ۵۶ branch؛ domain، credential
  contract و DI صددرصد، repository برابر ۹۸٪ و crypto برابر ۹۷٪. شکاف‌ها شامل guard
  تغییر سایت میان دو خواندن پس از قفل hostname و handler دفاعی خطای base64 پس از
  regex سخت‌گیر هستند. این عدد پوشش کل پروژه یا آستانهٔ جدید نیست.
- suite کامل پس از آخرین تغییر کد/تست: **۱۵۱۶ passed، ۱۹۸٫۹۹ ثانیه**؛ ۱۴۰۹ رگرسیون
  قبلی و ۱۰۷ تست جدید، بدون failure/error/skip/warning.
- compileall، lock check، مقایسهٔ lock و OpenAPI و whitespace: موفق. compileall
  جای linter/type-checker کامل Backend نیست؛ چنین ابزاری پیکربندی نشده است.

دو اصلاح fixture نیز شفاف ثبت می‌شوند: کلید مصنوعی اولیه ۳۳بایتی بود و یک setup
error داد؛ قبل از Red رفتاری persistence به ۳۲ بایت اصلاح شد. تست FK مالک ابتدا
به unique همان source برخورد می‌کرد؛ source مستقل به fixture داده شد تا FK واقعی
جدا سنجیده شود. این دو مورد به‌عنوان Red محصول شمرده نمی‌شوند. PDM lock در sandbox
اجازهٔ نوشتن log نداشت؛ با دسترسی لازم موفق شد و هیچ package نصب/ارتقا داده نشد.

## محیط آزمایشی و محدودیت‌ها

کانتینر تازهٔ `datano-be021-validation` از تصویر موجود `postgres:17-alpine`، با
دیتابیس `datano_test_be021` روی tmpfs، پورت loopback و AutoRemove اجرا شد. هیچ volume
یا دیتابیس قبلی برنامه استفاده نشد؛ fixtureهای موجود برای هر تست schema مستقل
می‌سازند و پاک می‌کنند. runner و credential تصادفی DB در مسیر محدود
`/private/tmp/datano-be021-a43wxk2c` با فایل env دارای mode 0600 قرار دارند؛ مقدار
credential در چت، argv یا گزارش چاپ نشد. خروجی XML آزمون‌ها نیز در همین مسیر است.

بررسی نهایی، PostgreSQL **17.11**، tmpfs، loopback، AutoRemove و **صفر schema آزمایشی
باقی‌مانده** را تأیید کرد. شناسهٔ تصویر همان
`sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24` بود.
فقط کانتینر موقت همین تسک متوقف و با --rm حذف شد؛ تصویر و volumeهای قبلی حفظ شدند.
فایل env موقت پس از آزمون حذف شد؛ گزارش‌های آزمون و runner بدون secret باقی‌اند.
Google/SMTP، OAuth
واقعی، حساب/property واقعی و استقرار production آزموده نشدند؛ این‌ها معیار BE-021
نیستند و تکمیل EXT-001 یا BE-022 ادعا نمی‌شود. آزمون persistence از PostgreSQL و
رمزنگاری واقعی با ورودی مصنوعی استفاده می‌کند، نه مخزن fake. تاریخچهٔ آزمایشی فقط
یک جدول fixture با FK است و schema تحلیلی زودهنگام وارد محصول نشده است.

## فایل‌ها و Git

تغییرات در Backend و checkbox همان تسک در docs محدودند؛ Frontend دست‌نخورده است.

- `.env.example`، `README.md`، `pyproject.toml` و `pdm.lock`.
- `app/domain/entities/__init__.py` و `app/domain/entities/integration_entity.py`.
- `app/application/use_cases/integration/__init__.py` و `credentials.py`.
- `app/interface/repository/integration_repository_interface.py` و
  `app/interface/dependencies/integration_dependencies.py`.
- `app/infra/services/integration_credentials.py` و
  `app/infra/repositories/postgres/integration_repository.py`.
- `app/infra/core/config.py`، `app/infra/database/models.py` و `app/main.py`.
- `migrations/versions/0010_integrations.py`.
- `tests/unit/test_integration_credentials.py`، `test_integration_entity.py`،
  `test_integration_settings.py` و `test_integration_storage_errors.py`.
- `tests/integration/test_integration_persistence.py`، `test_integration_migration.py`
  و هماهنگی `test_website_migration.py`.
- همین گزارش و `docs/backlog.md` مشترک، فقط checkbox BE-021.

هیچ Stage، Commit، Push، تغییر Branch یا انتشار انجام نشده است. پیام پیشنهادی، بدون اجرا:

```text
BE-021 feat(backend): persist isolated integrations with encrypted credentials
```
