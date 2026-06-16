import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#eef4ef_0%,#f8fafc_100%)] px-4 text-slate-950">
      <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <h1 className="text-2xl font-semibold">You are offline</h1>
        <p className="mt-3 text-sm text-slate-600">
          Tender Tracker can still open cached pages, but live dashboard data and PDF extraction need an internet connection.
        </p>
        <Link href="/" className="mt-6 inline-flex rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">
          Return to Dashboard
        </Link>
      </section>
    </main>
  );
}

