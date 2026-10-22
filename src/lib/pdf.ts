"use client";

/**
 * Client-side PDF report for an event (jsPDF + jspdf-autotable). Light, print-friendly brand: white
 * page, pastel orange accents. Inter is embedded so currency symbols like ₹ render correctly.
 */
import { jsPDF } from "jspdf";
import { autoTable, type RowInput } from "jspdf-autotable";
import { describeSplit, eventMath, payersLabel } from "./event-math";
import { formatMoney } from "./money";
import { fileSafe, formatDate, formatRange } from "./format";
import { SERIES, SPLIT_MODE_LABELS, categoryColor } from "./constants";
import { asset } from "./client/backend";
import { saveFile } from "./client/platform";
import type { AppSettings, EventDetail } from "./types";

const INK = "#17171A";
const MUTED = "#6B6B74";
const LINE = "#ECE7E2";
const ORANGE = "#F28A4B";
const PASTEL = "#FFB38A";
const TINT = "#FFF4EC";
const MINT = "#12A26A";
const CORAL = "#E0504A";

const PAGE_W = 210;
const PAGE_H = 297;
const M = 14; // page margin (mm)
const CONTENT_W = PAGE_W - M * 2;

let fontCache: Promise<{ regular: string; bold: string }> | null = null;

async function loadFonts() {
  const toBase64 = async (url: string) => {
    const buf = new Uint8Array(await (await fetch(url)).arrayBuffer());
    let binary = "";
    for (let i = 0; i < buf.length; i += 0x8000) binary += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return btoa(binary);
  };
  fontCache ??= Promise.all([toBase64(asset("/fonts/Inter-Regular.ttf")), toBase64(asset("/fonts/Inter-SemiBold.ttf"))]).then(([regular, bold]) => ({ regular, bold }));
  return fontCache;
}

/** Inter has no emoji; strip them (and variation selectors) so they don't print as boxes. */
const plain = (s: string) => s.replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}️‍]/gu, "").replace(/\s{2,}/g, " ").trim();

export async function exportEventPdf(event: EventDetail, settings: AppSettings) {
  const doc = await buildEventPdf(event, settings);
  const stamp = new Date().toLocaleDateString("sv-SE");
  // Download on desktop; share sheet (save to Files, WhatsApp, …) on phones.
  await saveFile(doc.output("blob"), `MUNE-Splits_${fileSafe(event.name)}_${stamp}.pdf`);
}

export async function buildEventPdf(event: EventDetail, settings: AppSettings): Promise<jsPDF> {
  const fonts = await loadFonts();
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  doc.addFileToVFS("Inter-Regular.ttf", fonts.regular);
  doc.addFont("Inter-Regular.ttf", "Inter", "normal");
  doc.addFileToVFS("Inter-SemiBold.ttf", fonts.bold);
  doc.addFont("Inter-SemiBold.ttf", "Inter", "bold");
  doc.setFont("Inter", "normal");
  doc.setProperties({ title: `${plain(event.name)} · MUNE Splits`, creator: "MUNE Splits" });

  const math = eventMath(event);
  const cur = event.currency;
  const money = (v: number, sign = false) => formatMoney(v, cur, settings.locale, { sign });
  const name = (id: string) => plain(math.people.get(id)?.name ?? "?");
  let y = M;

  const text = (s: string, x: number, yy: number, o: { size?: number; bold?: boolean; color?: string; align?: "left" | "right" | "center" } = {}) => {
    doc.setFont("Inter", o.bold ? "bold" : "normal");
    doc.setFontSize(o.size ?? 10);
    doc.setTextColor(o.color ?? INK);
    doc.text(s, x, yy, { align: o.align ?? "left", baseline: "alphabetic" });
  };
  const ensure = (h: number) => {
    if (y + h > PAGE_H - 18) {
      doc.addPage();
      y = M + 4;
    }
  };
  const heading = (title: string) => {
    ensure(18);
    y += 9;
    doc.setFillColor(PASTEL);
    doc.roundedRect(M, y - 3.6, 1.4, 4.6, 0.7, 0.7, "F");
    text(title.toUpperCase(), M + 4, y, { size: 9, bold: true, color: ORANGE });
    y += 4;
  };
  const tableBase = {
    margin: { left: M, right: M, bottom: 20 },
    styles: { font: "Inter", fontSize: 8.5, textColor: INK, cellPadding: { top: 2, bottom: 2, left: 2.2, right: 2.2 }, lineColor: LINE, lineWidth: 0 },
    headStyles: { fillColor: TINT, textColor: "#6B4A35", fontStyle: "bold" as const, fontSize: 8 },
    alternateRowStyles: { fillColor: "#FCFBFA" },
    bodyStyles: { lineWidth: { bottom: 0.2 }, lineColor: LINE },
    didDrawPage: () => {},
  };
  const after = () => {
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  };

  /* Header ---------------------------------------------------------------- */
  drawLogo(doc, M, y, 13);
  text("MUNE", M + 16, y + 4.6, { size: 8.5, bold: true });
  text("SPLITS", M + 16 + doc.getTextWidth("MUNE ") + 0.6, y + 4.6, { size: 8.5, bold: true, color: ORANGE });
  doc.setFont("Inter", "bold");
  doc.setFontSize(18);
  const title = doc.splitTextToSize(plain(event.name), CONTENT_W - 62)[0] as string;
  text(title, M + 16, y + 11.5, { size: 18, bold: true });

  const meta = [
    formatRange(event.startDate, event.endDate, settings.locale),
    `Currency: ${cur}`,
    `Generated ${new Date().toLocaleDateString(settings.locale, { day: "numeric", month: "short", year: "numeric" })}`,
  ].filter(Boolean);
  meta.forEach((line, i) => text(line, PAGE_W - M, y + 3.5 + i * 4.2, { size: 8, color: MUTED, align: "right" }));
  if (event.status === "settled") {
    doc.setFillColor("#E7F6EF");
    doc.roundedRect(PAGE_W - M - 18, y + 3.5 + meta.length * 4.2 - 2.4, 18, 5, 2.5, 2.5, "F");
    text("SETTLED", PAGE_W - M - 9, y + 3.5 + meta.length * 4.2 + 1.2, { size: 7, bold: true, color: MINT, align: "center" });
  }
  y += 17;
  if (event.description) {
    const lines = doc.splitTextToSize(plain(event.description), CONTENT_W) as string[];
    doc.setFont("Inter", "normal");
    lines.slice(0, 3).forEach((l) => {
      text(l, M, y + 3, { size: 9, color: MUTED });
      y += 4.4;
    });
    y += 1;
  }
  doc.setDrawColor(PASTEL);
  doc.setLineWidth(0.6);
  doc.line(M, y, PAGE_W - M, y);
  y += 6;

  /* Summary cards ----------------------------------------------------------- */
  const cards: [string, string, boolean][] = [
    ["Total spent", money(math.total), true],
    ["Expenses", String(event.expenses.length), false],
    ["People", String(event.participants.length), false],
    ["Still to settle", money(math.outstanding), false],
  ];
  const gap = 3;
  const cw = (CONTENT_W - gap * 3) / 4;
  cards.forEach(([label, value, accent], i) => {
    const x = M + i * (cw + gap);
    doc.setFillColor(accent ? TINT : "#FFFFFF");
    doc.setDrawColor(accent ? PASTEL : LINE);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, cw, 17, 2.5, 2.5, "FD");
    text(label, x + 3.5, y + 5.5, { size: 7.5, color: MUTED });
    text(value, x + 3.5, y + 12.8, { size: 13, bold: true, color: accent ? "#C25E22" : INK });
  });
  y += 17;

  /* Per person ---------------------------------------------------------------- */
  heading("Summary by person");
  autoTable(doc, {
    ...tableBase,
    startY: y,
    head: [["Person", "Paid", "Share", "Sent", "Received", "Net balance"]],
    body: math.balances.map((b) => [
      name(b.personId),
      money(b.paid),
      money(b.share),
      b.sent ? money(b.sent) : "–",
      b.received ? money(b.received) : "–",
      { content: `${money(b.net, true)}  ${b.net > 0 ? "gets back" : b.net < 0 ? "owes" : "settled"}`, styles: { fontStyle: "bold", textColor: b.net > 0 ? MINT : b.net < 0 ? CORAL : MUTED } },
    ]) as RowInput[],
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
    didParseCell: (d) => {
      if (d.section === "head" && d.column.index > 0) d.cell.styles.halign = "right";
    },
  });
  after();

  /* Who owes whom ------------------------------------------------------------- */
  heading("Who owes whom");
  const owes: RowInput[] = [
    ...math.transfers.map((t) => [
      { content: `${name(t.fromId)}  pays  ${name(t.toId)}`, styles: { fontStyle: "bold" as const } },
      { content: money(t.amount), styles: { fontStyle: "bold" as const } },
      { content: "Unpaid", styles: { textColor: CORAL, fontStyle: "bold" as const } },
      "",
    ]),
    ...[...event.settlements].reverse().map((s) => [
      `${name(s.fromId)}  paid  ${name(s.toId)}`,
      money(s.amount),
      { content: "Paid", styles: { textColor: MINT, fontStyle: "bold" as const } },
      formatDate(s.date, settings.locale, { day: "numeric", month: "short", year: "numeric" }),
    ]),
  ];
  if (owes.length === 0) {
    ensure(8);
    text("Everyone is settled up. No payments needed.", M, y + 4, { size: 9.5, color: MINT, bold: true });
    y += 6;
  } else {
    autoTable(doc, {
      ...tableBase,
      startY: y,
      head: [["Payment", "Amount", "Status", "Date"]],
      body: owes,
      columnStyles: { 1: { halign: "right" }, 0: { cellWidth: 92 } },
      didParseCell: (d) => {
        if (d.section === "head" && d.column.index === 1) d.cell.styles.halign = "right";
      },
    });
    after();
  }

  /* Category breakdown -------------------------------------------------------- */
  if (math.byCategory.length) {
    heading("Spend by category");
    const top = math.byCategory[0].amount || 1;
    const rowH = 6.2;
    const labelW = 34;
    const valueW = 40;
    const barW = CONTENT_W - labelW - valueW - 4;
    for (const c of math.byCategory) {
      ensure(rowH + 1);
      const color = categoryColor(settings.categories, c.name, "light") ?? SERIES.light[0];
      const cy = y + 3;
      text(plain(c.name), M, cy + 1.2, { size: 8.5 });
      doc.setFillColor("#F4F1EE");
      doc.roundedRect(M + labelW, cy - 1.6, barW, 3.2, 0.8, 0.8, "F");
      doc.setFillColor(color);
      const w = Math.max(1.2, (c.amount / top) * barW);
      doc.roundedRect(M + labelW, cy - 1.6, w, 3.2, 0.8, 0.8, "F");
      const pct = math.total ? Math.round((c.amount / math.total) * 100) : 0;
      text(`${pct}%`, M + labelW + barW + 12, cy + 1.2, { size: 8, color: MUTED, align: "right" });
      text(money(c.amount), PAGE_W - M, cy + 1.2, { size: 8.5, bold: true, align: "right" });
      y += rowH;
    }
  }

  /* Expenses ------------------------------------------------------------------ */
  heading("All expenses");
  const expenses = [...event.expenses].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  const perPersonCols = event.participants.length <= 5;
  const head = ["Date", "Expense", "Paid by", "Amount", "Split", ...(perPersonCols ? event.participants.map((p) => plain(p.name)) : ["Shares"])];
  const body: RowInput[] = expenses.map((e) => {
    const shares = math.sharesByExpense.get(e.id)!;
    const paidBy = e.payers.length > 1 ? e.payers.map((p) => `${name(p.personId)} ${money(p.amount)}`).join("\n") : plain(payersLabel(e, math.people));
    const split = e.mode === "equal" ? SPLIT_MODE_LABELS.equal : `${SPLIT_MODE_LABELS[e.mode]}\n${plain(describeSplit(e, math.people))}`;
    const shareCells = perPersonCols
      ? event.participants.map((p) => (shares.get(p.id) ? money(shares.get(p.id)!) : "–"))
      : [[...shares].map(([id, v]) => `${name(id)} ${money(v)}`).join("\n")];
    return [
      formatDate(e.date, settings.locale),
      { content: `${plain(e.title)}\n${e.category}`, styles: { fontStyle: "normal" as const } },
      paidBy,
      { content: money(e.amount), styles: { fontStyle: "bold" as const } },
      split,
      ...shareCells,
    ];
  });
  const totalShares = perPersonCols ? event.participants.map((p) => money(math.balanceOf(p.id).share)) : [""];
  autoTable(doc, {
    ...tableBase,
    startY: y,
    head: [head],
    body,
    foot: [["", "Total", "", money(math.total), "", ...totalShares]],
    footStyles: { fillColor: TINT, textColor: INK, fontStyle: "bold", fontSize: 8 },
    showFoot: "lastPage",
    rowPageBreak: "avoid",
    styles: { ...tableBase.styles, fontSize: perPersonCols && event.participants.length > 3 ? 7.4 : 8 },
    columnStyles: {
      0: { cellWidth: 14 },
      1: { cellWidth: perPersonCols ? 34 : 44 },
      3: { halign: "right" },
      ...Object.fromEntries(Array.from({ length: perPersonCols ? event.participants.length : 1 }, (_, i) => [5 + i, { halign: "right" as const }])),
    },
    didParseCell: (d) => {
      if ((d.section === "head" || d.section === "foot") && (d.column.index === 3 || d.column.index >= 5)) d.cell.styles.halign = "right";
      // Second line of the expense cell (category) in muted ink is approximated by a smaller size.
      if (d.section === "body" && d.column.index === 4) d.cell.styles.textColor = MUTED;
    },
  });
  after();

  /* Settlement history -------------------------------------------------------- */
  if (event.settlements.length) {
    heading("Settlement history");
    autoTable(doc, {
      ...tableBase,
      startY: y,
      head: [["Date", "From", "To", "Amount", "Note"]],
      body: [...event.settlements].reverse().map((s) => [
        formatDate(s.date, settings.locale, { day: "numeric", month: "short", year: "numeric" }),
        name(s.fromId),
        name(s.toId),
        { content: money(s.amount), styles: { fontStyle: "bold" as const } },
        plain(s.note) || "–",
      ]),
      columnStyles: { 3: { halign: "right" } },
      didParseCell: (d) => {
        if (d.section === "head" && d.column.index === 3) d.cell.styles.halign = "right";
      },
    });
    after();
  }

  /* Footer on every page ------------------------------------------------------ */
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(LINE);
    doc.setLineWidth(0.2);
    doc.line(M, PAGE_H - 12, PAGE_W - M, PAGE_H - 12);
    drawLogo(doc, M, PAGE_H - 9.6, 4);
    text("Generated with MUNE Splits", M + 5.6, PAGE_H - 6.6, { size: 7.5, color: MUTED });
    text(`${plain(event.name)} · Page ${i} of ${pages}`, PAGE_W - M, PAGE_H - 6.6, { size: 7.5, color: MUTED, align: "right" });
  }
  return doc;
}

/** The MUNE Splits mark drawn with vector shapes (tile, M, split circle) at `size` mm. */
function drawLogo(doc: jsPDF, x: number, y: number, size: number) {
  const s = size / 64;
  const X = (v: number) => x + v * s;
  const Y = (v: number) => y + v * s;
  doc.setFillColor("#FFA66B");
  doc.roundedRect(X(2), Y(2), 60 * s, 60 * s, 16 * s, 16 * s, "F");
  doc.setDrawColor("#1C1009");
  doc.setLineWidth(6 * s);
  doc.setLineCap("round");
  doc.setLineJoin("round");
  doc.lines(
    [
      [0, -25 * s],
      [14 * s, 15 * s],
      [14 * s, -15 * s],
      [0, 25 * s],
    ],
    X(13),
    Y(47),
    [1, 1],
    "S",
  );
  doc.setLineWidth(2.2 * s);
  doc.circle(X(50.5), Y(17), 5 * s, "S");
  doc.setFillColor("#1C1009");
  // Right half of the circle, filled.
  doc.lines(
    [
      [2.76 * s, 0, 5 * s, 2.24 * s, 5 * s, 5 * s],
      [0, 2.76 * s, -2.24 * s, 5 * s, -5 * s, 5 * s],
    ],
    X(50.5),
    Y(12),
    [1, 1],
    "F",
    true,
  );
  doc.setLineCap("butt");
}
