import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2,
  BellRing,
  CheckCircle2,
  Plus,
  Clock,
  Trash2,
  Music,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAlarmSound } from "@/hooks/useAlarmSound";

type Reminder = {
  id: string;
  text: string;
  remind_at: string;
  channel: string;
  delivered: boolean;
};

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function RemindersPanel({ refreshKey }: { refreshKey?: number }) {
  const [items, setItems] = useState<Reminder[] | null>(null);
  const [tick, setTick] = useState(0);

  const [newText, setNewText] = useState("");
  const [newWhen, setNewWhen] = useState(() =>
    toLocalInput(new Date(Date.now() + 30 * 60_000))
  );
  const [saving, setSaving] = useState(false);

  const [reschedId, setReschedId] = useState<string | null>(null);
  const [reschedWhen, setReschedWhen] = useState("");

  const { name: songName, setSong, clearSong } = useAlarmSound();
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("reminders")
        .select("id, text, remind_at, channel, delivered")
        .eq("delivered", false)
        .order("remind_at", { ascending: true })
        .limit(100);
      if (active) setItems(data ?? []);
    })();
    return () => {
      active = false;
    };
  }, [refreshKey, tick]);

  const addReminder = async () => {
    const text = newText.trim();
    if (!text || !newWhen) return;
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not signed in");
      setSaving(false);
      return;
    }
    const { error } = await supabase.from("reminders").insert({
      user_id: user.id,
      text,
      remind_at: new Date(newWhen).toISOString(),
      channel: "web",
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Reminder set");
    setNewText("");
    setNewWhen(toLocalInput(new Date(Date.now() + 30 * 60_000)));
    setTick((t) => t + 1);
  };

  const dismiss = async (id: string) => {
    await supabase
      .from("reminders")
      .update({ delivered: true, delivered_at: new Date().toISOString() })
      .eq("id", id);
    setTick((t) => t + 1);
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("reminders").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Reminder deleted");
    setTick((t) => t + 1);
  };

  const startReschedule = (r: Reminder) => {
    setReschedId(r.id);
    setReschedWhen(toLocalInput(new Date(r.remind_at)));
  };

  const saveReschedule = async () => {
    if (!reschedId || !reschedWhen) return;
    const { error } = await supabase
      .from("reminders")
      .update({ remind_at: new Date(reschedWhen).toISOString() })
      .eq("id", reschedId);
    if (error) return toast.error(error.message);
    toast.success("Reminder rescheduled");
    setReschedId(null);
    setTick((t) => t + 1);
  };

  const onPickSong = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("audio/")) {
      toast.error("Please choose an audio file");
      return;
    }
    await setSong(f);
    toast.success(`Alarm tone: ${f.name}`);
    e.target.value = "";
  };

  return (
    <div className="space-y-3">
      {/* Composer */}
      <div className="glass space-y-2 rounded-xl border border-border/40 p-3">
        <Input
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="What should I remind you about?"
        />
        <div className="flex gap-2">
          <Input
            type="datetime-local"
            value={newWhen}
            onChange={(e) => setNewWhen(e.target.value)}
            className="flex-1"
          />
          <Button
            onClick={() => void addReminder()}
            disabled={!newText.trim() || !newWhen || saving}
            className="gap-2"
          >
            <Plus className="h-4 w-4" /> Set
          </Button>
        </div>
      </div>

      {/* Custom alarm song */}
      <div className="glass flex items-center gap-2 rounded-xl border border-border/40 p-3">
        <Music className="h-4 w-4 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Alarm tone</p>
          <p className="truncate text-sm font-medium text-foreground">
            {songName ?? "Default chime"}
          </p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={onPickSong}
        />
        <Button
          size="sm"
          variant="secondary"
          onClick={() => fileRef.current?.click()}
        >
          {songName ? "Change" : "Pick song"}
        </Button>
        {songName && (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground"
            onClick={() => void clearSong()}
            aria-label="Reset to default"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* List */}
      {items === null ? (
        <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-border/50 bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          <BellRing className="mx-auto mb-2 h-6 w-6 opacity-60" />
          No reminders set.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((r) => {
            const when = new Date(r.remind_at);
            const isPast = when.getTime() < Date.now();
            return (
              <li
                key={r.id}
                className={`glass rounded-xl border px-4 py-3 ${
                  isPast ? "border-rose-500/30 bg-rose-500/5" : "border-border/40"
                }`}
              >
                {reschedId === r.id ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">{r.text}</p>
                    <div className="flex gap-2">
                      <Input
                        type="datetime-local"
                        value={reschedWhen}
                        onChange={(e) => setReschedWhen(e.target.value)}
                        className="flex-1"
                      />
                      <Button size="sm" onClick={() => void saveReschedule()}>
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setReschedId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{r.text}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {when.toLocaleString()} · {r.channel}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => startReschedule(r)}
                        aria-label="Reschedule"
                      >
                        <Clock className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => void dismiss(r.id)}
                        aria-label="Mark done"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => void remove(r.id)}
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
