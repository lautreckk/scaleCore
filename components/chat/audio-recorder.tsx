"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAudioRecorder, formatRecordingTime } from "@/hooks/use-audio-recorder";
import { toast } from "sonner";
import {
  Mic,
  Square,
  Play,
  Pause,
  Send,
  Trash2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AudioRecorderProps {
  onSend: (audioBlob: Blob) => Promise<void>;
  disabled?: boolean;
}

export function AudioRecorder({ onSend, disabled }: AudioRecorderProps) {
  const [showRecorder, setShowRecorder] = useState(false);
  const [sending, setSending] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const {
    isRecording,
    isPaused,
    recordingTime,
    audioBlob,
    audioUrl,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
    error,
  } = useAudioRecorder();

  const handleStartRecording = async () => {
    setShowRecorder(true);
    await startRecording();
  };

  const handleStopRecording = () => {
    stopRecording();
  };

  const handleSend = async () => {
    if (!audioBlob) return;

    setSending(true);
    try {
      await onSend(audioBlob);
      handleCancel();
      toast.success("Audio enviado!");
    } catch (error) {
      toast.error("Erro ao enviar audio");
    } finally {
      setSending(false);
    }
  };

  const handleCancel = () => {
    resetRecording();
    setShowRecorder(false);
    setIsPlaying(false);
  };

  const handlePlayPause = () => {
    if (!audioUrl) return;

    const audio = document.getElementById("audio-preview") as HTMLAudioElement;
    if (audio) {
      if (isPlaying) {
        audio.pause();
      } else {
        audio.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Show error toast
  if (error) {
    toast.error(error);
  }

  // Simple mic button when not recording
  if (!showRecorder) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={handleStartRecording}
        disabled={disabled}
        title="Gravar audio"
      >
        <Mic className="h-5 w-5" />
      </Button>
    );
  }

  // Recording UI
  return (
    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
      {audioBlob ? (
        // Preview mode
        <>
          <audio
            id="audio-preview"
            src={audioUrl || undefined}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePlayPause}
            title={isPlaying ? "Pausar" : "Reproduzir"}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
          <div className="flex-1">
            <div className="h-1 bg-primary/30 rounded-full">
              <div className="h-1 bg-primary rounded-full w-full" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatRecordingTime(recordingTime)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCancel}
            title="Cancelar"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
          <Button
            size="icon"
            onClick={handleSend}
            disabled={sending}
            title="Enviar"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </>
      ) : (
        // Recording mode
        <>
          <div
            className={cn(
              "h-3 w-3 rounded-full",
              isRecording && !isPaused ? "bg-red-500 animate-pulse" : "bg-red-500/50"
            )}
          />
          <span className="text-sm font-medium text-white min-w-[40px]">
            {formatRecordingTime(recordingTime)}
          </span>
          <div className="flex-1">
            <div className="flex items-center gap-0.5 h-4">
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-1 rounded-full transition-all",
                    isRecording && !isPaused
                      ? "bg-primary animate-pulse"
                      : "bg-primary/30"
                  )}
                  style={{
                    height: isRecording && !isPaused
                      ? `${Math.random() * 100}%`
                      : "20%",
                    animationDelay: `${i * 50}ms`,
                  }}
                />
              ))}
            </div>
          </div>
          {isPaused ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={resumeRecording}
              title="Continuar"
            >
              <Play className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={pauseRecording}
              title="Pausar"
            >
              <Pause className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCancel}
            title="Cancelar"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
          <Button
            size="icon"
            onClick={handleStopRecording}
            title="Parar e revisar"
          >
            <Square className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  );
}
