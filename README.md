# Betslip
Betslip - Update: 1.3.0 (Betslip Update 8)
Vercel + Upstash Redis. فایل‌ها: `api/` (سرور)، `public/` (سایت و PWA).
متغیرهای محیطی: `INVITE_CODE` (کد دعوت ثبت‌نام؛ حتماً قبل از اولین ثبت‌نام)، `FOOTBALL_DATA_KEY` و `APIFOOTBALL_KEY` (اختیاری)، `APIF_CACHE_SEC` (پیش‌فرض 600).
دیتابیس: Upstash Redis از Marketplace ورسل (متغیرهای KV_REST_API_* خودکار ساخته می‌شوند).

اعلان تلگرام: متغیر CRON_SECRET (و در صورت استفاده از مسیر /betslip، SITE_BASE=https://دامنه/betslip) در ورسل؛ در GitHub: Settings > Secrets > Actions: CRON_SECRET و SITE_URL (همان آدرس پایهٔ سایت).
