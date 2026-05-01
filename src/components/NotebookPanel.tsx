import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, StickyNote } from "lucide-react";

type Note = {
  id: string;
  text: string;
  category: string;
  created_at: string;
};

const CATEGORY_COLORS: Record<string, string> = {
  Idea: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  "To-Do": "bg-blue-500/15 text-blue-300 border-blue-500/30",
  Important: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  Random: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  Shopping: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  Other: "bg-muted text-muted-foreground border-border",
};

export function NotebookPanel({ refreshKey }: { refreshKey?: number }) {
  const [notes, setNotes] = useState<Note[] | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("notes")
        .select("id, text, category, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (active) setNotes(data ?? []);
    })();
    return () => {
      active = false;
    };
  }, [refreshKey]);

  if (notes === null) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading notes…
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className="rounded-xl border border-border/50 bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        <StickyNote className="mx-auto mb-2 h-6 w-6 opacity-60" />
        No notes yet. Say <em className="text-foreground">"Aman, save this idea — …"</em>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {notes.map((n) => (
        <li
          key={n.id}
          className="glass rounded-xl border border-border/40 px-4 py-3"
        >
          <div className="mb-1 flex items-center justify-between gap-2">
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                CATEGORY_COLORS[n.category] ?? CATEGORY_COLORS.Other
              }`}
            >
              {n.category}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {new Date(n.created_at).toLocaleString()}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-foreground">{n.text}</p>
        </li>
      ))}
    </ul>
  );
}
