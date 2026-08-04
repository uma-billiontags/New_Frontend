import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyCm6A3ecdnRuM2BtqcU8hbViNVmtSYowNE",
  authDomain: "crm-notification-system-b1fbf.firebaseapp.com",
  projectId: "crm-notification-system-b1fbf",
  storageBucket: "crm-notification-system-b1fbf.firebasestorage.app",
  messagingSenderId: "822813005343",
  appId: "1:822813005343:web:9b60be7829ac4a5615e72a",
};

const app = initializeApp(firebaseConfig);
export const messaging = getMessaging(app);

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

export async function requestFcmToken(): Promise<string | null> {
  if (!("Notification" in window)) return null;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

//   console.log("VAPID KEY:", VAPID_KEY);

  try {
    const registration = await navigator.serviceWorker.ready; // ← wait for ACTIVE worker

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration, // ← pass it explicitly
    });

//   try {
//     const token = await getToken(messaging, {
//       vapidKey: VAPID_KEY,
//     });

    console.log("FCM TOKEN:", token);

    return token;
  } catch (e) {
    console.error("FCM token error", e);
    return null;
  }
}

export function listenForForegroundMessages(
  onMsg: (title: string, body: string) => void
) {
     return onMessage(messaging, (payload) => { 
    onMsg(
      payload.notification?.title || "New notification",
      payload.notification?.body || ""
    );
  });
}












