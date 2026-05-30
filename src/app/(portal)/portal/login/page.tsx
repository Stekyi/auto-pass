"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Phone, ArrowRight, RotateCcw } from "lucide-react";

export default function PortalLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [tel, setTel] = useState("");
  const [prefix, setPrefix] = useState("+233");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  const requestOtp = async () => {
    const fullTel = `${prefix}${tel.replace(/^0/, "")}`;
    setLoading(true);
    setError("");
    const res = await fetch("/api/portal/auth/request-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tel: fullTel }),
    });
    setLoading(false);
    if (!res.ok) { setError("Couldn't send code. Check your number and try again."); return; }
    setStep("otp");
    setCountdown(60);
  };

  const verifyOtp = async () => {
    const fullTel = `${prefix}${tel.replace(/^0/, "")}`;
    const code = otp.join("");
    if (code.length < 6) { setError("Enter all 6 digits."); return; }
    setLoading(true);
    setError("");
    const res = await fetch("/api/portal/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tel: fullTel, otp: code }),
    });
    setLoading(false);
    if (!res.ok) { setError("Incorrect or expired code. Try again."); return; }
    router.push("/portal/vehicles");
  };

  const handleOtpChange = (i: number, val: string) => {
    const digit = val.slice(-1);
    const next = otp.map((c, j) => j === i ? digit : c);
    setOtp(next);
    if (digit && i < 5) otpRefs.current[i + 1]?.focus();
    if (!digit && i > 0) otpRefs.current[i - 1]?.focus();
  };

  return (
    <div className="pt-8 space-y-8">
      <div className="text-center">
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Phone className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Your Car History</h1>
        <p className="text-slate-500 mt-1 text-sm">
          {step === "phone" ? "Enter your phone number to view your vehicles." : `Enter the 6-digit code sent to ${prefix}${tel}`}
        </p>
      </div>

      {step === "phone" ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Phone Number</label>
            <div className="flex gap-2">
              <select value={prefix} onChange={(e) => setPrefix(e.target.value)}
                className="h-14 px-3 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="+233">🇬🇭 +233</option>
                <option value="+234">🇳🇬 +234</option>
                <option value="+254">🇰🇪 +254</option>
                <option value="+1">🇺🇸 +1</option>
              </select>
              <input
                type="tel"
                value={tel}
                onChange={(e) => setTel(e.target.value)}
                placeholder="0244 000 000"
                className="flex-1 h-14 px-4 border border-slate-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{error}</p>}
          <button onClick={requestOtp} disabled={loading || tel.length < 7}
            className="w-full h-14 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-base transition-colors">
            {loading ? "Sending..." : <>Get Code <ArrowRight className="w-5 h-5" /></>}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3 text-center">Enter your 6-digit code</label>
            <div className="flex justify-center gap-2">
              {otp.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => { otpRefs.current[i] = el; }}
                  type="tel"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  className="w-12 h-14 text-center text-xl font-bold border-2 border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg text-center">{error}</p>}
          <button onClick={verifyOtp} disabled={loading || otp.join("").length < 6}
            className="w-full h-14 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-base transition-colors">
            {loading ? "Verifying..." : <>Sign In <ArrowRight className="w-5 h-5" /></>}
          </button>
          <div className="text-center">
            {countdown > 0 ? (
              <p className="text-sm text-slate-400">Resend code in {countdown}s</p>
            ) : (
              <button onClick={() => { setOtp(["","","","","",""]); requestOtp(); }}
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 mx-auto">
                <RotateCcw className="w-4 h-4" /> Send a new code
              </button>
            )}
          </div>
          <button onClick={() => { setStep("phone"); setError(""); setOtp(["","","","","",""]); }}
            className="w-full text-sm text-slate-400 hover:text-slate-600">
            ← Change phone number
          </button>
        </div>
      )}
    </div>
  );
}
