import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEvent, getSettings } from "@/lib/store";
import { describeSplit, eventMath, payersLabel } from "@/lib/event-math";
import { formatMoney } from "@/lib/money";
import { formatDate, formatRange } from "@/lib/format";
import { SERIES, SPLIT_MODE_LABELS, categoryColor, findCategory } from "@/lib/constants";
import { LogoMark } from "@/components/logo";
import { PrintButton } from "./print-button";

export async function generateMetadata(props: PageProps<"/events/[id]/print">): Promise<Metadata> {
  const { id } = await props.params;
  return { title: `${getEvent(id)?.name ?? "Event"} · Print` };
}

/** Print-friendly report (light brand on white). The real PDF export is client-side; this is the fallback. */
export default async function PrintPage(props: PageProps<"/events/[id]/print">) {
  const { id } = await props.params;
  const event = getEvent(id);
  if (!event) notFound();
  const settings = getSettings();
  const math = eventMath(event);
  const m = (v: number, sign = false) => formatMoney(v, event.currency, settings.locale, { sign });
  const name = (pid: string) => math.people.get(pid)?.name ?? "?";
  const expenses = [...event.expenses].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);

  return (
    <div className="light min-h-dvh bg-white text-[#17171a]">
      <div className="no-print sticky top-0 z-10 flex items-center justify-between border-b border-[#eee] bg-white/90 px-6 py-3 backdrop-blur">
        <p className="text-sm text-[#6b6b74]">Print view · use your browser&apos;s “Save as PDF” to keep a copy</p>
        <PrintButton />
      </div>

      <article className="mx-auto max-w-[800px] px-8 py-10 text-[13px] leading-relaxed print:px-0 print:py-0">
        <header className="flex items-start justify-between border-b-2 border-[#FFB38A] pb-5">
          <div className="flex items-center gap-3">
            <LogoMark className="size-10" />
            <div>
              <p className="text-xs font-semibold tracking-[0.14em]">
                MUNE <span className="text-[#f28a4b]">SPLITS</span>
              </p>
              <h1 className="text-2xl font-semibold tracking-tight">
                {event.emoji} {event.name}
              </h1>
            </div>
          </div>
          <div className="text-right text-xs text-[#6b6b74]">
            {formatRange(event.startDate, event.endDate, settings.locale) && <p>{formatRange(event.startDate, event.endDate, settings.locale)}</p>}
            <p>Currency: {event.currency}</p>
            <p>Generated {new Date().toLocaleDateString(settings.locale, { day: "numeric", month: "short", year: "numeric" })}</p>
            {event.status === "settled" && <p className="font-semibold text-[#12a26a]">SETTLED</p>}
          </div>
        </header>

        <section className="mt-6 grid grid-cols-3 gap-3">
          <Card label="Total spent" value={m(math.total)} accent />
          <Card label="Expenses" value={String(event.expenses.length)} />
          <Card label="Outstanding" value={m(math.outstanding)} />
        </section>

        <H>Summary by person</H>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#FFF1E8] text-left text-xs text-[#6b4a35]">
              <Th>Person</Th>
              <Th right>Paid</Th>
              <Th right>Share</Th>
              <Th right>Sent</Th>
              <Th right>Received</Th>
              <Th right>Net balance</Th>
            </tr>
          </thead>
          <tbody>
            {math.balances.map((b) => (
              <tr key={b.personId} className="border-b border-[#eee]">
                <Td>{name(b.personId)}</Td>
                <Td right>{m(b.paid)}</Td>
                <Td right>{m(b.share)}</Td>
                <Td right>{m(b.sent)}</Td>
                <Td right>{m(b.received)}</Td>
                <Td right bold color={b.net > 0 ? "#12a26a" : b.net < 0 ? "#e0504a" : "#8a8a93"}>
                  {m(b.net, true)}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>

        <H>Who owes whom</H>
        {math.transfers.length === 0 && event.settlements.length === 0 ? (
          <p className="text-[#12a26a]">Everyone is settled up.</p>
        ) : (
          <table className="w-full border-collapse">
            <tbody>
              {math.transfers.map((t) => (
                <tr key={`${t.fromId}-${t.toId}`} className="border-b border-[#eee]">
                  <Td>
                    <b>{name(t.fromId)}</b> pays <b>{name(t.toId)}</b>
                  </Td>
                  <Td right bold>
                    {m(t.amount)}
                  </Td>
                  <Td right color="#e0504a">
                    Unpaid
                  </Td>
                </tr>
              ))}
              {[...event.settlements].reverse().map((s) => (
                <tr key={s.id} className="border-b border-[#eee] text-[#6b6b74]">
                  <Td>
                    {name(s.fromId)} paid {name(s.toId)} on {formatDate(s.date, settings.locale, { day: "numeric", month: "short" })}
                  </Td>
                  <Td right>{m(s.amount)}</Td>
                  <Td right color="#12a26a">
                    Paid
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <H>Spend by category</H>
        <div className="space-y-1.5">
          {math.byCategory.map((c) => (
            <div key={c.name} className="flex items-center gap-3">
              <span className="w-32 truncate">
                {findCategory(settings.categories, c.name).emoji} {c.name}
              </span>
              <span className="h-2.5 flex-1 rounded-r bg-[#f4f1ee]">
                <span
                  className="block h-2.5 rounded-r"
                  style={{
                    width: `${(c.amount / Math.max(1, math.byCategory[0].amount)) * 100}%`,
                    background: categoryColor(settings.categories, c.name, "light") ?? SERIES.light[0],
                    printColorAdjust: "exact",
                    WebkitPrintColorAdjust: "exact",
                  }}
                />
              </span>
              <span className="w-12 text-right text-[#6b6b74] tabular-nums">{math.total ? Math.round((c.amount / math.total) * 100) : 0}%</span>
              <span className="w-28 text-right font-medium tabular-nums">{m(c.amount)}</span>
            </div>
          ))}
        </div>

        <H>All expenses</H>
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-[#FFF1E8] text-left text-xs text-[#6b4a35]">
              <Th>Date</Th>
              <Th>Expense</Th>
              <Th>Paid by</Th>
              <Th right>Amount</Th>
              <Th>Split</Th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => {
              const shares = math.sharesByExpense.get(e.id)!;
              return (
                <tr key={e.id} className="border-b border-[#eee] align-top" style={{ breakInside: "avoid" }}>
                  <Td>{formatDate(e.date, settings.locale)}</Td>
                  <Td>
                    <b>{e.title}</b>
                    <br />
                    <span className="text-[#6b6b74]">{e.category}</span>
                  </Td>
                  <Td>{e.payers.length > 1 ? e.payers.map((p) => `${name(p.personId)} ${m(p.amount)}`).join(", ") : payersLabel(e, math.people)}</Td>
                  <Td right bold>
                    {m(e.amount)}
                  </Td>
                  <Td>
                    <span className="text-[#6b6b74]">
                      {SPLIT_MODE_LABELS[e.mode]}
                      {e.mode !== "equal" && ` · ${describeSplit(e, math.people)}`}
                    </span>
                    <br />
                    {[...shares].map(([pid, v]) => `${name(pid)} ${m(v)}`).join(" · ")}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <footer className="mt-10 border-t border-[#eee] pt-3 text-center text-xs text-[#8a8a93]">Generated with MUNE Splits</footer>
      </article>
    </div>
  );
}

function Card({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: accent ? "#FFB38A" : "#eee", background: accent ? "#FFF6F0" : "#fff" }}>
      <p className="text-xs text-[#6b6b74]">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
function H({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-8 mb-2 text-sm font-semibold tracking-wide text-[#f28a4b] uppercase">{children}</h2>;
}
function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`px-2 py-1.5 font-semibold ${right ? "text-right" : ""}`}>{children}</th>;
}
function Td({ children, right, bold, color }: { children: React.ReactNode; right?: boolean; bold?: boolean; color?: string }) {
  return (
    <td className={`px-2 py-1.5 ${right ? "text-right tabular-nums" : ""} ${bold ? "font-semibold" : ""}`} style={color ? { color } : undefined}>
      {children}
    </td>
  );
}
