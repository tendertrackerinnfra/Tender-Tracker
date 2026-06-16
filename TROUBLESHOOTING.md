# Tender Tracker Troubleshooting

## App Is Using Local Storage

If Supabase is not configured, Tender Tracker stores data in `TENDER_TRACKER_DATA_DIR`, which defaults to:

```text
D:\Adarsh\Tender Tracker
```

## Supabase Is Not Connected

Check that the new Tender Tracker Supabase project has these variables:

```env
NEXT_PUBLIC_TENDER_TRACKER_SUPABASE_URL
NEXT_PUBLIC_TENDER_TRACKER_SUPABASE_ANON_KEY
TENDER_TRACKER_SUPABASE_SERVICE_ROLE_KEY
```

Generic Supabase variables are intentionally ignored.

## Push Reminders Do Not Work

Check:

```env
NEXT_PUBLIC_TENDER_TRACKER_VAPID_PUBLIC_KEY
TENDER_TRACKER_VAPID_PRIVATE_KEY
TENDER_TRACKER_VAPID_SUBJECT
```

Also make sure the browser has notification permission enabled.

## Scanned PDFs Do Not Extract Text

Install Poppler and Tesseract on the machine running the app. The OCR fallback expects `pdftoppm` and `tesseract` to be available on `PATH`.
