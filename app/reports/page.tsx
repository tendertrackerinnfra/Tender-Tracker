import Link from "next/link";

export default function ReportsPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/" className="text-sm font-semibold text-emerald-700">Back to Dashboard</Link>
        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
          <h1 className="text-2xl font-semibold">Reports</h1>
          <p className="mt-2 text-sm text-slate-600">Reports will summarize tender values, authorities, status, and export-ready follow-up data.</p>
        </section>
      </div>
    </main>
  );
}

