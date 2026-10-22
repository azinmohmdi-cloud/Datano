# BE-020 — تولید و بررسی challenge مالکیت

تاریخ: ۲۰۲۶-۱۰-۲۲، منطقهٔ زمانی Asia/Tehran. وضعیت اولیهٔ Git پاک، Branch برابر
main و HEAD برابر `dc811b2` بود. راهنماهای مشترک و Backend، معماری و قرارداد
Frontend، تصمیم‌های MVP و UX، Backlog و گزارش‌های BE-017 تا BE-019 و FE-034
بررسی شدند. این تسک فقط challenge و تأیید Backend را تحویل می‌دهد؛ اتصال صفحهٔ
تأیید در FE-035 باقی می‌ماند.

## پلن و نتیجهٔ پذیرش

پلن پیش از پیاده‌سازی: مدل انتقال وضعیت و قراردادهای مستقل رمزنگاری/HTML/persistence،
صدور digest با اعتبار دقیق ۲۴ساعته، بررسی meta واقعی با دریافت امن BE-019، کنترل مجدد
نشست/مالک/انقضا در تراکنش کوتاه، سپس TDD، تست PostgreSQL و HTTP، بررسی مصرف‌کنندهٔ
OpenAPI و مستندسازی. وابستگی‌های BE-017، BE-018 و BE-019 حفظ شدند.

| معیار | نتیجه و شاهد |
|---|---|
| وابسته به حساب/سایت و ۲۴ساعته | token تصادفی ۲۵۶بیتی، digest با زمینهٔ owner/site/hostname/scheme؛ انقضا دقیقاً زمان صدور +۲۴ ساعت و در مرز انقضا نامعتبر. replay در سایت/حساب دیگر و تغییر وضعیت حین دریافت تست شده است. |
| ذخیرهٔ digest | فقط SHA-256 ذخیره می‌شود؛ plaintext تنها در پاسخ خصوصی صدور است. خواندن پس از restart و بررسی عدم افشا در فهرست، جزئیات، repr و log تست شده‌اند. |
| meta tag واقعی | parser ساختاری، یک meta بدون ابهام در head صریح و بسته را می‌پذیرد. متن، comment، markup escaped، body، script، template و ساختارهای مبهم رد می‌شوند. آزمون TLS واقعی از دریافت HTML تا API و PostgreSQL وجود دارد. |
| اشتباه/منقضی مجوز نسازد | خطای ثابت 409 بدون verified_at؛ وضعیت قبل و بعد از HTML دوباره کنترل می‌شود. rotation، خروج، غیرفعال‌سازی، انقضای نشست و جایگزینی سایت حین fetch همگی تأیید دیررس را رد می‌کنند. |

## قرارداد و معماری

دو مسیر POST با cookie نشست opaque و CSRF موجود، بدنهٔ اجباری `{}` دارند:

- `/api/websites/{website_id}/challenge`: envelope موجود با payload شامل
  `website` عمومی، `token` و `meta_tag` دقیق برای کپی.
- `/api/websites/{website_id}/verify`: دریافت HTML صفحهٔ اصلی از آدرس canonical
  ذخیره‌شده و payload سایت عمومی پس از تأیید معتبر؛ تأیید تکراری سایت تأییدشده idempotent است.

موفقیت HTTP 200 با `Cache-Control: no-store` و `Vary: Cookie` است. ورودی owner، URL،
token، زمان یا وضعیت رد می‌شود. مالک از نشست فعال تعیین می‌شود. foreign/missing/released
همگی 404 یکسان دارند؛ نشست نامعتبر 401، CSRF نامعتبر 403، challenge نامعتبر/منقضی/چرخیده
409 با `WEBSITE_CHALLENGE_INVALID`، بدنهٔ بزرگ 413، ورودی نامعتبر 422، quota فنی 429
با Retry-After و اختلال دریافت/ذخیره‌سازی 503 امن دارند. خطاهای ورودی شامل مقدار خام نیستند.

`IssueWebsiteChallengeUseCase` و `VerifyWebsiteChallengeUseCase` به portهای جدا وابسته‌اند.
`WebsiteEntity` انتقال‌های immutable را کنترل می‌کند. `WebsiteChallengeTokens` با
`secrets.token_urlsafe(32)` مقدار ۴۳کاراکتری می‌سازد و SHA-256 را روی آرایهٔ JSON با
پیشوند نسخه‌دار و شناسه‌های زمینه حساب می‌کند. entropy بالا نیازی به KDF رمز عبور یا
secret جدید ایجاد نمی‌کند؛ مقایسهٔ digest با `hmac.compare_digest` است.

صدور مجدد، قبلی را باطل و رزرو را تا همان انقضای ۲۴ساعتهٔ جدید تمدید می‌کند. مالک جاری
می‌تواند challenge منقضی را تجدید کند؛ رکورد آزاد/جایگزین‌شده قابل احیا نیست. سایت
تأییدشده challenge جدید نمی‌گیرد و تأیید تکراری مجوز جدید ایجاد نمی‌کند. API دریافت
plaintext قبلی وجود ندارد؛ Frontend باید پاسخ صدور را در state خصوصی موقت نگه دارد.

`SQLWebsiteProofRepository` تراکنش‌های کوتاه دارد: ترتیب قفل account/session موجود،
قفل advisory همان hostname در ثبت، قفل row و compare-and-swap وضعیت کامل. ساعت دیتابیس
پس از انتظار قفل خوانده و نشست دوباره بررسی می‌شود. هنگام HTML هیچ تراکنش یا قفل نشست
باز نمی‌ماند؛ بررسی نهایی تغییر challenge/owner/session را پس از شبکه رد می‌کند.
هم‌زمانی دو تأیید یک challenge idempotent است؛ صدورهای رقیب نمی‌توانند نتیجهٔ stale ذخیره کنند.

`WebsiteMetaParser` از HTMLParser استاندارد استفاده می‌کند؛ JavaScript و entity خارجی
اجرا/دریافت نمی‌شوند. فقط یک meta با name و content یکتا معتبر است. head ناقص، محتوای
غیرفعال و نشانه‌هایی که در مرورگر head را به body تبدیل می‌کنند نیز رد می‌شوند. UTF-8،
UTF-16/32 با BOM یا endianness صریح، ASCII، Latin-1 و Windows-1252 پشتیبانی می‌شوند؛
UTF-7، charset ناشناخته/تکراری و بایت نامعتبر رد هستند. این parser محافظه‌کارانهٔ source
است و DOM مرورگر یا renderer جاوااسکریپت نیست. tag را مستقیم داخل head معمول قرار دهید.
حد نهایی parser پنج MiB و حد دریافت همان تنظیم BE-019 است.

سه تنظیم server-only اضافه شد: `WEBSITE_PROOF_IP_LIMIT=20`،
`WEBSITE_PROOF_WINDOW_SECONDS=600` و `WEBSITE_PROOF_MAX_BODY_BYTES=1024`.
limiter PostgreSQL موجود با namespace مستقل `website-proof` بین دو مسیر مشترک است؛
CSRF پیش از quota و body/شبکه کنترل می‌شود. این محدودیت فنی peer است، نه سهمیهٔ پلن محصول.
عمر ۲۴ساعته ثابت است. migration، dependency، lockfile و secret جدید لازم نشدند.

## TDD و اعتبارسنجی

محیط: Python 3.12.14، PDM 2.29.2، Pytest 9.0.1؛ دستورات Backend از پوشهٔ Backend:

```sh
pdm run pytest tests/unit/test_website_challenge.py tests/integration/test_website_proof.py tests/integration/test_website_proof_http.py \
  --cov=app.application.use_cases.website.proof \
  --cov=app.infra.services.website_challenge_tokens \
  --cov=app.infra.services.website_meta_parser \
  --cov=app.infra.repositories.postgres.website_proof_repository \
  --cov=app.interface.controller.website_proof_controller \
  --cov-branch --cov-report=term-missing -q --tb=short --show-capture=no
pdm run pytest tests/integration/test_website_persistence.py tests/integration/test_website_proof.py tests/integration/test_website_proof_http.py -q --tb=short --show-capture=no
pdm run pytest -q --tb=short --show-capture=no
pdm run python -m compileall -q app tests/unit/test_website_challenge.py tests/integration/test_website_proof.py tests/integration/test_website_proof_http.py tests/integration/test_website_persistence.py
pdm lock --check
git diff --check
```

- Red اولیه: **۱ failed، ۰٫۴۹ ثانیه**؛ stub صدور همان entity بدون digest را برمی‌گرداند.
  همان تست پس از پیاده‌سازی **۱ passed، ۰٫۳۵ ثانیه** شد؛ شکست import یا dependency نبود.
- Red تکمیلی parser: **۳ failed، ۵۸ deselected، ۰٫۴۲ ثانیه** برای textarea، iframe و
  noscript نامعتبر که head مرورگر را می‌بندند. کنترل ساختار اصلاح و regressionها حفظ شدند؛
  حالت `</br>` و whitespace غیر HTML نیز افزوده شدند.
- مجموعهٔ نهایی متمرکز: **۱۱۸ passed، ۲۳٫۳۵ ثانیه**؛ ۶۳ واحد، ۱۳ integration ذخیره‌سازی
  و ۴۲ HTTP. چهار HTTP از TLS واقعی و adapter BE-019 استفاده می‌کنند.
- پوشش scoped: **۹۵٪** از ۲۷۴ statement و ۸۶ branch. tokens و controller صددرصد statement،
  parser برابر ۹۸٪، repository برابر ۹۵٪ و use case برابر ۸۸٪. شکاف‌ها شامل raiseهای
  abstract port، guard دفاعی token تولیدشده/URL نهایی نامعتبر، unknown_decl و شاخه‌های
  دفاعی CAS هستند. عدد پوشش کل پروژه یا آستانهٔ جدید ادعا نمی‌شود.
- اولین suite کامل: **۱۳۹۲ passed و ۱۷ failed، ۱۶۴٫۵۶ ثانیه**. شکست‌ها در تست‌های قبلی
  persistence سایت و شرط «رزرو در آینده نباشد» بودند؛ همهٔ تست‌های challenge موفق شدند.
  fixture قبلی ساعت Python را با ساعت PostgreSQL VM مقایسه می‌کرد. هنگام بررسی بعدی
  اختلاف زیر یک میلی‌ثانیه بود و دو تست منتخب با کد repository نسخهٔ HEAD نیز موفق شدند؛
  بنابراین بازتولید قطعی شکست با HEAD حاصل نشد و ادعای اثبات عیب قبلی مطرح نیست.
  fixture این فایل اکنون زمان را صریحاً از PostgreSQL می‌گیرد؛ هیچ assertion یا شرط
  محصول ضعیف نشد و موارد آینده/انقضا حفظ شدند. خطای syntax موقت هنگام ویرایش fixture
  پیش از اجرای مجدد اصلاح شد و شاهد Red رفتاری محسوب نمی‌شود.
- تست‌های persistence به‌همراه integration و HTTP چالش پس از این اصلاح:
  **۱۰۶ passed، ۲۴٫۸۳ ثانیه**.
- suite کامل پس از آخرین تغییر کد/تست: **۱۴۰۹ passed، ۱۶۲٫۳۹ ثانیه**، بدون failure/skip/warning؛ ۱۲۹۱ تست قبلی و ۱۱۸ تست جدید موفق‌اند.
- compileall، lock و whitespace: موفق؛ compileall جایگزین linter یا type-checker Backend نیست.

OpenAPI واقعی با Config مستقل از env خصوصی صادر شد: **۲۵ path**، شامل دو مسیر جدید؛
۲۳ مسیر و مدل‌های قبلی در مقایسه با خروجی BE-019 عیناً حفظ شدند. از Frontend اجرا شد:

```sh
OPENAPI_JSON_URL=/private/tmp/datano-be020/openapi.json pnpm api:generate
pnpm exec tsc --noEmit --incremental false
pnpm lint
pnpm test:transport
pnpm exec playwright test --config=/private/tmp/datano-be020/playwright.generated.config.ts
```

Orval 8.10 هر دو target functions/hooks را ساخت؛ TypeScript و lint موفق، transport
**۳۳ passed** و smoke موقت مصرف‌کنندگان تولیدشده **۸ passed، ۶۵۷ میلی‌ثانیه** بودند.
smoke هر دو POST با `{}`، cookie/CSRF، envelope، خطای 409 بدون retry خودکار، پاسخ خراب
و cancellation را آزمود. خروجی تولیدشده طبق سیاست پروژه ignored است؛ فایل tracked
Frontend و طراحی UI تغییر نکردند. نوع خالی Orval به‌تنهایی مانع property اضافی نیست؛
مصرف‌کننده باید صریحاً `{}` بفرستد و سرور همچنان extra را رد می‌کند.

## محیط، محدودیت و پاکسازی

آزمون‌ها از کانتینر اختصاصی `datano-be020-validation`، تصویر موجود
`postgres@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24`،
دیتابیس تازهٔ `datano_test_be020` روی tmpfs و پورت loopback استفاده کردند. runner و env
خصوصی در `/private/tmp/datano-be020` با دسترسی محدود نگهداری شدند؛ credential چاپ یا وارد
Git نشد. fixture موجود هر تست schema مستقل می‌سازد و پاک می‌کند؛ volume یا دیتابیس
قبلی برنامه استفاده نشد.

peer TLS محلی با گواهی موقت و routing تزریق‌شدهٔ صرفاً تستی استفاده شد. DNS کنترل‌شده
است؛ SSRF/TLS محصول غیرفعال نشده است. دریافت از سایت شخص ثالث، SMTP، Google، استقرار
production و egress واقعی آزموده نشدند. Frontend build/مرورگر UI اجرا نشد چون تغییر
نمایشی وجود ندارد؛ تست‌های transport/مصرف‌کننده بدون مرورگر اجرا شدند.

بررسی نهایی PostgreSQL **17.11**، SELECT 1 موفق و **صفر schema آزمایشی باقی‌مانده** را تأیید کرد. tmpfs، loopback و AutoRemove بررسی شدند؛ سپس فقط کانتینر همین تسک متوقف و با --rm حذف شد. فایل credential موقت نیز پس از آزمون حذف شد؛ تصویر و volumeهای قبلی دست‌نخورده ماندند.

اثبات HTML فقط وضعیت مالکیت سایت را تغییر می‌دهد؛ Admin، دسترسی property گوگل، اتصال
منبع یا آماده‌بودن گزارش ایجاد نمی‌کند. FE-035 و تسک‌های اتصال منابع شروع نشده‌اند.

## منابع فنی بررسی‌شده

- [Python HTMLParser](https://docs.python.org/3.12/library/html.parser.html): callbackهای ساختاری و محدودیت‌های parser استاندارد.
- [WHATWG meta](https://html.spec.whatwg.org/multipage/semantics.html#the-meta-element): عنصر metadata و محل head.
- [OWASP Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html): تصادفی‌بودن، scope و انقضای token؛ semantics چالش سایت از MVP خود Datano گرفته شده است.

## فایل‌ها، Backlog و Git

۲۳ مسیر، همگی در Backend و checkbox مستندات مشترک:

- [Backend/.env.example](</Users/azin/Documents/Datano/Backend/.env.example>)
- [Backend/README.md](</Users/azin/Documents/Datano/Backend/README.md>)
- [Backend/app/application/use_cases/website/proof.py](</Users/azin/Documents/Datano/Backend/app/application/use_cases/website/proof.py>)
- [Backend/app/domain/entities/website_entity.py](</Users/azin/Documents/Datano/Backend/app/domain/entities/website_entity.py>)
- [Backend/app/domain/error/exception_handlers.py](</Users/azin/Documents/Datano/Backend/app/domain/error/exception_handlers.py>)
- [Backend/app/domain/error/exceptions.py](</Users/azin/Documents/Datano/Backend/app/domain/error/exceptions.py>)
- [Backend/app/infra/core/config.py](</Users/azin/Documents/Datano/Backend/app/infra/core/config.py>)
- [Backend/app/infra/repositories/postgres/website_proof_repository.py](</Users/azin/Documents/Datano/Backend/app/infra/repositories/postgres/website_proof_repository.py>)
- [Backend/app/infra/repositories/postgres/website_repository.py](</Users/azin/Documents/Datano/Backend/app/infra/repositories/postgres/website_repository.py>)
- [Backend/app/infra/services/registration_limiter.py](</Users/azin/Documents/Datano/Backend/app/infra/services/registration_limiter.py>)
- [Backend/app/infra/services/website_challenge_tokens.py](</Users/azin/Documents/Datano/Backend/app/infra/services/website_challenge_tokens.py>)
- [Backend/app/infra/services/website_meta_parser.py](</Users/azin/Documents/Datano/Backend/app/infra/services/website_meta_parser.py>)
- [Backend/app/interface/controller/api.py](</Users/azin/Documents/Datano/Backend/app/interface/controller/api.py>)
- [Backend/app/interface/controller/website_proof_controller.py](</Users/azin/Documents/Datano/Backend/app/interface/controller/website_proof_controller.py>)
- [Backend/app/interface/dependencies/website_dependencies.py](</Users/azin/Documents/Datano/Backend/app/interface/dependencies/website_dependencies.py>)
- [Backend/app/interface/dto/website_dto.py](</Users/azin/Documents/Datano/Backend/app/interface/dto/website_dto.py>)
- [Backend/app/interface/website_proof_route.py](</Users/azin/Documents/Datano/Backend/app/interface/website_proof_route.py>)
- [Backend/docs/validation/BE-020-website-challenge.md](</Users/azin/Documents/Datano/Backend/docs/validation/BE-020-website-challenge.md>)
- [Backend/tests/integration/test_website_persistence.py](</Users/azin/Documents/Datano/Backend/tests/integration/test_website_persistence.py>)
- [Backend/tests/integration/test_website_proof.py](</Users/azin/Documents/Datano/Backend/tests/integration/test_website_proof.py>)
- [Backend/tests/integration/test_website_proof_http.py](</Users/azin/Documents/Datano/Backend/tests/integration/test_website_proof_http.py>)
- [Backend/tests/unit/test_website_challenge.py](</Users/azin/Documents/Datano/Backend/tests/unit/test_website_challenge.py>)
- [docs/backlog.md](</Users/azin/Documents/Datano/docs/backlog.md>)

فقط checkbox BE-020 در Backlog تکمیل شد؛ سایر وضعیت‌ها، معیارها و Epic تغییر نکردند. هیچ معیار پذیرش بررسی‌نشده باقی نمانده است.

همهٔ تغییرات unstaged هستند؛ staged diff خالی، Branch همان main و HEAD همان
`dc811b2` باقی مانده‌اند. هیچ Stage، Commit، Push، تغییر Branch یا انتشار انجام نشد.

پیام Commit پیشنهادی، بدون اجرا:

```text
feat(backend): implement BE-020 website ownership challenges
```
