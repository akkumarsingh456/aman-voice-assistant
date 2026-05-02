import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2 } from "lucide-react";

type Done = {
  id: string;
  text: string;
  remind_at: string;
  delivered_at: string | null;
};

export function TimelinePanel({ refreshKey }: { refreshKey?: number }) {
  const [items, setItems] = useState<Done[] | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("reminders")
        .select("id, text, remind_at, delivered_at")
        .eq("delivered", true)
        .order("delivered_at", { ascending: false })
        .limit(100);
      if (active) setItems(data ?? []);
    })();
    return () => {
      active = false;
    };
  }, [refreshKey]);

  if (items === null) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading timeline…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border/50 bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        <CheckCircle2 className="mx-auto mb-2 h-6 w-6 opacity-60" />
        No completed reminders yet.
      </div>
    );
  }

  return (
    <ol className="relative space-y-3 border-l border-border/50 pl-5">
      {items.map((r) => {
        const due = new Date(r.remind_at);
        const done = r.delivered_at ? new Date(r.delivered_at) : null;
        return (
          <li key={r.id} className="relative">
            <span className="absolute -left-[26px] top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary/20 ring-2 ring-primary/40">
              <CheckCircle2 className="h-3 w-3 text-primary" />
            </span>
            <div className="glass rounded-xl border border-border/40 px-4 py-3">
              <p className="text-sm font-medium text-foreground">{r.text}</p>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <span>Due: {due.toLocaleString()}</span>
                {done && <span>Done: {done.toLocaleString()}</span>}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
