import { db } from "@/lib/firebase";
import { collection, addDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import app from "@/lib/firebase";

interface PushNotificationPayload {
  token: string;
  title: string;
  body: string;
  userId: string;
}

export function usePushNotifications() {
  const [token, setToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ title: string; body: string } | null>(null);

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      console.warn("Notifications or Service Worker not supported.");
      return;
    }

    const messaging = getMessaging(app);

    // Solicitar permissão para notificações
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        getToken(messaging, {
          vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
        })
          .then((currentToken) => {
            if (currentToken) {
              setToken(currentToken);
              // Enviar o token para o seu backend para associar ao usuário
              console.log("FCM Token:", currentToken);
            } else {
              console.log("No registration token available. Request permission to generate one.");
            }
          })
          .catch((err) => {
            console.error("An error occurred while retrieving token.", err);
          });
      }
    });

    // Lidar com mensagens em primeiro plano
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log("Message received. ", payload);
      if (payload.notification) {
        setNotification({ title: payload.notification.title || "", body: payload.notification.body || "" });
      }
    });

    return () => unsubscribe();
  }, []);

  return { token, notification };
}

export async function sendPushToUser(userId: string, title: string, body: string) {
  try {
    // Em um cenário real, você buscaria o token FCM do userId no seu banco de dados
    // Por simplicidade, aqui vamos simular que o token está disponível (vindo de algum lugar)
    const userToken = "some_fcm_token_from_db"; // Substitua pela lógica real

    if (!userToken) {
      console.warn(`No FCM token found for user ${userId}. Cannot send push notification.`);
      return;
    }

    const notificationsCollection = collection(db, "push_notifications");
    await addDoc(notificationsCollection, {
      userId,
      title,
      body,
      token: userToken, // Em um cenário real, o token viria do banco
      timestamp: new Date(),
      read: false,
    });
    console.log(`Push notification for user ${userId} added to Firestore.`);

    // Em um cenário real, o envio da notificação FCM seria feito por um backend
    // usando as credenciais do Firebase Admin SDK. Este é apenas um placeholder.
    // const response = await fetch("https://fcm.googleapis.com/fcm/send", {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json",
    //     "Authorization": `key=${import.meta.env.VITE_FIREBASE_SERVER_KEY}`,
    //   },
    //   body: JSON.stringify({
    //     to: userToken,
    //     notification: {
    //       title,
    //       body,
    //     },
    //   }),
    // });
    // console.log("FCM response:", await response.json());
  } catch (error) {
    console.error("Error sending push notification:", error);
  }
}
