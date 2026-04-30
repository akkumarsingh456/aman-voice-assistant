import { useCallback, useEffect, useRef, useState } from "react";
import type { OrbState } from "@/components/AmanOrb";
import { supabase } from "@/integrations/supabase/client";

export type ChatMessage = { role: "user" | "assistant"; content: string };

interface VoiceCapabilities {
  recognition: boolean;
  synthesis: boolean;
}

function detectCapabilities(): VoiceCapabilities {
  if (typeof window === "undefined") return { recognition: false, synthesis: false };
  const recognition =
    "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
  const synthesis = "speechSynthesis" in window;
  return { recognition, synthesis };
}

// Heuristic: contains Devanagari → use hi-IN; else en-IN
function detectLang(text: string): "en-IN" | "hi-IN" {
  return /[\u0900-\u097F]/.test(text) ? "hi-IN" : "en-IN";
}

const SENTENCE_END = /([.!?。！？]|[\n])\s*/;

export type MicPermission = "unknown" | "prompt" | "granted" | "denied";

export function useVoiceConversation() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [interim, setInterim] = useState("");
  const [capabilities] = useState<VoiceCapabilities>(detectCapabilities);
  const [micBlocked, setMicBlocked] = useState(false);
  const [micPermission, setMicPermission] = useState<MicPermission>("unknown");
  const [audioLevel, setAudioLevel] = useState(0);
  const conversationIdRef = useRef<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const abortRef = useRef<AbortController | null>(null);
  const ttsLangRef = useRef<"en-IN" | "hi-IN">("en-IN");
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  // Query existing permission state on mount (Chromium browsers)
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions) return;
    navigator.permissions
      .query({ name: "microphone" as PermissionName })
      .then((status: PermissionStatus) => {
        setMicPermission(status.state as MicPermission);
        if (status.state === "denied") setMicBlocked(true);
        status.onchange = () => {
          setMicPermission(status.state as MicPermission);
          if (status.state === "granted") setMicBlocked(false);
          if (status.state === "denied") setMicBlocked(true);
        };
      })
      .catch(() => {
        /* permissions API not available */
      });
  }, []);

  // Stop the audio level meter & release mic
  const stopMeter = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
  }, []);

  // Start audio level meter from a granted media stream
  const startMeter = useCallback((stream: MediaStream) => {
    try {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      const ctx = new Ctx();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        setAudioLevel(Math.min(1, rms * 4));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      console.warn("Audio meter unavailable:", err);
    }
  }, []);

  // Explicitly request mic permission (triggers the browser prompt)
  const requestMicPermission = useCallback(async (): Promise<boolean> => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setMicBlocked(true);
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Release immediately — recognition will manage its own stream.
      stream.getTracks().forEach((t) => t.stop());
      setMicPermission("granted");
      setMicBlocked(false);
      return true;
    } catch (err: any) {
      console.warn("Mic permission denied:", err?.name);
      setMicPermission("denied");
      setMicBlocked(true);
      return false;
    }
  }, []);


  // ───── TTS helpers ─────
  const speakChunk = useCallback((text: string, lang: "en-IN" | "hi-IN") => {
    if (!capabilities.synthesis || !text.trim()) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = 1.05;
    u.pitch = 1;
    window.speechSynthesis.speak(u);
  }, [capabilities.synthesis]);



  const stopAll = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (capabilities.synthesis) window.speechSynthesis.cancel();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    stopMeter();
    setInterim("");
    setOrbState("idle");
  }, [capabilities.synthesis, stopMeter]);

  // Speak a long reply by chunking on sentence boundaries (smoother than one big utterance).
  const speakReply = useCallback(
    (text: string, lang: "en-IN" | "hi-IN") => {
      if (!capabilities.synthesis) return;
      window.speechSynthesis.cancel();
      const parts = text.split(SENTENCE_END).filter((s) => s && s.trim().length > 1);
      const chunks: string[] = [];
      let buf = "";
      for (const p of parts) {
        buf += p;
        if (/[.!?。！？\n]$/.test(buf)) {
          chunks.push(buf.trim());
          buf = "";
        }
      }
      if (buf.trim()) chunks.push(buf.trim());
      for (const c of chunks.length ? chunks : [text]) {
        speakChunk(c, lang);
      }
    },
    [capabilities.synthesis, speakChunk],
  );

  // ───── Send to AI (non-streaming, tool-aware) ─────
  const sendToAI = useCallback(
    async (history: ChatMessage[]) => {
      setOrbState("thinking");
      const lastUser = history[history.length - 1]?.content ?? "";
      ttsLangRef.current = detectLang(lastUser);

      // Optimistic empty assistant bubble
      setMessages((m) => [...m, { role: "assistant", content: "" }]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (!token) throw new Error("Please sign in.");

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            messages: history,
            conversation_id: conversationIdRef.current,
          }),
          signal: controller.signal,
        });

        const json = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(json?.error || `HTTP ${response.status}`);
        }

        const reply: string = json.reply ?? "";
        if (json.conversation_id) conversationIdRef.current = json.conversation_id;

        const replyLang = detectLang(reply);
        ttsLangRef.current = replyLang;

        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: reply };
          return copy;
        });

        if (capabilities.synthesis && reply) {
          setOrbState("speaking");
          speakReply(reply, replyLang);
          const checkIdle = () => {
            if (window.speechSynthesis.speaking) setTimeout(checkIdle, 250);
            else setOrbState("idle");
          };
          checkIdle();
        } else {
          setOrbState("idle");
        }
      } catch (err: any) {
        if (err?.name === "AbortError") {
          setOrbState("idle");
          return;
        }
        console.error("Chat error:", err);
        setMessages((m) => {
          const copy = [...m];
          const last = copy[copy.length - 1];
          if (last?.role === "assistant" && !last.content) {
            copy[copy.length - 1] = {
              role: "assistant",
              content: `⚠ ${err?.message ?? "Something went wrong."}`,
            };
          }
          return copy;
        });
        setOrbState("error");
      } finally {
        abortRef.current = null;
      }
    },
    [capabilities.synthesis, speakReply],
  );

  const sendText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const next: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
      setMessages(next);
      await sendToAI(next);
    },
    [messages, sendToAI],
  );

  // ───── Recognition ─────
  const startListening = useCallback(async () => {
    if (!capabilities.recognition) return;

    // If currently speaking/thinking → interrupt
    if (orbState === "speaking" || orbState === "thinking") {
      stopAll();
      return;
    }
    // If already listening → tap to stop
    if (orbState === "listening" && recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* noop */ }
      return;
    }

    // Make sure we have mic permission FIRST — this triggers the browser prompt
    // explicitly so users see it on tap, not silently inside the recognition API.
    if (micPermission !== "granted") {
      const ok = await requestMicPermission();
      if (!ok) {
        setOrbState("error");
        return;
      }
    }

    // Acquire a stream we own for the level meter (recognition uses its own).
    let meterStream: MediaStream | null = null;
    try {
      meterStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = meterStream;
      startMeter(meterStream);
    } catch {
      // Meter is non-essential; recognition can still run.
    }

    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-IN";
    rec.maxAlternatives = 1;

    let finalText = "";
    let silenceTimer: ReturnType<typeof setTimeout> | null = null;
    const resetSilence = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        try { rec.stop(); } catch { /* noop */ }
      }, 5000);
    };

    rec.onstart = () => {
      setOrbState("listening");
      resetSilence();
    };
    rec.onresult = (e: any) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t;
        else interimText += t;
      }
      setInterim(interimText);
      resetSilence();
    };
    rec.onerror = (e: any) => {
      if (silenceTimer) clearTimeout(silenceTimer);
      stopMeter();
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setMicPermission("denied");
        setMicBlocked(true);
        setOrbState("error");
        return;
      }
      if (e.error === "no-speech" || e.error === "aborted") {
        setOrbState("idle");
        return;
      }
      console.error("Recognition error:", e.error);
      setOrbState("error");
    };
    rec.onend = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      stopMeter();
      setInterim("");
      const text = finalText.trim();
      recognitionRef.current = null;
      if (text) {
        void sendText(text);
      } else {
        setOrbState("idle");
      }
    };

    recognitionRef.current = rec;
    try {
      rec.start();
    } catch (err) {
      console.error(err);
      stopMeter();
      setOrbState("idle");
    }
  }, [
    capabilities.recognition,
    orbState,
    sendText,
    stopAll,
    micPermission,
    requestMicPermission,
    startMeter,
    stopMeter,
  ]);

  // Pause when tab hidden
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) stopAll();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [stopAll]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMeter();
    };
  }, [stopMeter]);

  return {
    messages,
    orbState,
    interim,
    capabilities,
    micBlocked,
    micPermission,
    audioLevel,
    startListening,
    stopAll,
    sendText,
    requestMicPermission,
  };
}

