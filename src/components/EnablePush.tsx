"use client";

import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { subscribeToPush, registerServiceWorker } from "@/lib/push";
import { Bell } from "lucide-react";
import { useEffect } from "react";

export function EnablePush() {
  const { user } = useAuth();
  const [status, setStatus] = useState<"idle" | "ok" | "denied" | "unsupported" | "error">("idle");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    registerServiceWorker();
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "granted") setStatus("ok");
    if (Notification.permission === "denied") setStatus("denied");
  }, []);

  if (!user || status === "unsupported") return null;
  if (status === "ok") return null;

  const enable = async () => {
    try {
      setMsg("");
      await subscribeToPush(user.uid);
      setStatus("ok");
    } catch (e: any) {
      setStatus(e.message?.includes("negato") ? "denied" : "error");
      setMsg(e.message || "Errore");
    }
  };

  if (status === "denied") {
    return (
      <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm">
        Notifiche bloccate dal browser. Abilitale dalle impostazioni del sito.
      </div>
    );
  }

  return (
    <div className="mb-4 p-3 rounded-2xl bg-white/90 border border-orange-100 shadow-sm flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm text-amber-900">
        <Bell className="w-4 h-4 text-warm-orange" />
        Attiva le notifiche per post-it e scadenze
      </div>
      <button onClick={enable} className="btn-primary px-4 py-2 text-sm">
        Attiva
      </button>
      {msg && <p className="w-full text-xs text-red-600">{msg}</p>}
    </div>
  );
}
