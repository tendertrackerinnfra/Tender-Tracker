import webpush from "web-push";

export function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_TENDER_TRACKER_VAPID_PUBLIC_KEY;
  const privateKey = process.env.TENDER_TRACKER_VAPID_PRIVATE_KEY;
  const subject = process.env.TENDER_TRACKER_VAPID_SUBJECT ?? "mailto:tenders@example.com";

  if (!publicKey || !privateKey) {
    throw new Error(
      "Missing Tender Tracker VAPID keys. Set NEXT_PUBLIC_TENDER_TRACKER_VAPID_PUBLIC_KEY and TENDER_TRACKER_VAPID_PRIVATE_KEY."
    );
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  return webpush;
}
