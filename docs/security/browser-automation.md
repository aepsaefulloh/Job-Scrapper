# Browser automation security

Browser profiles, downloads, cookies, and session files are local runtime data. They must not be committed, logged, or uploaded to Supabase. Scrapers must not perform login, CAPTCHA bypass, or credential handling. On blocked access, record only a safe error code and fail the run.
