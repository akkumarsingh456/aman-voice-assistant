import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type OrbState = "idle" | "listening" | "thinking" | "speaking" | "error";

interface AmanOrbProps {
  state: OrbState;
  onTap?: () => void;
  size?: number;
  className?: string;
}

const labels: Record<OrbState, string> = {
  idle: "Tap to talk",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking…",
  error: "Tap to retry",
};

export function AmanOrb({ state, onTap, size = 240, className }: AmanOrbProps) {
  const isActive = state !== "idle";

  return (
    <div
      className={cn("relative flex flex-col items-center justify-center gap-6", className)}
      style={{ width: size, height: size + 60 }}
    >
      {/* Outer ripples — visible when listening or speaking */}
      {(state === "listening" || state === "speaking") && (
        <>
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="pointer-events-none absolute rounded-full"
              style={{
                width: size,
                height: size,
                top: 0,
                border: `1px solid ${
                  state === "listening"
                    ? "oklch(0.78 0.16 210 / 0.5)"
                    : "oklch(0.65 0.22 290 / 0.5)"
                }`,
              }}
              animate={{
                scale: [1, 1.6],
                opacity: [0.6, 0],
              }}
              transition={{
                duration: 2.4,
                repeat: Infinity,
                delay: i * 0.8,
                ease: "easeOut",
              }}
            />
          ))}
        </>
      )}

      {/* Error red pulse */}
      {state === "error" && (
        <motion.div
          className="pointer-events-none absolute rounded-full"
          style={{
            width: size,
            height: size,
            top: 0,
            border: "2px solid oklch(0.65 0.24 25 / 0.6)",
          }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.8, 0.3, 0.8] }}
          transition={{ duration: 1.4, repeat: Infinity }}
        />
      )}

      {/* Core orb */}
      <motion.button
        type="button"
        onClick={onTap}
        aria-label={labels[state]}
        className="relative cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/40"
        style={{
          width: size,
          height: size,
          background: "var(--gradient-orb)",
          boxShadow: "var(--shadow-orb)",
        }}
        animate={
          state === "thinking"
            ? { scale: [1, 1.04, 1], rotate: [0, 360] }
            : state === "speaking"
            ? { scale: [1, 1.06, 1] }
            : state === "listening"
            ? { scale: [1, 1.03, 1] }
            : { scale: 1 }
        }
        transition={
          state === "thinking"
            ? {
                scale: { duration: 2, repeat: Infinity, ease: "easeInOut" },
                rotate: { duration: 12, repeat: Infinity, ease: "linear" },
              }
            : state === "speaking"
            ? { duration: 0.5, repeat: Infinity, ease: "easeInOut" }
            : state === "listening"
            ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.4 }
        }
        whileTap={{ scale: 0.95 }}
      >
        {/* Inner shimmer */}
        <motion.div
          className="absolute inset-4 rounded-full"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, oklch(1 0 0 / 0.4) 0%, transparent 60%)",
          }}
          animate={
            isActive
              ? { opacity: [0.4, 0.8, 0.4] }
              : { opacity: [0.3, 0.5, 0.3] }
          }
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Center dot — heartbeat */}
        <motion.div
          className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-foreground/80"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      </motion.button>

      <p
        className={cn(
          "text-sm font-medium tracking-wide transition-colors",
          state === "error" ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {labels[state]}
      </p>
    </div>
  );
}
