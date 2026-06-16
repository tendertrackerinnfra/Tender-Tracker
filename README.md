# Tender Tracker PWA

Tender Tracker is a separate Next.js PWA for civil consultancy tender tracking. Do not reuse Supabase, Vercel, VAPID, or API keys from any other project.

GitHub repository:

```text
https://github.com/tendertrackerinnfra/Tender-Tracker
```

Supabase project:

```text
ufqctgcjztvrhmrljeos
https://ufqctgcjztvrhmrljeos.supabase.co
```

## Data Isolation

This app reads only Tender Tracker-specific environment variables:

```env
NEXT_PUBLIC_TENDER_TRACKER_SUPABASE_URL=https://ufqctgcjztvrhmrljeos.supabase.co
NEXT_PUBLIC_TENDER_TRACKER_SUPABASE_ANON_KEY=
TENDER_TRACKER_SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_TENDER_TRACKER_VAPID_PUBLIC_KEY=
TENDER_TRACKER_VAPID_PRIVATE_KEY=
TENDER_TRACKER_VAPID_SUBJECT=mailto:tenders@example.com
TENDER_TRACKER_API_KEY=
TENDER_TRACKER_DATA_DIR=D:\Adarsh\Tender Tracker
APP_URL=http://localhost:3000
```

The app intentionally ignores generic variables such as `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` so it does not connect to another project by accident.

If Supabase is not configured, tender data is stored locally in:

```text
D:\Adarsh\Tender Tracker
```

## Supabase

Use a new Supabase project for this app. Run:

```sql
supabase/migrations/008_tender_tracker.sql
```

Required tables:

- `tenders`
- `tender_notifications`
- `push_subscriptions`

## Vercel

Create a new Vercel project for this repository. Add only the Tender Tracker environment variables listed above.

## Development

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:3000`.

## Verification

```powershell
npm.cmd run typecheck
npm.cmd run build
```

## OCR

PDF text extraction works for PDFs with embedded text. For scanned PDFs, install Poppler and Tesseract on the server so the OCR fallback can run `pdftoppm` and `tesseract`.
