# BE-019 — دریافت امن HTML در برابر SSRF

تاریخ: ۲۰۲۶-۱۰-۲۲، منطقهٔ زمانی Asia/Tehran. وضعیت اولیهٔ Git پاک و HEAD برابر
`2eaf076` بود؛ BE-018 و FE-034 تکمیل بودند. راهنماهای مشترک/Backend، تصمیم‌های
مصوب hostname/HTML در MVP، Backlog، مدل و API سایت، معماری adapterها، تست‌ها و
گزارش‌های قبلی بررسی شدند. پلن اجرایی پیش از پیاده‌سازی شامل قرارداد مستقل، کنترل
DNS و اتصال به IP تأییدشده، redirect دستی، زمان/حجم محدود، TDD و suite کامل بود.

## نتیجه و معیارهای پذیرش

| معیار | پیاده‌سازی و شاهد |
|---|---|
| DNS کنترل شود | resolver سیستم با نام absolute و AF_UNSPEC، بدون AI_ADDRCONFIG محدودکننده، A/AAAA را می‌خواند. همهٔ خروجی‌ها پیش از اتصال بررسی می‌شوند؛ مجموعهٔ خالی/مختلط/خطادار رد است. در هر دریافت و هر hop دوباره DNS بررسی می‌شود. تست mixed و rebinding، و تست آرگومان‌های resolver وجود دارد. |
| IPهای غیرعمومی رد شوند | is_global تنها معیار نیست: loopback/private/link-local/CGNAT/multicast/reserved/documentation، IPv6 mapped/scoped/NAT64/6to4/Teredo و بازه‌های ویژهٔ محافظه‌کارانه رد می‌شوند؛ نشانی سکوی Azure نیز صریحاً مسدود است. تست‌ها نشان می‌دهند هیچ socket برای این جواب‌ها باز نمی‌شود. |
| فاصلهٔ DNS و اتصال امن باشد | URL شبکهٔ HTTPCore فقط IP عددی بررسی‌شده دارد؛ Host و SNI نام canonical اصلی را حفظ می‌کنند. آزمون wire مقصدِ درخواستی، Host، SNI و اعتبار واقعی گواهی را تأیید می‌کند. اتصالِ دوباره با hostname یا proxy محیطی وجود ندارد. |
| redirect همان hostname و حداکثر سه مرحله | 301/302/303/307/308 دستی هستند؛ cap ثابت سه و شمارنده مشترک با fallback است. www و subdomain مستقل می‌مانند. مقصد خارجی، credential، پورت سفارشی، scheme دیگر، URL ناقص، downgrade و حلقه رد می‌شوند. سه مرحله موفق و چهارمین مردود است؛ هر hop دوباره DNS می‌گیرد. |
| scheme کنترل شود | ورودی باید WebsiteAddress canonical HTTP(S) باشد. ابتدا HTTPS دریافت می‌شود؛ فقط سایت صریحاً HTTP پس از شکست network/TLS می‌تواند HTTP را امتحان کند. رد سیاست، DNS، timeout، status یا content مسیر fallback باز نمی‌کند. redirect از HTTPS به HTTP ممنوع است. |
| timeout کنترل شود | یک deadline کل ۱۰ثانیه‌ای شامل DNS، TCP، TLS، redirect، خواندن و fallback است. DNS، connect/TLS/write و read نیز حدود مستقل پیش‌فرض ۳ثانیه دارند؛ تنظیمات نامعتبر رد می‌شوند. توقف DNS/connect/read و wire واقعی TLS/read تست شده‌اند. cancellation بیرونی موفقیت یا خطای مجوز ساخته نمی‌شود. |
| اندازهٔ پاسخ کنترل شود | پیش‌فرض ۱ MiB؛ Content-Length پیش از body و تعداد واقعی بایت‌ها در streaming بررسی می‌شوند. chunked و بدون length هم محدودند. encoding فشرده رد می‌شود؛ decompress انجام نمی‌شود. وضعیت/نوع محتوای نامعتبر و header بزرگ رد می‌شوند؛ socket در خطا نیز بسته می‌شود. |
| مسیرهای مخرب تست شوند | ۱۵۱ تست واحد و ۱۱ تست wire، شامل metadata، IPv4/IPv6، rebinding، redirect مخرب، TLS نامعتبر، proxy/cookie، timeout، پاسخ بزرگ/فشرده/ناقص و پاکسازی اتصال موفق‌اند. |

فقط checkbox BE-019 تکمیل شد؛ سایر تسک‌ها، Epic و شرح معیارها تغییر نکردند.
هیچ معیار پذیرش این تسک بررسی‌نشده باقی نمانده است.

## معماری و تصمیم‌ها

- قرارداد `IWebsiteHTMLFetcher` و خروجی frozen به‌نام WebsiteHTML در لایه Application
  قرار دارند؛ خروجی bytes، URL نهایی و Content-Type است، نه proof یا is_verified.
  HTMLFetchError فقط reason ثابت دارد و جزئیات provider/DNS/HTML را نگه نمی‌دارد.
  body و URL در repr خروجی پنهان‌اند.
- SafeWebsiteHTMLFetcher زیر infra است؛ resolver و backend شبکه برای تست تزریق‌پذیرند.
  dependency جدید، تنظیمات برنامه را به HTMLFetchLimits تبدیل می‌کند. در این تسک
  endpoint عمومی fetch، challenge یا بررسی meta tag اضافه نشده است. BE-020 باید
  پیش از فراخوانی port، مالک جاری و آدرس ذخیره‌شده را کنترل کند؛ خود HTML مجوز نیست.
- ورودیِ سایت از parser مصوب BE-018 دوباره بررسی می‌شود؛ normalizer جدید موازی ساخته
  نشد. redirect می‌تواند path/query همان hostname را دنبال کند؛ فرم ثبت همچنان فقط
  root را می‌پذیرد. fragment از درخواست حذف و حلقه تشخیص داده می‌شود.
- نام DNS با نقطهٔ absolute خوانده می‌شود تا search suffix محلی اعمال نشود. اولین IP
  از مجموعهٔ کاملاً معتبر برای TCP انتخاب می‌شود؛ failover به IPهای دیگر و retry خودکار
  وجود ندارد. pool تازهٔ هر hop، keepalive و اتصال قدیمی DNS را دوباره استفاده نمی‌کند.
- تنها GET با headerهای ثابت فرستاده می‌شود. cookie، Authorization، Referer، session
  مرورگر و proxy محیطی وارد adapter نمی‌شوند. TLS دارای بررسی گواهی/hostname و حداقل
  نسخهٔ ۱٫۲ است؛ «غیرفعال‌سازی TLS verify» تنظیم محصول ندارد.
- بعضی مقاصد protocol/anycast که IANA یا Python ممکن است global اعلام کنند، در این
  adapter برای دریافت سایت به‌طور محافظه‌کارانه کنار گذاشته شده‌اند. این سیاست شامل
  `192.0.0.0/24`، `192.88.99.0/24`، `2001::/23`، `3ffe::/16`، `3fff::/20` و
  `168.63.129.16/32` است. تفاوت patchهای Python در طبقه‌بندی بعضی بازه‌ها نباید
  راه عبور IPv6 ویژه یا protocolهای انتقال را باز کند؛ مجازبودن عمومی برخی anycastها
  در IANA، الزام پذیرش آن‌ها برای دریافت HTML این محصول نیست.
- body فقط با 200 و Content-Type صریح text/html یا application/xhtml+xml بازگردانده
  می‌شود. Content-Encoding غیر identity حتی در پاسخ کوچک رد است؛ Accept-Encoding
  identity درخواست می‌شود. redirect body خوانده نمی‌شود و پاسخ جزئی در شکست برنمی‌گردد.
- Context managerهای response/pool اتصال را در success، reject، timeout و cancellation
  آزاد می‌کنند. محدودیت header ناقص HTTPCore/h11 برابر ۱۰۰ KiB و سقف Location برابر
  ۲۰۴۸ کاراکتر نیز برقرار است. هیچ JavaScript یا meta refresh اجرا نمی‌شود.

## تنظیمات و وابستگی

| متغیر server-only | پیش‌فرض | محدودهٔ معتبر |
|---|---|---|
| HTML_FETCH_TOTAL_SECONDS | 10 | بیشتر از صفر تا ۳۰ |
| HTML_FETCH_DNS_SECONDS | 3 | بیشتر از صفر تا ۱۰ |
| HTML_FETCH_CONNECT_SECONDS | 3 | بیشتر از صفر تا ۱۰؛ TCP/TLS/write |
| HTML_FETCH_READ_SECONDS | 3 | بیشتر از صفر تا ۱۰؛ هر read |
| HTML_FETCH_MAX_BYTES | 1048576 | ۱ تا ۵۲۴۲۸۸۰ بایت |

این اعداد انتخاب فنیِ محدودسازی دریافت‌اند؛ quota پلن محصول نیستند. سقف redirect
ثابت سه است و با تنظیمات بالاتر نمی‌رود. تنظیمات و نمونهٔ عمومی آن مستند شده‌اند؛
فایل خصوصی .env تغییر نکرده است.

`httpcore[asyncio]==1.0.9` از dependency توسعهٔ HTTPX موجود به dependency صریح runtime
ارتقا یافت. `pdm lock --update-reuse` فقط metadata گروه default برای httpcore/certifi
و extra asyncio را هماهنگ کرد. تمام نسخه‌های قبلی lockfile با HEAD مقایسه و عیناً
حفظ شدند؛ هیچ package جدید نصب و هیچ نسخه‌ای ارتقا داده نشد. راهنمای استقرار باید
همین manifest/lockfile جدید را نصب کند تا import runtime فقط به dev متکی نباشد.

## TDD و اعتبارسنجی

Python 3.12.14، PDM 2.29.2، Pytest 9.0.1 و HTTPCore 1.0.9 موجود استفاده شدند.
دستورات از Backend اجرا شدند:

```sh
pdm run pytest tests/unit/test_website_html_fetcher.py -q --tb=short
pdm run pytest tests/unit/test_website_html_fetcher.py tests/integration/test_website_html_wire.py \
  --cov=app.infra.services.website_html_fetcher --cov=app.application.use_cases.website.html \
  --cov-branch --cov-report=term-missing -q --tb=short --show-capture=no
pdm run pytest -q --tb=short --show-capture=no
pdm run python -m compileall -q app tests/unit/test_website_html_fetcher.py tests/integration/test_website_html_wire.py
pdm lock --check
git diff --check
```

- Red اولیه: تست دریافت صفحهٔ عمومی **۱ failed، ۰٫۵۰ ثانیه**؛ stub به‌جای دریافت
  HTML خطای network می‌داد. شکست import/dependency نبود. همان تست پس از پیاده‌سازی
  **۱ passed، ۰٫۴۷ ثانیه** شد.
- مجموعهٔ گسترش‌یافته **۱۳۴ passed، ۲ failed** داشت: نبود منع صریح بازهٔ ویژهٔ
  `2001:20::1` و پذیرش URL ناقص `https:///evil.test/` توسط urljoin. محدودیت prefix
  ویژه و بررسی authority پیش از join اضافه شدند؛ تست‌ها حفظ شدند. URL ناقص در نسخهٔ
  قبلی به مسیر همان host تبدیل می‌شد، نه اینکه دسترسی به hostname خارجی باز کند؛
  با این حال این syntax مبهم طبق سیاست محافظه‌کارانه اکنون رد می‌شود.
- پس از اصلاح، **۱۳۶ passed، ۱٫۴۰ ثانیه**؛ سپس با peer واقعی HTTP/TLS
  **۱۴۷ passed، ۲٫۴۷ ثانیه** به دست آمد.
- مجموعهٔ نهایی متمرکز: **۱۶۲ passed، ۳٫۴۸ ثانیه**؛ ۱۵۱ واحد و ۱۱ wire.
  پوشش scoped دو ماژول: **۹۸٪**، ۲۰۰ statement و ۵۴ branch؛ ۴ statement اجرا نشده‌اند:
  متد abstract port، دو guard دفاعی fallback/protocol، و اعتبارسنجی length نامعتبر
  که h11 پیش‌تر آن را رد می‌کند. برای پرکردن عدد coverage، assertion یا dependency
  امنیتی دور زده نشد. این عدد پوشش کل پروژه یا آستانهٔ جدید نیست.
- suite کامل: **۱۲۹۱ passed، ۱۴۷٫۹۱ ثانیه**، بدون failure/skip/warning؛
  ۱۱۲۹ تست قبلی و هر ۱۶۲ تست جدید موفق‌اند. registration، نشست، نقش، recovery،
  migration، persistence و API سایت قبلی نیز در همین اجرا بررسی شدند.
- compileall، بررسی lock و whitespace موفق‌اند. compileall جای linter/type-checker
  نیست؛ چنین ابزار کاملی در Backend پیکربندی نشده است.
- اجرای نخست lock به‌علت ممنوعیت نوشتن log در sandbox متوقف شد؛ با دسترسی لازم
  PDM اجرا و lock هماهنگ شد. dependency یا نسخهٔ نامرتبط تغییر نکرد.

OpenAPI واقعی با Config بدون فایل خصوصی صادر و با خروجی واقعی پیش از این تسک
مقایسه شد: JSON دقیقاً یکسان و دارای **۲۳ path** است. در نتیجه client فرانت‌اند
بازسازی نشد؛ endpoint/DTO قرارداد جدیدی ندارد. هیچ فایل Frontend، طراحی تأییدشده،
schema یا migration تغییر نکرد. تست مرورگر/build فرانت‌اند در این تسک لازم نبود
و اجرا نشد؛ CI یا آزمون deployment/egress واقعی ادعا نمی‌شود.

## محیط واقعی آزمون و پاکسازی

peerهای HTTP/TLS با asyncio روی loopback و گواهی موقت `.test` اجرا شدند. backend
شبکهٔ تست، IP عددی عمومیِ درخواست‌شده را به peer محلی هدایت می‌کند؛ این تنها fixture
آزمون است و هیچ flag مجازکردن IP خصوصی در کد محصول وجود ندارد. TLS واقعی، trust،
hostname/SNI، headerهای wire، بستن اتصال، timeout و خطاهای protocol بررسی شدند.
DNS با جواب‌های کنترل‌شده و getaddrinfo قابل مشاهده آزموده شد؛ ادعای استفاده از
DNS عمومی واقعی یا دریافت HTML از سایت شخص ثالث در تست‌ها وجود ندارد.

suite کامل از کانتینر اختصاصی `datano-be019-validation` با تصویر موجود زیر استفاده کرد:

```text
postgres@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24
```

فقط دیتابیس تازهٔ `datano_test_be019` روی tmpfs و پورت loopback در اختیار تست‌ها بود؛
fixture موجود برای هر تست schema مستقل ساخت و پاک کرد. هیچ volume موجود یا
دیتابیس برنامه mount/استفاده نشد. Config و runner خصوصی زیر
`/private/tmp/datano-be019` با پوشهٔ محدود و env دارای mode 0600 هستند؛ credential
چاپ یا وارد گزارش نشد. ارتباطی با SMTP واقعی، Google API یا هدف خارجی SSRF برقرار نشد.

بررسی نهایی PostgreSQL **17.11**، SELECT 1 موفق و **صفر schema آزمایشی باقیمانده**
را تأیید کرد. tmpfs، loopback و AutoRemove نیز بررسی شدند. سپس فقط کانتینر همین
تسک متوقف و با --rm حذف شد؛ تصویر موجود و volumeهای قبلی حفظ شدند.

## مرز تحویل و محدودیت‌های روشن

این تسک زیرساخت دریافت امن HTML را تحویل می‌دهد. کنترل owner در مسیرهای BE-018
پابرجاست؛ BE-020 باید owner/حالت سایت را قبل از دریافت و پیش از تغییر وضعیت نهایی
دوباره کنترل کند. challenge، digest، جست‌وجوی meta، تأیید سایت و endpoint تأیید
در این تسک اضافه نشده‌اند و خودکار شروع نمی‌شوند.

انتخاب اولین IP معتبر بدون alternate-IP retry و رد response فشرده/Content-Type
ناموجود انتخاب‌های محافظه‌کارانهٔ این adapter هستند؛ در این وضعیت‌ها موفقیت ساختگی
گزارش نمی‌شود. اعتبارسنجی TLS/شبکه یا DNS ناموفق به معنی تأیید مالکیت نیست.

deadline، await resolver سیستم را لغو و ادامهٔ اتصال را متوقف می‌کند؛ Python نمی‌تواند
فراخوانی resolver سیستم‌عامل را که در thread شروع شده به‌زور خاتمه دهد. محدودسازی
egress در محیط استقرار لایهٔ مکمل است و در این آزمون پیکربندی/ادعا نشده است.

## منابع فنی بررسی‌شده

انتخاب‌های امنیتی با مستندات اولیه و کد نسخهٔ نصب‌شده تطبیق داده شدند:

- [OWASP SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html): کنترل دامنه/IP، خانواده‌های آدرس و redirect/DNS pinning.
- [HTTPCore SNI extension](https://www.encode.io/httpcore/extensions/#sni_hostname): اتصال به IP با Host و گواهی hostname اصلی.
- [HTTPCore async streaming](https://www.encode.io/httpcore/async/): دریافت streaming و مدیریت lifespan پاسخ/pool.
- [Python ipaddress](https://docs.python.org/3.12/library/ipaddress.html): ویژگی‌های آدرس؛ همراه با بررسی کد Python نصب‌شده.
- [IANA IPv4](https://www.iana.org/assignments/iana-ipv4-special-registry/) و [IANA IPv6](https://www.iana.org/assignments/iana-ipv6-special-registry/): بازه‌های ویژه؛ سیاست منع adapter عمداً از global flag محافظه‌کارانه‌تر است.
- [Microsoft Azure platform IP](https://learn.microsoft.com/en-us/azure/virtual-network/what-is-ip-address-168-63-129-16): استثنای platform عمومی‌نما که در دریافت سایت مسدود می‌شود.

## فایل‌های تغییرکرده و Git

۱۲ مسیر: ۷ فایل tracked تغییرکرده و ۵ فایل جدید. همهٔ تغییرات unstaged هستند؛
staged diff خالی است. Branch همان main و HEAD همان 2eaf076 مانده‌اند. هیچ Stage،
Commit، Push، تغییر Branch یا انتشار انجام نشد. سایر فایل‌های Backend، تمام
Frontend، طراحی و داده‌های قبلی حفظ شدند.

- [Backend/.env.example](</Users/azin/Documents/Datano/Backend/.env.example>)
- [Backend/README.md](</Users/azin/Documents/Datano/Backend/README.md>)
- [Backend/app/application/use_cases/website/html.py](</Users/azin/Documents/Datano/Backend/app/application/use_cases/website/html.py>)
- [Backend/app/infra/core/config.py](</Users/azin/Documents/Datano/Backend/app/infra/core/config.py>)
- [Backend/app/infra/services/website_html_fetcher.py](</Users/azin/Documents/Datano/Backend/app/infra/services/website_html_fetcher.py>)
- [Backend/app/interface/dependencies/website_dependencies.py](</Users/azin/Documents/Datano/Backend/app/interface/dependencies/website_dependencies.py>)
- [Backend/docs/validation/BE-019-safe-html.md](</Users/azin/Documents/Datano/Backend/docs/validation/BE-019-safe-html.md>)
- [Backend/pdm.lock](</Users/azin/Documents/Datano/Backend/pdm.lock>)
- [Backend/pyproject.toml](</Users/azin/Documents/Datano/Backend/pyproject.toml>)
- [Backend/tests/integration/test_website_html_wire.py](</Users/azin/Documents/Datano/Backend/tests/integration/test_website_html_wire.py>)
- [Backend/tests/unit/test_website_html_fetcher.py](</Users/azin/Documents/Datano/Backend/tests/unit/test_website_html_fetcher.py>)
- [docs/backlog.md](</Users/azin/Documents/Datano/docs/backlog.md>)

پیام Commit پیشنهادی، بدون اجرای Commit:

```text
feat(backend): add BE-019 SSRF-safe HTML fetching
```
