import { AppShell } from "@/components/app-shell";

export default function SettingsPage() {
  const cards = [
    { title: "Reminder preferences", text: "Browser notifications and lead times for last date and pre-bid reminders." },
    { title: "Company profile", text: "Workspace identity, company name, and team-facing tender metadata." },
    { title: "Data source controls", text: "Supabase-backed tender storage for this isolated Tender Tracker project." }
  ];

  return (
    <AppShell title="Settings" kicker="Workspace controls">
      <div className="grid gap-5 lg:grid-cols-3">
        {cards.map((card) => (
          <section key={card.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
            <h2 className="text-lg font-semibold text-slate-950">{card.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{card.text}</p>
          </section>
        ))}
      </div>
    </AppShell>
  );
}

