import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, CheckCircle, AlertCircle } from "lucide-react";

export function TestMicButton({ onComplete }: { onComplete?: (success: boolean) => void }) {
  const [testing, setTesting] = useState(false);
  const [level, setLevel] = useState(0);
  const [result, setResult] = useState<"success" | "fail" | null>(null);

  const testMic = async () => {
    setTesting(true);
    setResult(null);
    setLevel(0);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let maxLevel = 0;
      
      const interval = setInterval(() => {
        analyser.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const v = (dataArray[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        const currentLevel = Math.min(1, rms * 4);
        setLevel(currentLevel);
        if (currentLevel > maxLevel) maxLevel = currentLevel;
      }, 50);

      // Record/test for 2 seconds
      setTimeout(() => {
        clearInterval(interval);
        stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
        audioCtx.close();
        setTesting(false);
        
        const success = maxLevel > 0.02; // A lower threshold works better across different mics
        setResult(success ? "success" : "fail");
        if (onComplete) onComplete(success);
      }, 2000);

    } catch (err) {
      console.error("Test mic failed:", err);
      setTesting(false);
      setResult("fail");
      if (onComplete) onComplete(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2 mt-2">
      <Button 
        variant="secondary" 
        size="sm" 
        onClick={testMic} 
        disabled={testing}
        className="gap-2 rounded-full px-4 text-xs h-8"
      >
        <Mic className="h-3.5 w-3.5" />
        {testing ? "Testing..." : "Test Microphone"}
      </Button>
      
      {testing && (
        <div className="w-32 h-1.5 bg-secondary rounded-full overflow-hidden mt-1">
          <div 
            className="h-full bg-primary transition-all duration-75" 
            style={{ width: `${level * 100}%` }} 
          />
        </div>
      )}
      
      {result === "success" && !testing && (
        <span className="text-[11px] text-green-500 flex items-center gap-1 font-medium bg-green-500/10 px-2 py-0.5 rounded-full">
          <CheckCircle className="h-3 w-3" /> Mic working! Ready to talk.
        </span>
      )}
      {result === "fail" && !testing && (
        <span className="text-[11px] text-destructive flex items-center gap-1 font-medium bg-destructive/10 px-2 py-0.5 rounded-full">
          <AlertCircle className="h-3 w-3" /> No audio detected. Check settings.
        </span>
      )}
    </div>
  );
}
