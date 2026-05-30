"use client";

import { useState, useRef } from "react";
import { Mic, Square, Trash2, Play, Pause, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface Props {
  jobId: string;
  existingKey?: string | null;
  onRecorded?: (key: string) => void;
  onDeleted?: () => void;
}

export function VoiceRecorder({ jobId, existingKey, onRecorded, onDeleted }: Props) {
  const [state, setState] = useState<"idle" | "recording" | "uploading" | "done">(
    existingKey ? "done" : "idle"
  );
  const [recordingKey, setRecordingKey] = useState(existingKey ?? null);
  const [secs, setSecs] = useState(0);
  const [error, setError] = useState("");
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);

  const start = async () => {
    setError("");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
    if (!stream) { setError("Microphone access denied."); return; }

    const mr = new MediaRecorder(stream);
    chunks.current = [];
    mr.ondataavailable = (e) => chunks.current.push(e.data);
    mr.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks.current, { type: "audio/webm" });
      setState("uploading");
      try {
        const urlRes = await fetch(`/api/jobs/${jobId}/voice`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mimeType: "audio/webm" }),
        });
        if (!urlRes.ok) throw new Error("Failed to get upload URL");
        const { uploadUrl, voiceNoteKey } = await urlRes.json();
        await fetch(uploadUrl, { method: "PUT", body: blob, headers: { "Content-Type": "audio/webm" } });
        setRecordingKey(voiceNoteKey);
        setState("done");
        onRecorded?.(voiceNoteKey);
      } catch {
        setError("Upload failed. Try again.");
        setState("idle");
      }
    };
    mr.start();
    mediaRecorder.current = mr;
    setState("recording");
    setSecs(0);
    timer.current = setInterval(() => setSecs((s) => s + 1), 1000);
  };

  const stop = () => {
    clearInterval(timer.current);
    mediaRecorder.current?.stop();
  };

  const deleteNote = async () => {
    await fetch(`/api/jobs/${jobId}/voice`, { method: "DELETE" });
    setRecordingKey(null);
    setState("idle");
    setSecs(0);
    onDeleted?.();
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-700">Voice Note</p>

      {state === "idle" && (
        <button
          onClick={start}
          className="flex items-center gap-3 w-full h-16 px-5 bg-red-50 border-2 border-dashed border-red-300 rounded-xl text-red-600 font-medium hover:bg-red-100 transition-colors"
        >
          <Mic className="w-7 h-7" />
          Tap to record a voice note
        </button>
      )}

      {state === "recording" && (
        <button
          onClick={stop}
          className="flex items-center gap-3 w-full h-16 px-5 bg-red-600 rounded-xl text-white font-medium"
        >
          <div className="w-7 h-7 relative flex items-center justify-center">
            <span className="absolute w-7 h-7 bg-red-400 rounded-full animate-ping opacity-75" />
            <Mic className="w-5 h-5 relative" />
          </div>
          <span className="flex-1 text-left">Recording... {fmt(secs)}</span>
          <Square className="w-5 h-5" />
        </button>
      )}

      {state === "uploading" && (
        <div className="flex items-center gap-3 h-16 px-5 bg-slate-100 rounded-xl text-slate-600">
          <Loader2 className="w-6 h-6 animate-spin" />
          Uploading voice note...
        </div>
      )}

      {state === "done" && (
        <div className="flex items-center gap-3 h-16 px-5 bg-green-50 border border-green-200 rounded-xl">
          <Mic className="w-6 h-6 text-green-600" />
          <span className="flex-1 text-sm text-green-800 font-medium">Voice note saved</span>
          <button onClick={deleteNote} className="text-red-400 hover:text-red-600 p-1">
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
