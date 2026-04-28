import { useCallback, useEffect, useRef, useState } from "react";
import type { OrbState } from "@/components/AmanOrb";

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

  const recognitionRef = useRef<any>(null);
  const abortRef = useRef<AbortController | null>(null);
  const ttsBufferRef = useRef("");
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

  const flushBufferedSentences = useCallback(() => {
    let buf = ttsBufferRef.current;
    while (true) {
      const m = buf.match(SENTENCE_END);
      if (!m || m.index === undefined) break;
      const end = m.index + m[0].length;
      const sentence = buf.slice(0, end).trim();
      buf = buf.slice(end);
      if (sentence) speakChunk(sentence, ttsLangRef.current);
    }
    ttsBufferRef.current = buf;
  }, [speakChunk]);

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
    ttsBufferRef.current = "";
    setInterim("");
    setOrbState("idle");
  }, [capabilities.synthesis]);

  // ───── Send to AI (streaming) ─────
  const sendToAI = useCallback(
    async (history: ChatMessage[]) => {
      setOrbState("thinking");
      ttsBufferRef.current = "";
      ttsLangRef.current = detectLang(history[history.length - 1]?.content ?? "");

      // Append empty assistant placeholder to update progressively
      setMessages((m) => [...m, { role: "assistant", content: "" }]);

      const controller = new AbortController();
      abortRef.current = controller;
      let assistantText = "";
      let firstToken = true;

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          const errBody = await response.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(errBody.error || `HTTP ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let textBuffer = "";
        let done = false;

        while (!done) {
          const { done: rDone, value } = await reader.read();
          if (rDone) break;
          textBuffer += decoder.decode(value, { stream: true });

          let nl: number;
          while ((nl = textBuffer.indexOf("\n")) !== -1) {
            let line = textBuffer.slice(0, nl);
            textBuffer = textBuffer.slice(nl + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6).trim();
            if (json === "[DONE]") {
              done = true;
              break;
            }
            try {
              const parsed = JSON.parse(json);
              const delta: string | undefined = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                if (firstToken) {
                  firstToken = false;
                  setOrbState("speaking");
                }
                assistantText += delta;
                ttsBufferRef.current += delta;
                flushBufferedSentences();
                setMessages((m) => {
                  const copy = [...m];
                  copy[copy.length - 1] = { role: "assistant", content: assistantText };
                  return copy;
                });
              }
            } catch {
              textBuffer = line + "\n" + textBuffer;
              break;
            }
          }
        }

        // Flush remainder
        if (ttsBufferRef.current.trim()) {
          speakChunk(ttsBufferRef.current.trim(), ttsLangRef.current);
          ttsBufferRef.current = "";
        }

        // Wait for TTS to actually finish before returning to idle
        const checkIdle = () => {
          if (capabilities.synthesis && window.speechSynthesis.speaking) {
            setTimeout(checkIdle, 250);
          } else {
            setOrbState("idle");
          }
        };
        checkIdle();
      } catch (err: any) {
        if (err?.name === "AbortError") {
          setOrbState("idle");
          return;
        }
        console.error("Chat stream error:", err);
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
    [capabilities.synthesis, flushBufferedSentences, speakChunk],
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
  const startListening = useCallback(() => {
    if (!capabilities.recognition) return;

    // If currently speaking/thinking → interrupt
    if (orbState === "speaking" || orbState === "thinking") {
      stopAll();
      return;
    }

    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-IN"; // we'll re-detect once we have full text
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
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
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
      setOrbState("idle");
    }
  }, [capabilities.recognition, orbState, sendText, stopAll]);

  // Pause when tab hidden
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) stopAll();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [stopAll]);

  return {
    messages,
    orbState,
    interim,
    capabilities,
    micBlocked,
    startListening,
    stopAll,
    sendText,
  };
}
