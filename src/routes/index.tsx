import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AmanOrb } from "@/components/AmanOrb";
import { useVoiceConversation } from "@/hooks/useVoiceConversation";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, MicOff, LogOut, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Aman — Your Bilingual Voice Assistant" },
      {
        name: "description",
        content:
          "Aman is a friendly Hindi + English voice AI assistant. Tap, speak, and Aman replies — fast, witty, helpful.",
      },
      { property: "og:title", content: "Aman — Voice AI Assistant" },
      {
        property: "og:description",
        content: "Bilingual voice-first AI you can talk to in Hindi or English.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { messages, orbState, interim, capabilities, micBlocked, startListening, sendText } =
    useVoiceConversation();
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastSavedCountRef = useRef(0);

  // Redirect to /auth if not signed in
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  // Create a conversation on first message
  useEffect(() => {
    if (!user || conversationId || messages.length === 0) return;
    (async () => {
      const firstUserMsg = messages.find((m) => m.role === "user");
      const title = firstUserMsg ? firstUserMsg.content.slice(0, 60) : "New chat";
      const { data, error } = await supabase
        .from("conversations")
        .insert({ user_id: user.id, title })
        .select("id")
        .single();
      if (!error && data) setConversationId(data.id);
    })();
  }, [user, conversationId, messages]);

  // Persist new messages
  useEffect(() => {
    if (!user || !conversationId) return;
    const stable = messages.filter((m) => m.content.trim().length > 0);
    if (stable.length <= lastSavedCountRef.current) return;
    const newOnes = stable.slice(lastSavedCountRef.current);
    lastSavedCountRef.current = stable.length;
    if (newOnes.length === 0) return;
    void supabase.from("messages").insert(
      newOnes.map((m) => ({
        conversation_id: conversationId,
        user_id: user.id,
        role: m.role,
        content: m.content,
      })),
    );
  }, [messages, user, conversationId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, interim]);

  const handleSend = () => {
    const t = input.trim();
    if (!t) return;
    setInput("");
    void sendText(t);
  };

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </main>
    );
  }

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    user.email?.split("@")[0] ||
    "you";

  return (
    <main className="relative flex min-h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-primary shadow-[0_0_12px_var(--primary-glow)]" />
          <h1 className="font-display text-lg font-semibold tracking-tight">Aman</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Hi, {displayName}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await signOut();
              navigate({ to: "/auth" });
            }}
          >
            <LogOut className="mr-1.5 h-3.5 w-3.5" />
            Sign out
          </Button>
        </div>
      </header>

      {/* Conversation panel */}
      <section
        ref={scrollRef}
        className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-4 pb-6"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center pt-12 text-center">
            <h2 className="font-display text-3xl font-semibold sm:text-4xl">
              Namaste, I'm <span className="text-gradient-aurora">Aman</span>
            </h2>
            <p className="mt-3 max-w-md text-sm text-muted-foreground sm:text-base">
              Tap the orb and talk to me in Hindi, English, or both. I'll match
              your language.
            </p>
          </div>
        )}

        <div className="space-y-3 pt-6">
          <AnimatePresence initial={false}>
            {messages.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "glass text-foreground"
                  }`}
                >
                  {m.content || (
                    <span className="inline-flex gap-1">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-current opacity-60" />
                      <span className="h-2 w-2 animate-pulse rounded-full bg-current opacity-60 [animation-delay:120ms]" />
                      <span className="h-2 w-2 animate-pulse rounded-full bg-current opacity-60 [animation-delay:240ms]" />
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {interim && (
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm italic text-muted-foreground">
                {interim}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Orb + composer */}
      <section className="sticky bottom-0 mx-auto w-full max-w-2xl px-4 pb-6 pt-2">
        <div className="flex flex-col items-center gap-4">
          {capabilities.recognition ? (
            <AmanOrb state={micBlocked ? "error" : orbState} onTap={startListening} size={180} />
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-border glass px-5 py-4 text-center">
              <MicOff className="h-6 w-6 text-muted-foreground" />
              <p className="max-w-xs text-xs text-muted-foreground">
                Voice isn't supported in this browser. You can still chat by typing.
                Try Chrome or Edge for the full voice experience.
              </p>
            </div>
          )}

          {micBlocked && (
            <p className="text-xs text-destructive">
              Microphone access denied. Enable it in your browser settings, then
              refresh.
            </p>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex w-full items-center gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Or type your message…"
              className="glass border-border/50 text-foreground placeholder:text-muted-foreground"
              maxLength={2000}
            />
            <Button
              type="submit"
              size="icon"
              variant="default"
              disabled={!input.trim() || orbState === "thinking"}
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </section>
    </main>
  );
}
