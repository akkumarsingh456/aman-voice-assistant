import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, History } from "lucide-react";

type Item = {
  kind: "note" | "reminder" | "message";
  id: string;
  title: string;
  meta: string;
  at: string;
};

export function HistoryPanel({ refreshKey }: { refreshKey?: number }) {
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const [notes, reminders, messages] = await Promise.all([
        supabase
          .from("notes")
          .select("id, text, category, created_at")
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("reminders")
          .select("id, text, remind_at, delivered, delivered_at, created_at")
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("messages")
          .select("id, role, content, created_at")
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      const merged: Item[] = [];
      for (const n of notes.data ?? []) {
        merged.push({
          kind: "note",
          id: `n-${n.id}`,
          title: n.text,
          meta: `Note · ${n.category}`,
          at: n.created_at,
        });
      }
      for (const r of reminders.data ?? []) {
        merged.push({
          kind: "reminder",
          id: `r-${r.id}`,
          title: r.text,
          meta: r.delivered ? "Reminder · done" : "Reminder · upcoming",
          at: r.created_at,
        });
      }
      for (const m of messages.data ?? []) {
        merged.push({
          kind: "message",
          id: `m-${m.id}`,
          title: m.content.slice(0, 120),
          meta: m.role === "user" ? "You said" : "Aman replied",
          at: m.created_at,
        });
      }
      merged.sort((a, b) => +new Date(b.at) - +new Date(a.at));
      if (active) setItems(merged.slice(0, 60));
    })();
    return () => {
      active = false;
    };
  }, [refreshKey]);

  if (items === null) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading history…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border/50 bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        <History className="mx-auto mb-2 h-6 w-6 opacity-60" />
        Nothing yet. Talk to Aman to start your history.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((it) => (
        <li
          key={it.id}
          className="glass rounded-xl border border-border/40 px-4 py-3"
        >
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {it.meta}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {new Date(it.at).toLocaleString()}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-foreground line-clamp-3">
            {it.title}
          </p>
        </li>
      ))}
    </ul>
  );
}
