"use client";

import { useEffect, useState } from "react";
import { MapPin, CheckCircle, X, Loader2 } from "lucide-react";

export function LocationSetupBanner() {
  const [status, setStatus] = useState<"loading" | "missing" | "set" | "dismissed">("loading");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  useEffect(() => {
    fetch("/api/mechanic/location")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) {
          setStatus("dismissed");
          return;
        }
        if (d.mechanic?.lat && d.mechanic?.lng) setStatus("set");
        else setStatus("missing");
      })
      .catch(() => setStatus("dismissed"));
  }, []);

  const saveLocation = () => {
    if (!navigator.geolocation) { setSavedMsg("GPS not available on this device."); return; }
    setSaving(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const res = await fetch("/api/mechanic/location", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat, lng }),
        });
        setSaving(false);
        if (!res.ok) {
          setSavedMsg("We could not save your location. Please try again.");
          return;
        }
        setStatus("set");
        setSavedMsg("Location saved! Customers can now find your shop.");
      },
      () => {
        setSaving(false);
        setSavedMsg("GPS access denied. Please enable location access and try again.");
      }
    );
  };

  if (status === "loading" || status === "set" || status === "dismissed") {
    return savedMsg ? (
      <div className="flex items-center gap-2 bg-green-50 border-b border-green-200 px-4 py-2 text-sm text-green-800">
        <CheckCircle className="w-4 h-4 flex-shrink-0" /> {savedMsg}
      </div>
    ) : null;
  }

  return (
    <div className="flex items-center gap-3 bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-sm">
      <MapPin className="w-4 h-4 text-amber-600 flex-shrink-0" />
      <span className="flex-1 text-amber-800">
        <strong>Set your shop location</strong> — customers use AutoPass AI to find nearby mechanics.
      </span>
      {savedMsg && <span className="text-red-600 text-xs">{savedMsg}</span>}
      <button
        onClick={saveLocation}
        disabled={saving}
        className="flex items-center gap-1.5 h-8 px-3 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white text-xs font-medium rounded-lg flex-shrink-0"
      >
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
        {saving ? "Getting GPS..." : "Use My Location"}
      </button>
      <button onClick={() => setStatus("dismissed")} className="text-amber-400 hover:text-amber-700">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
