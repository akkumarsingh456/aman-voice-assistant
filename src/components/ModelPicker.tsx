import { useEffect, useState } from "react";
import { Check, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MODELS, getStoredModel, setStoredModel, getModelLabel, type ModelId } from "@/lib/aiModels";
import { cn } from "@/lib/utils";

interface Props {
  onChange?: (id: ModelId) => void;
}

export function ModelPicker({ onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [model, setModel] = useState<ModelId>("google/gemini-3-flash-preview");

  useEffect(() => {
    setModel(getStoredModel());
  }, []);

  const pick = (id: ModelId) => {
    setModel(id);
    setStoredModel(id);
    onChange?.(id);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="glass h-7 gap-1.5 rounded-full border border-border/50 px-3 text-xs"
        >
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          {getModelLabel(model)}
        </Button>
      </DialogTrigger>
      <DialogContent className="glass max-w-md border-border/50">
        <DialogHeader>
          <DialogTitle className="text-center">Choose AI model</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 pt-2">
          {MODELS.map((m) => {
            const active = m.id === model;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => pick(m.id)}
                className={cn(
                  "flex flex-col items-start gap-0.5 rounded-xl border p-3 text-left transition",
                  "hover:border-primary/60 hover:bg-primary/5",
                  active
                    ? "border-primary/70 bg-primary/10"
                    : "border-border/50 bg-card/40",
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-sm font-semibold">{m.label}</span>
                  {active && <Check className="h-4 w-4 text-primary" />}
                </div>
                <span className="text-[11px] text-muted-foreground">{m.hint}</span>
                {m.badge && (
                  <span className="mt-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                    {m.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="pt-2 text-center text-[11px] text-muted-foreground">
          All models powered by Lovable AI — no API key needed.
        </p>
      </DialogContent>
    </Dialog>
  );
}
