import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AmanOrb } from "@/components/AmanOrb";
import { TestMicButton } from "@/components/TestMicButton";
import { useVoiceConversation } from "@/hooks/useVoiceConversation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogOut, Send, Mic, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: "Aman — Your bilingual voice AI assistant" },
      {
        name: "description",
        content:
          "Talk to Aman, a friendly Hindi + English voice assistant. Tap the orb and start a conversation.",
      },
    ],
  }),
});

function HomePage() {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const {
    messages,
    orbState,
    interim,
    capabilities,
    micBlocked,
    micPermission,
    audioLevel,
    startListening,
    sendText,
    requestMicPermission,
  } = useVoiceConversation();

  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) {
      void navigate({ to: "/auth" });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, interim]);

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </main>
    );
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText("");
    await sendText(t);
  };

  return (
    <main className="relative flex min-h-screen flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <div
            className="h-8 w-8 rounded-full"
            style={{ background: "var(--gradient-orb)" }}
          />
          <h1 className="text-lg font-semibold tracking-tight">Aman</h1>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void signOut()}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </header>

      {/* Conversation area */}
      <div
        ref={scrollRef}
        className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-4 pb-4"
      >
        {messages.length === 0 ? (
          <div className="mt-10 text-center">
            <h2 className="text-2xl font-semibold text-gradient-aurora">
              Hi {user.user_metadata?.full_name?.split(" ")[0] ?? "there"} 👋
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Tap the orb and speak — English, Hindi, or Hinglish.
            </p>
          </div>
        ) : (
          <div className="space-y-3 pt-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${
                  m.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`glass max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-primary/15 text-foreground"
                      : "text-foreground"
                  }`}
                >
                  {m.content || (
                    <span className="text-muted-foreground italic">…</span>
                  )}
                </div>
              </div>
            ))}
            {interim && (
              <div className="flex justify-end">
                <div className="glass max-w-[85%] rounded-2xl px-4 py-2.5 text-sm italic text-muted-foreground">
                  {interim}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Orb + controls */}
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-3 px-4 pb-6">
        {!capabilities.recognition && (
          <div className="glass w-full rounded-xl px-4 py-3 text-center text-xs text-muted-foreground">
            Voice input isn't supported in this browser. Try Chrome on desktop or Android — you can still type below.
          </div>
        )}

        {capabilities.recognition && micBlocked && (
          <div className="glass w-full rounded-xl border border-destructive/30 px-4 py-3 text-xs text-foreground">
            <div className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div>
                <p className="font-medium text-destructive">
                  Microphone access blocked
                </p>
                <p className="mt-1 text-muted-foreground">
                  Click the lock icon in your browser address bar → Site settings → set Microphone to "Allow", then reload this page.
                </p>
              </div>
            </div>
          </div>
        )}

        {capabilities.recognition &&
          !micBlocked &&
          micPermission !== "granted" && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void requestMicPermission()}
              className="gap-2 rounded-full"
            >
              <Mic className="h-4 w-4" />
              Enable microphone
            </Button>
          )}

        <AmanOrb
          state={orbState}
          onTap={startListening}
          audioLevel={audioLevel}
        />

        {capabilities.recognition &&
          !micBlocked &&
          micPermission === "granted" &&
          orbState === "idle" && <TestMicButton />}

        <form onSubmit={handleSend} className="mt-2 flex w-full gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message…"
            className="glass border-border/50"
          />
          <Button type="submit" size="icon" disabled={!text.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </main>
  );
}
