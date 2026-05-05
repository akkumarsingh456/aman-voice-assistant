import { useEffect, useState } from "react";
import { KeyRound, Eye, EyeOff, Trash2, Check, Loader2, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  getOpenAIKey,
  setOpenAIKey,
  getDeepSeekKey,
  setDeepSeekKey,
} from "@/lib/aiModels";

type TestState = "idle" | "testing" | "ok" | "fail";

const TS_KEY = "aman:byok:test-timestamps";
type StoredTs = { oaAt?: number; oaOk?: boolean; dsAt?: number; dsOk?: boolean };

function loadTs(): StoredTs {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(window.localStorage.getItem(TS_KEY) ?? "{}"); } catch { return {}; }
}
function saveTs(v: StoredTs) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TS_KEY, JSON.stringify(v));
}
function fmtTs(ms?: number): string {
  if (!ms) return "";
  const diff = Date.now() - ms;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(ms).toLocaleString();
}

export function KeyVault() {
  const [open, setOpen] = useState(false);
  const [openai, setOpenai] = useState("");
  const [deepseek, setDeepseek] = useState("");
  const [showOA, setShowOA] = useState(false);
  const [showDS, setShowDS] = useState(false);
  const [testing, setTesting] = useState(false);
  const [oaState, setOaState] = useState<TestState>("idle");
  const [dsState, setDsState] = useState<TestState>("idle");
  const [ts, setTs] = useState<StoredTs>({});

  // Calls our server-side proxy so the raw key never goes to a third-party
  // origin from the browser (no CORS, no key in browser network logs to other domains).
  const testKey = async (
    provider: "openai" | "deepseek",
    key: string,
  ): Promise<{ ok: boolean; msg: string }> => {
    if (!key) return { ok: false, msg: "empty" };
    try {
      const r = await fetch("/api/test-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, key }),
      });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; msg?: string };
      return { ok: !!j.ok, msg: j.msg ?? `HTTP ${r.status}` };
    } catch (err) {
      return { ok: false, msg: err instanceof Error ? err.message : "network error" };
    }
  };

  const runTests = async () => {
    setTesting(true);
    setOaState("idle");
    setDsState("idle");
    const oa = openai.trim();
    const ds = deepseek.trim();
    const next: StoredTs = { ...ts };

    const tasks: Promise<void>[] = [];
    if (oa) {
      setOaState("testing");
      tasks.push(
        testKey("openai", oa).then((r) => {
          setOaState(r.ok ? "ok" : "fail");
          next.oaAt = Date.now();
          next.oaOk = r.ok;
          if (r.ok) toast.success("OpenAI key works ✓");
          else toast.error(`OpenAI: ${r.msg}`);
        }),
      );
    }
    if (ds) {
      setDsState("testing");
      tasks.push(
        testKey("deepseek", ds).then((r) => {
          setDsState(r.ok ? "ok" : "fail");
          next.dsAt = Date.now();
          next.dsOk = r.ok;
          if (r.ok) toast.success("DeepSeek key works ✓");
          else toast.error(`DeepSeek: ${r.msg}`);
        }),
      );
    }
    if (tasks.length === 0) toast.message("Paste a key first");
    await Promise.all(tasks);
    setTs(next);
    saveTs(next);
    setTesting(false);
  };

  useEffect(() => {
    if (open) {
      setOpenai(getOpenAIKey());
      setDeepseek(getDeepSeekKey());
      setTs(loadTs());
    }
  }, [open]);

  const save = () => {
    const oa = openai.trim();
    const ds = deepseek.trim();
    if (oa && !oa.startsWith("sk-")) {
      toast.error("OpenAI keys start with 'sk-'");
      return;
    }
    if (ds && !ds.startsWith("sk-")) {
      toast.error("DeepSeek keys start with 'sk-'");
      return;
    }
    setOpenAIKey(oa);
    setDeepSeekKey(ds);
    toast.success("Keys saved to this browser only");
    setOpen(false);
  };

  const clearOA = () => { setOpenai(""); setOpenAIKey(""); toast.success("OpenAI key removed"); };
  const clearDS = () => { setDeepseek(""); setDeepSeekKey(""); toast.success("DeepSeek key removed"); };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="glass h-7 w-7 rounded-full border border-border/50 p-0"
          title="Manage AI keys"
        >
          <KeyRound className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="glass max-w-md border-border/50">
        <DialogHeader>
          <DialogTitle>Your AI keys</DialogTitle>
          <DialogDescription className="text-xs">
            Stored only in this browser (localStorage). Used when you pick a BYOK model.
            Never sent to chat history. Revoke leaked keys at the provider's dashboard.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="oa-key" className="text-xs">OpenAI API key</Label>
              <StatusBadge state={oaState} at={ts.oaAt} ok={ts.oaOk} />
            </div>
            <div className="flex gap-1.5">
              <div className="relative flex-1">
                <Input
                  id="oa-key"
                  type={showOA ? "text" : "password"}
                  placeholder="sk-proj-..."
                  value={openai}
                  onChange={(e) => { setOpenai(e.target.value); setOaState("idle"); }}
                  autoComplete="off"
                  spellCheck={false}
                  className="pr-9 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowOA((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                  aria-label="Toggle visibility"
                >
                  {showOA ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button type="button" size="icon" variant="ghost" onClick={clearOA} title="Remove">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">platform.openai.com/api-keys</p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="ds-key" className="text-xs">DeepSeek API key</Label>
              <StatusBadge state={dsState} at={ts.dsAt} ok={ts.dsOk} />
            </div>
            <div className="flex gap-1.5">
              <div className="relative flex-1">
                <Input
                  id="ds-key"
                  type={showDS ? "text" : "password"}
                  placeholder="sk-..."
                  value={deepseek}
                  onChange={(e) => { setDeepseek(e.target.value); setDsState("idle"); }}
                  autoComplete="off"
                  spellCheck={false}
                  className="pr-9 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowDS((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                  aria-label="Toggle visibility"
                >
                  {showDS ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button type="button" size="icon" variant="ghost" onClick={clearDS} title="Remove">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">platform.deepseek.com/api_keys</p>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={runTests}
              disabled={testing}
              className="flex-1 gap-2"
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Test keys
            </Button>
            <Button onClick={save} className="flex-1 gap-2">
              <Check className="h-4 w-4" /> Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatusBadge({ state }: { state: TestState }) {
  if (state === "idle") return null;
  if (state === "testing")
    return (
      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> testing…
      </span>
    );
  if (state === "ok")
    return (
      <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-500">
        <Check className="h-3 w-3" /> valid
      </span>
    );
  return (
    <span className="text-[10px] font-medium text-destructive">✕ invalid</span>
  );
}
