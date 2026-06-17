"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type { AppNotification, NotificationSettings } from "@/lib/tender-types";

type NotificationContextValue = {
  unreadCount: number;
  importantNotifications: AppNotification[];
  permissionState: NotificationPermission | "unsupported";
  pushAvailable: boolean;
  settings: NotificationSettings | null;
  refresh: () => Promise<void>;
  requestPermission: () => Promise<NotificationPermission | "unsupported">;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

export function NotificationClient({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [permissionState, setPermissionState] = useState<NotificationPermission | "unsupported">(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission
  );
  const displayedRef = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    const [notificationsResponse, settingsResponse] = await Promise.all([
      fetch("/api/notifications?filter=all", { cache: "no-store" }),
      fetch("/api/notification-settings", { cache: "no-store" })
    ]);
    const notificationsData = await notificationsResponse.json();
    const settingsData = await settingsResponse.json();
    setNotifications(notificationsData.notifications ?? []);
    setSettings(settingsData.settings ?? null);
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return "unsupported";
    const permission = await Notification.requestPermission();
    setPermissionState(permission);
    return permission;
  }, []);

  useEffect(() => {
    void refresh();
    const handler = () => void refresh();
    window.addEventListener("tt:notifications-refresh", handler);
    return () => window.removeEventListener("tt:notifications-refresh", handler);
  }, [refresh]);

  useEffect(() => {
    if (!settings?.pushEnabled || permissionState !== "granted") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    const publicKey = process.env.NEXT_PUBLIC_TENDER_TRACKER_VAPID_PUBLIC_KEY;
    if (!publicKey) return;

    void navigator.serviceWorker.ready.then(async (registration) => {
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey)
        }));

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription)
      });
    });
  }, [permissionState, settings?.pushEnabled]);

  useEffect(() => {
    if (permissionState !== "granted") return;
    const importantUnread = notifications.filter((item) => !item.isRead && item.isImportant);
    for (const notification of importantUnread.slice(0, 3)) {
      if (displayedRef.current.has(notification.id)) continue;
      displayedRef.current.add(notification.id);
      new Notification(notification.title, { body: notification.body });
    }
  }, [notifications, permissionState]);

  const value = useMemo<NotificationContextValue>(
    () => ({
      unreadCount: notifications.filter((item) => !item.isRead).length,
      importantNotifications: notifications.filter((item) => !item.isRead && item.isImportant).slice(0, 3),
      permissionState,
      pushAvailable: typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator,
      settings,
      refresh,
      requestPermission
    }),
    [notifications, permissionState, settings, refresh, requestPermission]
  );

  return (
    <NotificationContext.Provider value={value}>
      {value.importantNotifications.length > 0 && (permissionState === "denied" || permissionState === "unsupported") ? (
        <div className="fixed inset-x-4 top-20 z-40 space-y-2 md:left-auto md:right-6 md:w-[420px]">
          {value.importantNotifications.map((notification) => (
            <div key={notification.id} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
              <p className="font-semibold">{notification.title}</p>
              <p className="mt-1">{notification.body}</p>
            </div>
          ))}
        </div>
      ) : null}
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationCenter() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotificationCenter must be used within NotificationClient.");
  }
  return context;
}
