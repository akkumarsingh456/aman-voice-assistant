import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, BellRing, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Reminder = {
  id: string;
  text: string;
  remind_at: string;
  channel: string;
  delivered: boolean;
};

export function RemindersPanel({ refreshKey }: { refreshKey?: number }) {
  const [items, setItems] = useState<Reminder[] | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("reminders")
        .select("id, text, remind_at, channel, delivered")
        .eq("delivered", false)
        .order("remind_at", { ascending: true })
        .limit(50);
      if (active) setItems(data ?? []);
    })();
    return () => {
      active = false;
    };
  }, [refreshKey, tick]);

  const dismiss = async (id: string) => {
    await supabase
      .from("reminders")
      .update({ delivered: true, delivered_at: new Date().toISOString() })
      .eq("id", id);
    setTick((t) => t + 1);
  };

  if (items === null) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading reminders…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border/50 bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        <BellRing className="mx-auto mb-2 h-6 w-6 opacity-60" />
        No reminders set. Say <em className="text-foreground">"Aman, remind me at 7am tomorrow…"</em>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((r) => {
        const when = new Date(r.remind_at);
        const isPast = when.getTime() < Date.now();
        return (
          <li
            key={r.id}
            className={`glass flex items-start justify-between gap-3 rounded-xl border px-4 py-3 ${
              isPast ? "border-rose-500/30 bg-rose-500/5" : "border-border/40"
            }`}
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{r.text}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {when.toLocaleString()} · {r.channel}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => void dismiss(r.id)}
              aria-label="Mark done"
            >
              <CheckCircle2 className="h-4 w-4" />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
