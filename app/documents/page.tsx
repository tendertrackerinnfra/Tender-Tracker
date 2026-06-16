import { AppShell } from "@/components/app-shell";

export default function DocumentsPage() {
  return (
    <AppShell title="Documents" kicker="Tender reference files">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        <h2 className="text-lg font-semibold text-slate-950">Tender documents workspace</h2>
        <p className="mt-2 text-sm text-slate-600">
          This section is reserved for uploaded tender files, document requirements, and supporting submission references.
        </p>
      </section>
    </AppShell>
  );
}

