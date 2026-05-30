"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Loader2, MapPin, Bot, User } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface Message {
  role: "user" | "assistant";
  content: string;
  toolsUsed?: string[];
}

interface Props {
  vehicleId?: string;
  vehicleName?: string;
}

const SUGGESTED_QUESTIONS = [
  "What was done in my last service?",
  "How much have I spent this year?",
  "What maintenance is due soon?",
  "Find a mechanic near me",
];

export function ChatWidget({ vehicleId, vehicleName }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locError, setLocError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const requestLocation = () => {
    if (!navigator.geolocation) { setLocError("GPS not available on this device."); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocError(""); },
      () => setLocError("Location access denied. Enable GPS to find nearby mechanics.")
    );
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    // If asking about nearby mechanics and no location, request it first
    const wantsLocation = /near|location|close|around|find mechanic/i.test(text);
    if (wantsLocation && !location) {
      requestLocation();
      setMessages([...newMessages, {
        role: "assistant",
        content: "I need your location to find nearby mechanics. Please allow GPS access when prompted, then ask again.",
      }]);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/portal/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          vehicleId,
          customerLocation: location ?? undefined,
        }),
      });
      const data = await res.json();
      setMessages([...newMessages, {
        role: "assistant",
        content: data.reply ?? "Sorry, I couldn't get a response.",
        toolsUsed: data.toolsUsed,
      }]);
    } catch {
      setMessages([...newMessages, {
        role: "assistant",
        content: "Connection error. Please try again.",
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-20 right-4 z-50 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all",
          open && "hidden"
        )}
        aria-label="Open chat assistant"
      >
        <MessageCircle className="w-7 h-7" />
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex flex-col bg-white border-t border-slate-200 shadow-2xl"
          style={{ height: "70vh", maxHeight: "600px" }}>

          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-blue-600 text-white flex-shrink-0">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">AutoPass Assistant</p>
              <p className="text-xs text-blue-200 truncate">
                {vehicleName ? `Talking about: ${vehicleName}` : "Ask about your vehicles"}
              </p>
            </div>
            {location ? (
              <div className="flex items-center gap-1 text-xs text-blue-200">
                <MapPin className="w-3 h-3" /> GPS on
              </div>
            ) : (
              <button onClick={requestLocation} className="text-xs text-blue-200 hover:text-white flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Enable GPS
              </button>
            )}
            <button onClick={() => setOpen(false)} className="text-blue-200 hover:text-white ml-2">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="bg-slate-50 rounded-2xl rounded-tl-sm px-4 py-3 max-w-xs">
                    <p className="text-sm text-slate-700">
                      Hi! I'm your AutoPass assistant. I can tell you about your car's service history, costs, upcoming maintenance, and help you find nearby mechanics.
                    </p>
                  </div>
                </div>
                <div className="pl-11 space-y-2">
                  <p className="text-xs text-slate-400">Suggested questions:</p>
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="block w-full text-left text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-xl transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={cn("flex gap-3", msg.role === "user" && "flex-row-reverse")}>
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                  msg.role === "user" ? "bg-slate-200" : "bg-blue-100"
                )}>
                  {msg.role === "user"
                    ? <User className="w-4 h-4 text-slate-600" />
                    : <Bot className="w-4 h-4 text-blue-600" />
                  }
                </div>
                <div className={cn(
                  "rounded-2xl px-4 py-3 max-w-[85%] text-sm",
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-tr-sm"
                    : "bg-slate-50 text-slate-800 rounded-tl-sm"
                )}>
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                    <p className="text-xs text-slate-400 mt-1.5 italic">
                      Used: {msg.toolsUsed.map((t) => t.replace(/_/g, " ")).join(", ")}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-3">
                <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-blue-600" />
                </div>
                <div className="bg-slate-50 rounded-2xl rounded-tl-sm px-4 py-3">
                  <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                </div>
              </div>
            )}

            {locError && (
              <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg pl-11">{locError}</p>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex gap-2 px-4 py-3 border-t border-slate-100 flex-shrink-0">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
              placeholder="Ask anything about your car..."
              disabled={loading}
              className="flex-1 h-11 px-4 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="w-11 h-11 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
