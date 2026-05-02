import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const r of rows) lines.push(headers.map((h) => csvEscape(r[h])).join(","));
  return lines.join("\n");
}

function download(filename: string, content: BlobPart, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function fetchAll() {
  const [notes, reminders, messages] = await Promise.all([
    supabase
      .from("notes")
      .select("text, category, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("reminders")
      .select("text, remind_at, channel, delivered, delivered_at, created_at")
      .order("remind_at", { ascending: false }),
    supabase
      .from("messages")
      .select("role, content, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);
  return {
    notes: notes.data ?? [],
    reminders: reminders.data ?? [],
    messages: messages.data ?? [],
  };
}

export async function exportCsv() {
  const { notes, reminders, messages } = await fetchAll();
  const stamp = new Date().toISOString().slice(0, 10);
  download(`aman-notes-${stamp}.csv`, toCsv(notes), "text/csv");
  download(`aman-reminders-${stamp}.csv`, toCsv(reminders), "text/csv");
  download(`aman-history-${stamp}.csv`, toCsv(messages), "text/csv");
}

export async function exportPdf() {
  const { notes, reminders, messages } = await fetchAll();
  const doc = new jsPDF();
  const stamp = new Date().toLocaleString();

  doc.setFontSize(18);
  doc.text("AMAN KUMAR ASSISTANT — Report", 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Generated ${stamp}`, 14, 25);
  doc.setTextColor(0);

  let y = 32;

  doc.setFontSize(13);
  doc.text(`Notes (${notes.length})`, 14, y);
  autoTable(doc, {
    startY: y + 3,
    head: [["Category", "Text", "Created"]],
    body: notes.map((n) => [
      n.category,
      n.text,
      new Date(n.created_at).toLocaleString(),
    ]),
    styles: { fontSize: 9, cellWidth: "wrap" },
    columnStyles: { 1: { cellWidth: 100 } },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  if (y > 250) {
    doc.addPage();
    y = 20;
  }
  doc.setFontSize(13);
  doc.text(`Reminders (${reminders.length})`, 14, y);
  autoTable(doc, {
    startY: y + 3,
    head: [["When", "Text", "Channel", "Status", "Done at"]],
    body: reminders.map((r) => [
      new Date(r.remind_at).toLocaleString(),
      r.text,
      r.channel,
      r.delivered ? "done" : "upcoming",
      r.delivered_at ? new Date(r.delivered_at).toLocaleString() : "—",
    ]),
    styles: { fontSize: 9 },
    columnStyles: { 1: { cellWidth: 70 } },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  if (y > 250) {
    doc.addPage();
    y = 20;
  }
  doc.setFontSize(13);
  doc.text(`History (latest ${messages.length})`, 14, y);
  autoTable(doc, {
    startY: y + 3,
    head: [["When", "Who", "Message"]],
    body: messages.map((m) => [
      new Date(m.created_at).toLocaleString(),
      m.role,
      m.content,
    ]),
    styles: { fontSize: 9 },
    columnStyles: { 2: { cellWidth: 110 } },
  });

  doc.save(`aman-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}
