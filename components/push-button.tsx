"use client";

import { Bell, BellOff } from "lucide-react";
import { useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function PushButton() {
  const [status, setStatus] = useState<"idle" | "saving" | "enabled" | "unsupported" | "error">("idle");

  async function enableNotifications() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }

    try {
      setStatus("saving");
      const registration = await navigator.serviceWorker.register("/sw.js");
      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        setStatus("error");
        return;
      }

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        setStatus("error");
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription)
      });

      setStatus("enabled");
    } catch {
      setStatus("error");
    }
  }

  const disabled = status === "saving" || status === "enabled" || status === "unsupported";

  return (
    <button
      type="button"
      onClick={enableNotifications}
      disabled={disabled}
      className="inline-flex min-h-11 items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:bg-ink/45"
      title="Enable web push alerts"
    >
      {status === "enabled" ? <Bell className="size-4" /> : <BellOff className="size-4" />}
      {status === "saving" ? "Saving..." : status === "enabled" ? "Alerts enabled" : "Enable alerts"}
    </button>
  );
}
