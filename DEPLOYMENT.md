# Tender Tracker Deployment

Use a new Git repository, a new Supabase project, and a new Vercel project for Tender Tracker.

GitHub repository:

```text
https://github.com/tendertrackerinnfra/Tender-Tracker
```

Supabase project:

```text
ufqctgcjztvrhmrljeos
https://ufqctgcjztvrhmrljeos.supabase.co
```

## Environment Variables

Set these in the new Vercel project only:

```env
NEXT_PUBLIC_TENDER_TRACKER_SUPABASE_URL=https://ufqctgcjztvrhmrljeos.supabase.co
NEXT_PUBLIC_TENDER_TRACKER_SUPABASE_ANON_KEY=
TENDER_TRACKER_SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_TENDER_TRACKER_VAPID_PUBLIC_KEY=
TENDER_TRACKER_VAPID_PRIVATE_KEY=
TENDER_TRACKER_VAPID_SUBJECT=mailto:tenders@example.com
TENDER_TRACKER_API_KEY=
TENDER_TRACKER_DATA_DIR=D:\Adarsh\Tender Tracker
APP_URL=
```

Do not add old project variables such as `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SCANNER_API_KEY`, or market scanner settings.

## Database

Apply the migration in `supabase/migrations/008_tender_tracker.sql` to the new Supabase project.

## Build

```powershell
npm.cmd run build
```
