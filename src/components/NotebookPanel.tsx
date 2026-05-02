import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, StickyNote, Plus, Pencil, Trash2, Search, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type Note = {
  id: string;
  text: string;
  category: string;
  created_at: string;
};

const CATEGORIES = ["Idea", "To-Do", "Important", "Random", "Shopping", "Other"] as const;

const CATEGORY_COLORS: Record<string, string> = {
  Idea: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  "To-Do": "bg-blue-500/15 text-blue-300 border-blue-500/30",
  Important: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  Random: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  Shopping: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  Other: "bg-muted text-muted-foreground border-border",
};

export function NotebookPanel({ refreshKey }: { refreshKey?: number }) {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [tick, setTick] = useState(0);

  // composer
  const [newText, setNewText] = useState("");
  const [newCat, setNewCat] = useState<string>("Idea");
  const [saving, setSaving] = useState(false);

  // edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editCat, setEditCat] = useState<string>("Other");

  // search/filter
  const [query, setQuery] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("notes")
        .select("id, text, category, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (active) setNotes(data ?? []);
    })();
    return () => {
      active = false;
    };
  }, [refreshKey, tick]);

  const filtered = useMemo(() => {
    if (!notes) return null;
    const q = query.trim().toLowerCase();
    return notes.filter((n) => {
      if (filterCat !== "all" && n.category !== filterCat) return false;
      if (q && !n.text.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [notes, query, filterCat]);

  const addNote = async () => {
    const text = newText.trim();
    if (!text) return;
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not signed in");
      setSaving(false);
      return;
    }
    const { error } = await supabase
      .from("notes")
      .insert({ user_id: user.id, text, category: newCat });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Saved to ${newCat}`);
    setNewText("");
    setTick((t) => t + 1);
  };

  const startEdit = (n: Note) => {
    setEditingId(n.id);
    setEditText(n.text);
    setEditCat(n.category);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const { error } = await supabase
      .from("notes")
      .update({ text: editText.trim(), category: editCat })
      .eq("id", editingId);
    if (error) return toast.error(error.message);
    toast.success("Note updated");
    setEditingId(null);
    setTick((t) => t + 1);
  };

  const deleteNote = async (id: string) => {
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Note deleted");
    setTick((t) => t + 1);
  };

  return (
    <div className="space-y-3">
      {/* Composer */}
      <div className="glass space-y-2 rounded-xl border border-border/40 p-3">
        <Input
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="Type a note… e.g. 'Buy milk' or 'Solar charger idea'"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void addNote();
            }
          }}
        />
        <div className="flex gap-2">
          <Select value={newCat} onValueChange={setNewCat}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => void addNote()}
            disabled={!newText.trim() || saving}
            className="flex-1 gap-2"
          >
            <Plus className="h-4 w-4" /> Save note
          </Button>
        </div>
      </div>

      {/* Search + filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes…"
            className="pl-8"
          />
        </div>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {filtered === null ? (
        <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading notes…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border/50 bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          <StickyNote className="mx-auto mb-2 h-6 w-6 opacity-60" />
          {notes && notes.length > 0
            ? "No notes match your search."
            : "No notes yet. Type above or say 'Aman, save this idea — …'"}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((n) => (
            <li
              key={n.id}
              className="glass rounded-xl border border-border/40 px-4 py-3"
            >
              {editingId === n.id ? (
                <div className="space-y-2">
                  <Input
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Select value={editCat} onValueChange={setEditCat}>
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      onClick={() => void saveEdit()}
                      className="gap-1"
                    >
                      <Check className="h-4 w-4" /> Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                      className="gap-1"
                    >
                      <X className="h-4 w-4" /> Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                        CATEGORY_COLORS[n.category] ?? CATEGORY_COLORS.Other
                      }`}
                    >
                      {n.category}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(n.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <p className="flex-1 text-sm leading-relaxed text-foreground">
                      {n.text}
                    </p>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => startEdit(n)}
                        aria-label="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => void deleteNote(n.id)}
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
