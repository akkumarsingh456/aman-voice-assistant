import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type DueReminder = {
  id: string;
  text: string;
  remind_at: string;
};

async function getCustomSongUrl(): Promise<string | null> {
  if (typeof indexedDB === "undefined") return null;
  return new Promise((resolve) => {
    const req = indexedDB.open("aman-alarm", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("song");
    req.onerror = () => resolve(null);
    req.onsuccess = () => {
      try {
        const db = req.result;
        const tx = db.transaction("song", "readonly");
        const r = tx.objectStore("song").get("current");
        r.onsuccess = () => {
          const v = r.result as { blob: Blob } | undefined;
          resolve(v?.blob ? URL.createObjectURL(v.blob) : null);
        };
        r.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    };
  });
}

/**
 * Polls reminders every 20s while app is open; rings a tone when one is due.
 * Browser-only — locked phone won't fire (use Telegram channel for that).
 */
export function useReminderAlarm() {
  const [ringing, setRinging] = useState<DueReminder | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<{ stop: () => void } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Poll every 20s
  useEffect(() => {
    let active = true;
    const tick = async () => {
      if (!active || ringing) return;
      const nowIso = new Date().toISOString();
      const { data } = await supabase
        .from("reminders")
        .select("id, text, remind_at")
        .eq("delivered", false)
        .lte("remind_at", nowIso)
        .order("remind_at", { ascending: true })
        .limit(1);
      if (active && data && data[0]) setRinging(data[0]);
    };
    void tick();
    const id = setInterval(tick, 20_000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [ringing]);

  // Start tone when ringing
  useEffect(() => {
    if (!ringing) return;
    if (typeof window === "undefined") return;
    try {
      const Ctx =
        window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      ctxRef.current = ctx;

      // Pleasant double-tone loop
      let stopped = false;
      const playPattern = () => {
        if (stopped) return;
        const t0 = ctx.currentTime;
        [0, 0.35].forEach((delay, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = "sine";
          o.frequency.value = i === 0 ? 880 : 660;
          g.gain.setValueAtTime(0, t0 + delay);
          g.gain.linearRampToValueAtTime(0.18, t0 + delay + 0.02);
          g.gain.linearRampToValueAtTime(0, t0 + delay + 0.28);
          o.connect(g).connect(ctx.destination);
          o.start(t0 + delay);
          o.stop(t0 + delay + 0.3);
        });
        setTimeout(playPattern, 1100);
      };
      playPattern();
      oscRef.current = {
        stop: () => {
          stopped = true;
          ctx.close().catch(() => {});
        },
      };
    } catch (err) {
      console.warn("Alarm audio unavailable:", err);
    }

    // Vibrate if available
    try {
      navigator.vibrate?.([400, 200, 400, 200, 400]);
    } catch {}

    return () => {
      oscRef.current?.stop();
      oscRef.current = null;
      ctxRef.current = null;
    };
  }, [ringing]);

  const stop = async () => {
    if (!ringing) return;
    await supabase
      .from("reminders")
      .update({ delivered: true, delivered_at: new Date().toISOString() })
      .eq("id", ringing.id);
    setRinging(null);
  };

  const snooze = async (minutes = 5) => {
    if (!ringing) return;
    const next = new Date(Date.now() + minutes * 60_000).toISOString();
    await supabase
      .from("reminders")
      .update({ remind_at: next })
      .eq("id", ringing.id);
    setRinging(null);
  };

  return { ringing, stop, snooze };
}
