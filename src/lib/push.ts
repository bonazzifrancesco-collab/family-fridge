export function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export async function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    return reg;
  } catch (e) {
    console.warn("SW register failed", e);
    return null;
  }
}

export async function subscribeToPush(userId: string) {
  if (!("Notification" in window) || !("PushManager" in window)) {
    throw new Error("Notifiche push non supportate su questo dispositivo");
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Permesso notifiche negato");
  }
  const reg = await registerServiceWorker();
  if (!reg) throw new Error("Service worker non disponibile");

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) throw new Error("VAPID public key mancante");

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
  }

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, subscription: sub.toJSON() }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Salvataggio subscription fallito");
  return sub;
}
