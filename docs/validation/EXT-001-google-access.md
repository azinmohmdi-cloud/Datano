# EXT-001 — بررسی امکان دسترسی و حساب‌های آزمایشی گوگل

تاریخ بررسی: **۲۰۲۶-۱۰-۲۳، Asia/Tehran**.
وضعیت: **بررسی مستندات و شبکه انجام شده؛ احراز حساب‌های واقعی انجام نشده و تسک باز است.**

کاربر در همین تسک اعلام کرد: «هنوز حساب‌ها و پروژهٔ آزمایشی آماده نیستند».
بنابراین هیچ پروژه، property، حساب Ads یا مجوز OAuth تأییدشده‌ای به این گزارش
منتسب نمی‌شود. موفقیت خواندن مستندات یا دریافت یک پاسخ HTTP، جای مجوز API نیست.

## محدوده، پیش‌نیاز و پلن اجرایی

مرجع تسک [Epic 08 در Backlog](../backlog.md)، قواعد اجرا
[راهنمای مشترک](../AGENTS.md)، و تصمیم‌های دامنه و امنیت
[MVP](../Datano_MVP.md) هستند. FE-028 در Backlog تکمیل است؛ کد محیط خصوصی review،
گزارش FE-017 و گزارش FE-035 بررسی شدند. این بررسی پذیرش UI را دوباره اجرا نمی‌کند.

پلن پیش از تغییر: بررسی شواهد موجود و پیش‌نیاز؛ انتخاب نسخه و حداقل scope از منابع
رسمی؛ بررسی OAuth، callback، الزامات Ads و محدودیت دسترسی؛ آزمون عمومی شبکه بدون
credential؛ ثبت حساب‌های موردنیاز، مانع و راه رفع؛ سپس کنترل محتوا، لینک و diff.

این خروجی فقط مستندات است. endpoint، schema، dependency، migration، تنظیمات خصوصی،
معماری و طراحی Frontend تغییر نمی‌کنند. BE-021 تا BE-024 و تسک‌های اتصال UI اجرا
نشده‌اند. هیچ حساب ابری، credential، مجوز یا هزینه‌ای ایجاد نشده است.

## شواهد فعلی پروژه و حساب‌ها

| موضوع | مشاهدهٔ واقعی | نتیجه |
|---|---|---|
| FE-028 | checkbox تکمیل؛ UI منابع و fixture خصوصی از محصول جدا هستند | پیش‌نیاز ثبت‌شده برقرار است |
| کد اتصال | Config و routerهای Backend و data layer فرانت‌اند هنوز OAuth گوگل ندارند | callback اجرایی و smoke محصول موجود نیست |
| تنظیمات | فقط نام کلیدها در فایل‌های `.env*` ریشه، Backend و Frontend و environment پردازش بررسی شد؛ کلید مرتبط Google/OAuth/GA4/GSC/Ads یافت نشد | credential قابل‌استفاده احراز نشده؛ مقدار خصوصی چاپ یا در گزارش ذخیره نشد |
| مرورگر | inventory ابزار مرورگر تب کنسول مرتبطی ارائه نکرد | ادعای بررسی همهٔ پروفایل‌های مرورگر یا نبود حساب Google وجود ندارد |
| پاسخ کاربر | پروژه و حساب‌های آزمایشی آماده نیستند | discovery و درخواست مجاز هر سه منبع اجرا نشده است |

نبود کلید در این مسیرهای محدود به معنی جست‌وجوی همهٔ secret storeها نیست. فایل‌های
خصوصی، browser cookie و token استخراج نشده‌اند. برای ادامه، صاحب پروژه باید محیط
آزمایشی مشخص و دسترسی مصوب را فراهم کند؛ secret در چت یا Git قرار نگیرد.

## نسخه‌ها و scopeهای انتخابی

این انتخاب‌ها مبنای اتصال آینده‌اند؛ نسخهٔ SDK نصب یا pin نشده و قرارداد FastAPI
جدیدی تعریف نمی‌کنند. هنگام اجرای adapter، پشتیبانی نسخه و metadata حساب دوباره
کنترل می‌شود. لینک‌های قدیمی v22/v23 در اسناد تاریخی، نسخهٔ منتخب Ads نیستند.

| منبع | نسخهٔ منتخب API | حداقل scope برای نیاز Datano | شاهد رسمی |
|---|---|---|---|
| Search Console | سرویس Discovery با نام `searchconsole`، نسخهٔ `v1`؛ مسیرهای Sites و Search Analytics همچنان `/webmasters/v3/` هستند | `https://www.googleapis.com/auth/webmasters.readonly` | [Discovery رسمی](https://www.googleapis.com/discovery/v1/apis/searchconsole/v1/rest)، [Sites: list](https://developers.google.com/webmaster-tools/v1/sites/list)، [Search Analytics: query](https://developers.google.com/webmaster-tools/v1/searchanalytics/query) |
| GA4 | Admin API `v1beta` برای کشف property/stream؛ Data API `v1beta` برای گزارش | `https://www.googleapis.com/auth/analytics.readonly` برای هر دو API | [accountSummaries.list](https://developers.google.com/analytics/devguides/config/admin/v1/rest/v1beta/accountSummaries/list)، [dataStreams.list](https://developers.google.com/analytics/devguides/config/admin/v1/rest/v1beta/properties.dataStreams/list)، [runReport](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runReport) |
| Google Ads | `v26`، انتشار ۲۰۲۶-۱۰-۱۴ | `https://www.googleapis.com/auth/adwords` | [Release notes](https://developers.google.com/google-ads/api/docs/release-notes)، [OAuth internals](https://developers.google.com/google-ads/api/docs/oauth/internals) |

برای Ads، scope فرضی `adwords.readonly` تعریف نمی‌شود. scope رسمی، دسترسی گسترده‌تری
از گزارش‌گیری دارد؛ انتخاب فنی Datano استفاده از نقش Read-only در حساب آزمایشی و
فقط عملیات خواندنی adapter است. مدل نقش و وراثت مجوز در
[Ads access model](https://developers.google.com/google-ads/api/docs/oauth/access-model)
آمده است. اثبات اعمال این محدودیت روی حساب واقعی هنوز انجام نشده است.

هر منبع هنگام انتخاب همان منبع scope می‌خواهد؛ درخواست هر سه scope شرط استفاده
نیست. scopeهای `analytics.edit`، `webmasters`، Gmail، Drive، `openid` و profile/email
برای این نیاز انتخاب نشده‌اند. Google OAuth اتصال منبع است، نه ورود به Datano.
پذیرش جزئی scopeها باید وضعیت مستقل منابع را حفظ کند.
[راهنمای incremental authorization](https://developers.google.com/identity/protocols/oauth2/resources/best-practices)
درخواست حداقل دسترسی در زمان نیاز را توصیه می‌کند.

## OAuth و callback: تصمیم‌ها و موارد احرازنشده

مبنای انتخاب، **Authorization Code برای Web application محرمانه در Backend** است.
درخواست به `https://accounts.google.com/o/oauth2/v2/auth` و exchange سمت سرور در
`https://oauth2.googleapis.com/token` انجام می‌شود. برای sync بدون حضور کاربر،
`access_type=offline` لازم است؛ وجود refresh token در هر پاسخ فرض نمی‌شود.
redirect URI باید عیناً با مقدار ثبت‌شدهٔ client تطابق داشته باشد. HTTPS الزام
عمومی و localhost استثنای توسعه است؛ HTTP برای دامنهٔ عمومی انتخاب نمی‌شود.
[Google Web Server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server)

برای محیط آزمایشی خارج از Workspace محدود، انتخاب اولیه External / Testing با
test user صریح است. Testing حداکثر ۱۰۰ test user دارد و با scopeهای انتخابی این
پروژه، مجوز و refresh token آزمایشی پس از هفت روز منقضی می‌شوند؛ این وضعیت برای
sync پایدار production کافی نیست. Internal تنها برای سازمان Cloud مربوط مناسب
است و راه عمومی اتصال حساب مشتریان نیست.
[Manage App Audience](https://support.google.com/cloud/answer/15549945?hl=en)

الزامات اجرای BE-022 بر اساس تصمیم امنیتی موجود پروژه:

- آغاز اتصال فقط از نشست معتبر و سایت متعلق به همان کاربر و تأییدشده انجام شود؛
  عملیات تغییردهنده از دفاع Origin/CSRF فعلی استفاده کند.
- state تصادفی، محدودعمر، یک‌بارمصرف و وابسته به نشست، سایت و منبع باشد؛ callback
  بدون state معتبر، تکراری، مربوط به حساب دیگر یا پس از بی‌اعتبارشدن نشست رد شود.
- callback در Backend پردازش شود؛ code در URL بازگشت Google ممکن است وجود داشته
  باشد، ولی access/refresh token به Frontend، URL مقصد، storage، trace یا log نرود.
  query حاوی code/state باید از لاگ‌های وب‌سرور و proxy استقرار نیز حذف/پوشانده شود.
- رد رضایت کاربر یا نبود scope، اتصال موفق نسازد؛ redirect نهایی فقط به مقصد داخلی
  مجاز برود و credential قبلی با پاسخ فاقد refresh token بی‌دلیل پاک نشود.
- رمزنگاری credential با کلید جدا متعلق به BE-021 است؛ EXT-001 مخزن token موقت
  یا یک جریان OAuth موازی برای دورزدن آن نمی‌سازد.

| مورد لازم برای ثبت/آزمون callback | وضعیت |
|---|---|
| Google Cloud project و صاحب مسئول آن | آماده نیست؛ پاسخ کاربر |
| OAuth client از نوع Web application و محل خصوصی secret | آماده نیست |
| test user و scopeهای فعال در consent screen | احراز نشده |
| origin عمومی HTTPS و دامنهٔ تحت کنترل | ارائه نشده |
| مسیر واقعی callback در Backend | پیاده‌سازی آن متعلق به BE-022 است |
| URI دقیق ثبت‌شده و آزمون round-trip | انجام نشده |

در این مرحله URI فرضی به‌عنوان endpoint موجود معرفی یا در کنسول ثبت نمی‌شود.
صاحب پروژه پیش از ثبت client باید origin محیط را مشخص کند؛ مسیر callback با route
واقعی BE-022 نهایی می‌شود. در توسعه، hostname مرورگر/API باید مطابق cookieهای فعلی
هماهنگ بماند؛ localhost و 127.0.0.1 جای یکدیگر فرض نمی‌شوند. این وابستگی به اجرای
آیندهٔ callback، مانع بررسی نیازهای آن در EXT-001 نیست و مجوز شروع BE-022 نمی‌دهد.

برای انتشار عمومی، وضعیت verification، دامنهٔ تأییدشده، صفحهٔ عمومی محصول و privacy
policy متناسب با استفادهٔ واقعی داده باید بررسی شوند. متن حقوقی حدسی تولید نشد؛
انتشار consent screen انجام نشد. راهنمای
[Sensitive scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)
الزامات صفحه و privacy policy را مشخص می‌کند. صرف انتخاب In production، اثبات
تأیید برند/scope یا آمادگی انتشار محصول نیست.

## الزامات ویژهٔ Ads در تاریخ این بررسی

طبق متن فعلی راهنمای رسمی، **developer token در ۲۰۲۶-۰۹-۰۹ sunset شده است**؛ سطح
دسترسی با Cloud project صاحب OAuth client تعیین می‌شود. گرفتن developer token
برای شروع جدید Datano پیش‌نیاز نیست. این تصمیم با جدول deprecation رسمی نیز تطبیق
داده شد؛ خلاصه‌های قدیمی صفحات دربارهٔ الزامی‌بودن developer token مبنا قرار نگرفتند.
[راهنمای انتقال دسترسی](https://developers.google.com/google-ads/api/docs/api-policy/developer-token)،
[Deprecations](https://developers.google.com/google-ads/api/docs/deprecations)

فعال‌کردن Ads API، سطح Test برای حساب‌های تست فراهم می‌کند؛ دسترسی production
نیازمند سطح مجاز مانند Explorer یا Basic و بررسی وضعیت واقعی همان project است.
سطح Test معادل دسترسی حساب واقعی نیست. برای گزارش‌گیری Datano، permissible use
باید خواندن گزارش را مجاز کند؛ سطح/سهمیه به‌طور خودکار Standard فرض نمی‌شود.
[Access levels and permissible use](https://developers.google.com/google-ads/api/docs/api-policy/access-levels)

برای sandbox مجزا، test manager و test client در سلسله‌مراتب جدا از production
لازم‌اند. حساب تست تبلیغ نمایش نمی‌دهد؛ impressions، conversions و cost حاصل از
نمایش واقعی ندارد. بنابراین پاسخ معتبر خالی می‌تواند smoke اتصال را پوشش دهد، اما
شاهد نمودار یا KPI واقعی نیست. گزارش دارای داده بعداً به حساب production مجاز با
سابقهٔ واقعی مربوط به سایت نیاز دارد؛ این تسک کمپین یا هزینه‌ای ایجاد نمی‌کند.
[Test accounts](https://developers.google.com/google-ads/api/docs/best-practices/test-accounts)

در دسترسی از مسیر manager، `login-customer-id` با شناسهٔ manager و بدون خط تیره
لازم است. این header برای `ListAccessibleCustomers` لازم نیست؛ فهرست آن هم فقط
حساب‌های مستقیماً قابل‌دسترسی را نشان می‌دهد و کشف همهٔ زیرحساب‌ها نیست.
[API call structure](https://developers.google.com/google-ads/api/docs/concepts/call-structure)
دسترسی customer به‌تنهایی ارتباط آن با hostname تأییدشدهٔ Datano را ثابت نمی‌کند؛
بررسی ارتباط سایت و انتخاب نهایی account در BE-031 باقی می‌ماند.

## حساب‌های لازم و چک‌لیست ادامهٔ احراز

شناسه‌ها، ایمیل‌ها و سند مجوز واقعی هنوز ارائه نشده‌اند. جدول زیر نیاز آماده‌سازی
است و شاهد provision شدن منابع نیست. اعطای مجوز یا پذیرش شرایط حساب باید توسط
صاحب مجاز انجام شود؛ برای تکمیل این گزارش دسترسی جدیدی اعطا نشده است.

| منبع/زیرساخت | آنچه صاحب پروژه باید آماده کند | شاهد موردنیاز برای احراز |
|---|---|---|
| Cloud/OAuth | project آزمایشی مشخص؛ فعال‌سازی Search Console API، Analytics Admin API، Analytics Data API و Google Ads API؛ Web client، test user و scopeهای بالا | مشاهدهٔ تنظیمات همان project و محل امن credential؛ بدون کپی secret در گزارش |
| سایت | یک hostname عمومی تحت کنترل، با امکان تأیید HTML در Datano | کنترل سایت و شناسهٔ همان سایت؛ www و subdomain مستقل |
| GSC | property همان سایت و کاربر دارای اجازهٔ خواندن عملکرد؛ ثبت دقیق URL-prefix یا `sc-domain:` و permissionLevel | `sites.list` و یک `searchanalytics.query` مجاز روی همان property |
| GA4 | property اختصاصی آزمایش با دسترسی خواندن، ترجیحاً Viewer؛ web stream متعلق به سایت، timezone و ID عددی property | کشف Admin و stream، سپس `runReport` مجاز روی همان property |
| Ads sandbox | test manager/client جدا، دسترسی خواندن و Cloud project با سطح Test | کشف حساب مجاز و یک query خواندنی به همان test customer |
| Ads دارای داده | در مرحلهٔ گزارش واقعی: customer production مرتبط با سایت و project دارای دسترسی production | query خواندنی مجاز، timezone/currency و شواهد ارتباط سایت؛ بدون راه‌اندازی تبلیغ جدید |

حساب Demo عمومی GA4 راه جایگزین نیست: Google صریحاً استفادهٔ آن با Data API را
غیرمجاز می‌داند و درخواست با خطای permission مواجه می‌شود.
[Analytics Demo account](https://support.google.com/analytics/answer/6367342?hl=en)
مرجع نقش Viewer و محدودیت داده در
[Analytics access management](https://support.google.com/analytics/answer/9305587?hl=en)
است. حتی موفقیت کشف metadata، بدون درخواست گزارش، احراز کامل دسترسی Data API نیست.

ترتیب smoke پس از آماده‌شدن حساب‌ها، با درخواست‌های کوچک و فقط خواندنی:

1. کنترل project، consent، test user و سطح Ads؛ ثبت URI دقیق و محیط اجرا در محل
   خصوصی. در صورت نبود جریان اجرایی callback، نیازهای آن جدا ثبت شود؛ موفقیت آن
   قبل از BE-022 ادعا نشود.
2. GSC: `sites.list`، تطبیق property با سایت و query بازهٔ کوتاه کامل با
   `dimensions=["date"]`. نتیجهٔ خالی از خطای permission و quota تفکیک شود؛ روز
   حذف‌شده صفر فرض نشود و فهرست top rows شاهد سری کامل نباشد.
3. GA4: `accountSummaries.list` و `properties.dataStreams.list`، تطبیق سایت، سپس
   `properties.runReport` با شاخص‌های مصوب. query کل بازه و query روزانه جدا بمانند؛
   مجموع کاربران روزانه جای کاربران یکتای بازه نشود.
4. Ads: `ListAccessibleCustomers` و در صورت نیاز خواندن سلسله‌مراتب manager؛ query
   metadata حساب و یک گزارش خواندنی کوچک در v26. test بودن و خالی‌بودن طبیعی گزارش
   ثبت شود؛ هیچ mutate، تغییر campaign یا billing برای smoke لازم نیست.
5. برای هر درخواست: زمان، محیط، نسخه، scope اعطاشده، شناسهٔ مرجع خصوصی منبع، status
   و نتیجهٔ خالی/دارای داده/خطا ثبت شوند. body دادهٔ مشتری، code، token و secret
   وارد artifact عمومی نشوند. پاسخ معتبر بدون داده، موفقیت permission را ثابت
   می‌کند؛ دادهٔ کافی برای گزارش/قاعده ادعای دیگری است.

این مراحل **اجرا نشده‌اند**. پیاده‌سازی provider adapter، ingestion و readiness
محصول همچنان در BE-025 به بعد است؛ این چک‌لیست مجوز اجرای آن تسک‌ها نیست.

## بررسی مستقیم شبکه و محدودیت تفسیر

آزمون‌ها GET عمومی بدون cookie، Authorization، API key یا client secret بودند؛
proxy صریحاً با `--noproxy '*'` کنار گذاشته شد، TLS verify غیرفعال نشد، redirect
دنبال نشد و body پاسخ دور ریخته شد. خروجی فقط status و در batch نوع محتوا بود.
گزینه‌های فرمان اجراشده برای هر URL، در batch با `--next` تکرار شدند:

```sh
curl --noproxy '*' --proto '=https' --tlsv1.2 \
  --connect-timeout 5 --max-time 12 --silent --show-error \
  --output /dev/null --write-out 'Google discovery: HTTP %{http_code}\n' \
  'https://www.googleapis.com/discovery/v1/apis/searchconsole/v1/rest'
```

اولین اجرای sandbox با exit 6 و `Could not resolve host` متوقف شد. همان فرمان با
اجازهٔ دسترسی بیرون sandbox دوباره اجرا شد و HTTP 403 گرفت؛ محدودیت DNS sandbox
به‌عنوان شکست قطعی شبکهٔ دستگاه گزارش نمی‌شود. درخواست‌های بعدی نیز با دسترسی لازم
و همان گزینه‌های مستقیم انجام شدند:

| URL عمومی | نتیجهٔ خارج sandbox |
|---|---|
| `https://www.googleapis.com/discovery/v1/apis/searchconsole/v1/rest` | HTTP 403؛ exit 0 curl، نوع محتوا در این فرمان ثبت نشد |
| `https://www.googleapis.com/discovery/v1/apis/analyticsdata/v1beta/rest` | HTTP 403؛ `text/html; charset=UTF-8` |
| `https://www.googleapis.com/discovery/v1/apis/analyticsadmin/v1beta/rest` | HTTP 403؛ `text/html; charset=UTF-8` |
| `https://analyticsdata.googleapis.com/$discovery/rest?version=v1beta` | HTTP 200؛ `application/json; charset=UTF-8` |
| `https://analyticsadmin.googleapis.com/$discovery/rest?version=v1beta` | HTTP 200؛ `application/json; charset=UTF-8` |
| `https://searchconsole.googleapis.com/$discovery/rest?version=v1` | HTTP 200؛ `application/json; charset=UTF-8` |
| `https://googleads.googleapis.com/v26/customers:listAccessibleCustomers` | HTTP 403؛ `text/html; charset=UTF-8`؛ درخواست بدون احراز هویت |
| `https://accounts.google.com/.well-known/openid-configuration` | HTTP 200؛ `application/json`؛ فقط شاهد دسترسی endpoint عمومی |
| `https://oauth2.googleapis.com/token` | HTTP 404؛ `text/html`؛ GET عمومی، نه POST تبادل token |

exit 0 در curl بدون `--fail` فقط دریافت پاسخ را نشان می‌دهد؛ 403 پاس آزمون دسترسی
API نیست. 404 برای GET endpoint تبادل نیز نه موفقیت exchange است نه اثبات خرابی
آن. وجود پاسخ HTTPS، دسترسی TCP/TLS به آن مقصد را نشان می‌دهد؛ علت دقیق 403 از
این شواهد تعیین نمی‌شود. بررسی تکمیلی روی hostname خود سرویس‌های GA4 و GSC موفق
بود؛ 403 میزبان مشترک Discovery به معنی انسداد کلی آن سرویس‌ها نیست. 200 سند عمومی
Discovery نیز مجوز خواندن گزارش خصوصی را ثابت نمی‌کند. کشور حساب، فعال‌بودن API، scope و دسترسی property از این
probeها قابل استنتاج نیستند. خواندن اسناد از ابزار web هم مسیر شبکهٔ جدا دارد و
شاهد egress محیط اجرای Backend نیست. محیط استقرار هنوز معرفی/آزموده نشده است.

Google Ads طبق سیاست رسمی در ایران و بعضی مناطق دیگر در دسترس تبلیغ‌دهندگان نیست
و حضور فیزیکی در مناطق مشمول نیز ورود را محدود می‌کند.
[Google Ads country restrictions](https://support.google.com/google-ads/answer/6163740?hl=en)
این سیاست ثبت می‌شود؛ timezone کاربر مدرک محل واقعی یا کشور حساب نیست و علت 403
مشاهده‌شده به آن نسبت داده نمی‌شود. صلاحیت واقعی صاحب حساب/کسب‌وکار باید با شرایط
سرویس بررسی شود؛ proxy، حساب با هویت نادرست یا تغییر ظاهری محل، راه رفع تأییدشده نیست.

## موانع، مسئول پیگیری و راه رفع

| مانع/ریسک | وضعیت | راه رفع و شاهد خروج |
|---|---|---|
| پروژه، OAuth client و حساب‌های آزمایشی آماده نیستند | مانع قطعی؛ اعلام کاربر | صاحب پروژه محیط و منابع مجاز جدول بالا را آماده کند؛ discovery و خواندن واقعی ثبت شوند |
| 403 در میزبان مشترک Discovery و درخواست بدون احراز Ads | مشاهده‌شده؛ علت نامشخص؛ Discovery خود GA4/GSC برابر 200 | بررسی egress و سیاست سرویس در محیط مجاز هدف؛ آزمون درخواست احرازشده پس از آماده‌سازی؛ از این پاسخ‌ها انسداد کلی Google API نتیجه گرفته نشود |
| origin و URI ثبت‌شدهٔ callback مشخص نیستند | ورودی آماده‌سازی موجود نیست | تعیین origin توسط صاحب پروژه؛ نهایی‌کردن مسیر واقعی در BE-022 و ثبت تطابق دقیق در client؛ callback موجود جعل نشود |
| انقضای هفت‌روزهٔ Testing | محدودیت مستند سرویس؛ هنوز روی حساب تست نشده | برای تست کوتاه، برنامهٔ consent مجدد؛ برای انتشار، بررسی verification/production واقعی؛ بی‌نهایت‌بودن refresh فرض نشود |
| Ads Test دادهٔ serving ندارد | محدودیت مستند محیط تست | تست اتصال با نتیجهٔ معتبر خالی؛ آزمون نمودار واقعی با حساب production مجاز دارای سابقه، در تسک مربوط |
| GA4 Demo، جای property شخصی نیست | محدودیت مستند | property آزمایشی تحت کنترل با اجازهٔ Data API آماده شود |
| محدودیت کشور/سازمان/Workspace یا سطح Ads | مشروط؛ وضعیت حساب واقعی نامعلوم | بررسی توسط صاحب مجاز و در صورت لزوم پشتیبانی رسمی Google؛ نبود صلاحیت، مانع محصول ثبت شود |
| quota و محدودیت query | مستند؛ سهمیهٔ project واقعی نامعلوم | مشاهدهٔ quota همان project؛ درخواست کوچک و کنترل نرخ/retry در adapterهای بعدی؛ خطا به دادهٔ صفر تبدیل نشود |

مراجع quota:
[GA4 Data API](https://developers.google.com/analytics/devguides/reporting/data/v1/quotas)،
[Search Console](https://developers.google.com/webmaster-tools/limits?hl=en)، و
[Ads access levels](https://developers.google.com/google-ads/api/docs/api-policy/access-levels).
proxy پیش‌فرض انتخاب یا فعال نشد. بررسی/رفع محدودیت با دسترسی و شرایط مجاز لازم است؛
موفقیت اتصال با proxy هم به‌تنهایی مجوز حساب یا property را اثبات نمی‌کند.

## ماتریس پذیرش و نتیجه

| معیار EXT-001 | نتیجه در این اجرا |
|---|---|
| پیش‌نیاز FE-028 | تکمیل ثبت‌شده و منابع مرتبط بررسی شدند؛ آزمون UI جدید اجرا نشد |
| حساب/property مجاز هر سه منبع | **احراز نشده**؛ کاربر آماده‌نبودن را اعلام کرد |
| نیازهای OAuth، Ads و callback | بررسی و تصمیم‌های بالا ثبت شدند؛ تنظیم client و round-trip واقعی احراز نشده‌اند |
| نسخه و scope از مستندات رسمی | انتخاب و لینک‌های مستقیم ثبت شدند |
| محدودیت دسترسی، مانع و راه رفع | probe واقعی شبکه، محدودیت‌های رسمی و مسئول پیگیری ثبت شدند |
| proxy پیش‌فرض نباشد | رعایت شد؛ probe مستقیم و بدون proxy بود |

بنابراین checkbox **EXT-001 در Backlog همچنان `[ ]` است** و BE-022 از نظر وابستگی
این تسک آماده اعلام نمی‌شود. BE-021 وابستگی مستقل خود را دارد، اما خودکار شروع نشده
است. پس از آماده‌شدن حساب‌ها باید همین پرونده با شواهد واقعی تکمیل شود؛ تغییر معیار
پذیرش یا استفاده از fake برای بستن تسک مجاز نیست.

## اعتبارسنجی مستندات و Git

تنها فایل جدید این گزارش است. لینک‌های رسمی با ابزار web خوانده شدند؛ بدنهٔ اصلی
Ads و جدول deprecation بر خلاصهٔ قدیمی صفحه اولویت داده شدند. فرمان‌های کنترل محلی:

```sh
git diff --check
git diff --no-index --check /dev/null docs/validation/EXT-001-google-access.md
git status --short --branch
git diff --stat
git diff --cached --stat
```

کنترل مستقل UTF-8، newline، whitespace، بسته‌بودن code fenceها، مسیر ۳ لینک نسبی،
ساختار جدول‌ها، ۲۳ مرجع رسمی یکتا و یکتایی شناسه‌ها/وجود و تقدم وابستگی‌های Backlog
موفق بود. نبود تغییر tracked و staged نیز با `git diff --quiet` و
`git diff --cached --quiet` تأیید شد؛ HEAD همان `0ade96e` و branch همان `main` است.
فایل untracked مستقیم بررسی شد، چون `git diff --check` به‌تنهایی آن را پوشش نمی‌دهد.
فرمان `git diff --no-index --check /dev/null ...` به‌علت جدیدبودن فایل exit 1 و
خروجی خالی دارد؛ این نتیجه به‌عنوان تفاوت فایل با `/dev/null` تفسیر شد، نه خطای
whitespace. کنترل اولیه که exit صفر را برای آن انتظار داشت اصلاح و دوباره اجرا شد.
تست application، TDD رفتاری، build، Orval، migration، آزمون
PostgreSQL و OAuth واقعی اجرا نشدند: کد/قرارداد تغییر نکرده و حساب‌ها آماده نیستند.
پاسخ‌های 403 موفق اعلام نشده‌اند. هیچ Stage، Commit، Push، تغییر Branch یا انتشار
انجام نشد. پیام پیشنهادی، بدون اجرا:

```text
EXT-001 docs: record Google access requirements and verification blockers
```
