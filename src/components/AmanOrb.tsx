import { motion } from "framer-motion";
import { Mic, MicOff, Loader2, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type OrbState = "idle" | "listening" | "thinking" | "speaking" | "error";

interface AmanOrbProps {
  state: OrbState;
  onTap?: () => void;
  size?: number;
  className?: string;
  /** 0–1 microphone input level (only used while listening) */
  audioLevel?: number;
}

const labels: Record<OrbState, string> = {
  idle: "Tap to talk",
  listening: "Listening… tap to stop",
  thinking: "Thinking…",
  speaking: "Speaking… tap to interrupt",
  error: "Tap to retry",
};

export function AmanOrb({
  state,
  onTap,
  size = 240,
  className,
  audioLevel = 0,
}: AmanOrbProps) {
  const isActive = state !== "idle";
  // Reactive scale tied to mic loudness while listening.
  const liveScale = state === "listening" ? 1 + Math.min(0.18, audioLevel * 0.4) : 1;

  const Icon =
    state === "listening"
      ? Mic
      : state === "thinking"
        ? Loader2
        : state === "speaking"
          ? Volume2
          : state === "error"
            ? MicOff
            : Mic;

  return (
    <div
      className={cn("relative flex flex-col items-center justify-center gap-6", className)}
      style={{ width: size, height: size + 76 }}
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
                scale: [1, 1.6 + (state === "listening" ? audioLevel * 0.3 : 0)],
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

      {/* Live audio-level ring while listening */}
      {state === "listening" && (
        <motion.div
          className="pointer-events-none absolute rounded-full"
          style={{
            width: size,
            height: size,
            top: 0,
            border: "2px solid oklch(0.78 0.18 210)",
            boxShadow: `0 0 ${20 + audioLevel * 60}px oklch(0.78 0.18 210 / ${0.4 + audioLevel * 0.5})`,
          }}
          animate={{ scale: liveScale }}
          transition={{ type: "spring", stiffness: 220, damping: 18 }}
        />
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

      {/* REC badge while listening */}
      {state === "listening" && (
        <motion.div
          className="pointer-events-none absolute z-10 flex items-center gap-1.5 rounded-full bg-destructive px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-destructive-foreground shadow-lg"
          style={{ top: -8, left: "50%", x: "-50%" }}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <motion.span
            className="h-1.5 w-1.5 rounded-full bg-destructive-foreground"
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
          REC
        </motion.div>
      )}

      {/* Core orb */}
      <motion.button
        type="button"
        onClick={onTap}
        aria-label={labels[state]}
        aria-pressed={state === "listening"}
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
                ? { scale: liveScale }
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
                ? { type: "spring", stiffness: 220, damping: 18 }
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
            isActive ? { opacity: [0.4, 0.8, 0.4] } : { opacity: [0.3, 0.5, 0.3] }
          }
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Center icon — clear visual affordance */}
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon
            className={cn(
              "h-10 w-10 text-primary-foreground drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]",
              state === "thinking" && "animate-spin",
            )}
            strokeWidth={2.25}
          />
        </div>
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
