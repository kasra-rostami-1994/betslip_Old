Betslip - Update: 2.0.0 (Betslip Update 14)

# Betslip
Vercel + Upstash Redis. ساختار:
- `public/` — اپ کاملاً بازنویسی‌شده: `index.html` (پوسته)، `app.css` (طراحی مینیمال، فونت Yekan)، `core.js` (منطق مشترک، کپی `api/_core.js`)، `parse.js`، `store.js` (همگام‌سازی)، `stats.js`، `ui.js`، `dlg.js`، `app.js` (مسیریابی و اکشن‌ها)، `fonts/Yekan.woff2`.
- `api/` — سرور: `_lib.js`، `_core.js` (باید دقیقاً با `public/core.js` یکی باشد)، `auth.js`، `data.js` (ذخیرهٔ تفاضلی هر بلیت)، `share.js`، `profile.js` (پروفایل/رتبه‌بندی)، `settings.js`، `_tg.js`، `telegram.js`، `notify.js`، `live.js`.

## متغیرهای محیطی (ورسل)
`INVITE_CODE` (کد دعوت ثبت‌نام، پیش از اولین ثبت‌نام بسازید)، `FOOTBALL_DATA_KEY`، `APIFOOTBALL_KEY` (اختیاری)، `APIF_CACHE_SEC` (پیش‌فرض 600)، `CRON_SECRET` (برای زمان‌بند اعلان)، `SITE_BASE` (اگر مسیر `/betslip` دارید)، `TIMEZONE` (پیش‌فرض Europe/Istanbul).
دیتابیس: Upstash Redis از Marketplace ورسل.

## اعلان تلگرام
در سایت، منوی پروفایل ← «اعلان و ربات تلگرام»: توکن و Chat ID را ذخیره کنید، «فعال‌سازی دستورات ربات» را بزنید، سپس در تلگرام `/start`.
زمان‌بند: cron-job.org هر 1 تا 2 دقیقه روی `https://دامنه/api/notify?key=CRON_SECRET` (یا هدر `Authorization: Bearer CRON_SECRET`)، یا GitHub Actions (`.github/workflows/notify.yml`, هر 5 دقیقه).
وضعیت زمان‌بند: دستور `/status` در ربات یا دکمهٔ «اجرای آزمایشی اعلان‌ها» در تنظیمات.

## امتیاز و پروفایل عمومی
هر بلیتِ برده: 10×ln(ضریب) امتیاز؛ هر بلیتِ باخته: ‑5٪. فرمول در `core.js`/`_core.js` (تابع `pts`) قابل تغییر است — هر دو فایل باید همزمان ویرایش شوند.
هر بلیت سه حالت نمایش دارد: خصوصی، فقط‌لینک، عمومی (در پروفایل). مبلغ، کش‌اوت، یادداشت و برچسب هرگز در حالت عمومی/لینک نشان داده نمی‌شوند.

## پشتیبان‌گیری
سرور هر روز یک پشتیبان خودکار می‌گیرد (۱۴ روز نگه‌داری؛ منوی پروفایل ← «پشتیبان‌های روزانه»). خروجی/ورودی JSON دستی هم هست. پیش از آپدیت‌های بزرگ، گرفتن خروجی JSON توصیه می‌شود.
