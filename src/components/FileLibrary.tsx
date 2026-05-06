import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Library, Trash2, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  listLibrary,
  deleteFromLibrary,
  importFromLibrary,
  type LibraryFile,
} from "@/lib/fileLibrary";
import type { ChatAttachment } from "@/lib/readFiles";

function fmtSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileLibrary({
  onImport,
}: {
  onImport: (att: ChatAttachment) => void;
}) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<LibraryFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      setFiles(await listLibrary());
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't load library");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) void refresh();
  }, [open]);

  async function handleImport(f: LibraryFile) {
    setBusy(f.id);
    try {
      const att = await importFromLibrary(f);
      onImport(att);
      toast.success(`Attached "${f.name}"`);
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Import failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete(f: LibraryFile) {
    setBusy(f.id);
    try {
      await deleteFromLibrary(f);
      setFiles((xs) => xs.filter((x) => x.id !== f.id));
    } catch (e: any) {
      toast.error(e?.message ?? "Delete failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="glass h-10 w-10 shrink-0 border border-border/50"
          title="Your saved files"
        >
          <Library className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="glass max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Library className="h-4 w-4" /> Your file library
          </DialogTitle>
          <DialogDescription>
            Saved attachments — only you can see or use these. Re-attach without re-uploading.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : files.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No files yet. Attach something in chat, then tap the bookmark icon to save it here.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {files.map((f) => (
                <li
                  key={f.id}
                  className="glass flex items-center gap-3 rounded-xl border border-border/40 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{f.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {f.mime_type} · {fmtSize(f.size_bytes)} ·{" "}
                      {new Date(f.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 gap-1.5"
                    disabled={busy === f.id}
                    onClick={() => void handleImport(f)}
                  >
                    <Plus className="h-3.5 w-3.5" /> Attach
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    disabled={busy === f.id}
                    onClick={() => void handleDelete(f)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
