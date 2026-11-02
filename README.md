# Betslip
Betslip - Update: 1.6.0 (Betslip Update 12)
Vercel + Upstash Redis. فایل‌ها: `api/` (سرور)، `public/` (سایت و PWA).
متغیرهای محیطی: `INVITE_CODE` (کد دعوت ثبت‌نام؛ حتماً قبل از اولین ثبت‌نام)، `FOOTBALL_DATA_KEY` و `APIFOOTBALL_KEY` (اختیاری)، `APIF_CACHE_SEC` (پیش‌فرض 600).
دیتابیس: Upstash Redis از Marketplace ورسل (متغیرهای KV_REST_API_* خودکار ساخته می‌شوند).

اعلان تلگرام: متغیر CRON_SECRET (و در صورت استفاده از مسیر /betslip، SITE_BASE=https://دامنه/betslip) در ورسل؛ در GitHub: Settings > Secrets > Actions: CRON_SECRET و SITE_URL (همان آدرس پایهٔ سایت).

منطقهٔ زمانی خلاصه‌ها: متغیر TIMEZONE (پیش‌فرض Europe/Istanbul). برای دقت بیشتر زمان‌بند از cron-job.org (هر ۱ دقیقه، هدر Authorization: Bearer CRON_SECRET) استفاده کنید.

دستورات ربات: در ⚙ دکمهٔ «فعال‌سازی دستورات ربات» را بزنید؛ سپس در تلگرام /start و /bets /bet /live /risk /summary /stats.
