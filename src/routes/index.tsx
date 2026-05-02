import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AmanOrb } from "@/components/AmanOrb";
import { TestMicButton } from "@/components/TestMicButton";
import { NotebookPanel } from "@/components/NotebookPanel";
import { RemindersPanel } from "@/components/RemindersPanel";
import { HistoryPanel } from "@/components/HistoryPanel";
import { TimelinePanel } from "@/components/TimelinePanel";
import { useVoiceConversation } from "@/hooks/useVoiceConversation";
import { useAuth } from "@/hooks/useAuth";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { useReminderAlarm } from "@/hooks/useReminderAlarm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportCsv, exportPdf } from "@/lib/exportData";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  LogOut,
  Send,
  Mic,
  ShieldAlert,
  Download,
  StickyNote,
  BellRing,
  History,
  MessageCircle,
  FileDown,
  Clock,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: "AMAN KUMAR ASSISTANT — your bilingual AI" },
      {
        name: "description",
        content:
          "Tap to talk to Aman in Hindi or English. Save notes, set reminders, and keep your day organized.",
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
  const { canInstall, install } = useInstallPrompt();
  const { ringing, stop: stopAlarm, snooze } = useReminderAlarm();

  const [text, setText] = useState("");
  const [tab, setTab] = useState("chat");
  const [refreshTick, setRefreshTick] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, interim]);

  // Refresh side panels whenever a new assistant reply lands
  // (notes/reminders may have been created via tools).
  useEffect(() => {
    if (orbState === "idle" && messages.length > 0) {
      setRefreshTick((t) => t + 1);
    }
  }, [orbState, messages.length]);

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
        <div className="flex items-center gap-1">
          {canInstall && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void install()}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <Download className="h-4 w-4" />
              Install
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void signOut()}
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl flex-1 px-4">
        <Tabs value={tab} onValueChange={setTab} className="flex h-full flex-col">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="chat" className="gap-1.5">
              <MessageCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Chat</span>
            </TabsTrigger>
            <TabsTrigger value="notes" className="gap-1.5">
              <StickyNote className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Notebook</span>
            </TabsTrigger>
            <TabsTrigger value="reminders" className="gap-1.5">
              <BellRing className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Reminders</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5">
              <History className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">History</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="mt-3 flex-1">
            <div
              ref={scrollRef}
              className="h-[calc(100vh-330px)] overflow-y-auto pb-4"
            >
              {messages.length === 0 ? (
                <div className="mt-8 text-center">
                  <h2 className="text-2xl font-semibold text-gradient-aurora">
                    Hi {user.user_metadata?.full_name?.split(" ")[0] ?? "there"} 👋
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Tap the orb and speak — English, Hindi, or Hinglish.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground/80">
                    Try: "Save this idea — solar phone charger" or "Remind me at 7am tomorrow gym".
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
          </TabsContent>

          <TabsContent value="notes" className="mt-3 flex-1 overflow-y-auto pb-32">
            <NotebookPanel refreshKey={refreshTick} />
          </TabsContent>
          <TabsContent value="reminders" className="mt-3 flex-1 overflow-y-auto pb-32">
            <RemindersPanel refreshKey={refreshTick} />
          </TabsContent>
          <TabsContent value="history" className="mt-3 flex-1 overflow-y-auto pb-32">
            <HistoryPanel refreshKey={refreshTick} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Orb + controls (always visible at bottom) */}
      <div className="sticky bottom-0 mx-auto flex w-full max-w-2xl flex-col items-center gap-3 bg-gradient-to-t from-background via-background/95 to-background/0 px-4 pb-6 pt-4">
        {!capabilities.recognition && (
          <div className="glass w-full rounded-xl px-4 py-3 text-center text-xs text-muted-foreground">
            Voice input isn't supported in this browser. You can still type below.
          </div>
        )}

        {capabilities.recognition && micBlocked && (
          <div className="glass w-full rounded-xl border border-destructive/30 px-4 py-3 text-xs text-foreground">
            <div className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Microphone access blocked</p>
                <p className="mt-1 text-muted-foreground">
                  Open site settings → set Microphone to "Allow", then reload.
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
          size={180}
        />

        {capabilities.recognition &&
          !micBlocked &&
          micPermission === "granted" &&
          orbState === "idle" && <TestMicButton />}

        <form onSubmit={handleSend} className="mt-1 flex w-full gap-2">
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

      {/* Alarm dialog */}
      <Dialog open={!!ringing} onOpenChange={(o) => !o && void stopAlarm()}>
        <DialogContent className="glass border-primary/40">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <BellRing className="h-5 w-5 animate-pulse text-primary" />
              Reminder
            </DialogTitle>
            <DialogDescription className="pt-2 text-base text-foreground">
              {ringing?.text}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 pt-2">
            <Button onClick={() => void snooze(5)} variant="secondary" className="flex-1">
              Snooze 5 min
            </Button>
            <Button onClick={() => void stopAlarm()} className="flex-1">
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
