import { useEffect, useState } from 'react';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import app, { auth } from '@/lib/firebase';

interface PushNotificationPayload {
  title: string;
  body: string;
}

const apiBaseUrl = () =>
  String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

async function authenticatedPost(path: string, payload: unknown) {
  // O App pode renderizar antes do Firebase Auth terminar de restaurar a sessão.
  // Esperamos essa hidratação antes de concluir que não há usuário autenticado.
  await auth.authStateReady();

  const firebaseUser = auth.currentUser;

  if (!firebaseUser) {
    throw new Error('Usuário Firebase não autenticado.');
  }

  const baseUrl = apiBaseUrl();
  if (!baseUrl) {
    throw new Error('VITE_API_BASE_URL não configurado.');
  }

  const idToken = await firebaseUser.getIdToken();

  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error || `Push API HTTP ${response.status}`);
  }

  return data;
}

async function registerCurrentBrowserToken(token: string) {
  return authenticatedPost('/push/register', {
    token,
    platform: 'web',
    userAgent: navigator.userAgent,
  });
}

export function usePushNotifications() {
  const [token, setToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<PushNotificationPayload | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    async function setupPush() {
      try {
        // Evita corrida entre o AppLayout e a restauração da sessão do Firebase Auth.
        await auth.authStateReady();

        if (cancelled) return;

        if (!auth.currentUser) {
          console.log('Push aguardando autenticação Firebase.');
          return;
        }

        if (!('Notification' in window) || !('serviceWorker' in navigator)) {
          console.warn('Push notifications não são suportadas neste navegador.');
          return;
        }

        if (!(await isSupported())) {
          console.warn('Firebase Messaging não é suportado neste navegador.');
          return;
        }

        if (Notification.permission !== 'granted') {
          console.log('Push aguardando permissão do usuário.');
          return;
        }

        const registration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;

        const messaging = getMessaging(app);
        const currentToken = await getToken(messaging, {
          vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
          serviceWorkerRegistration: registration,
        });

        if (!currentToken || cancelled) {
          if (!currentToken) console.warn('Nenhum token FCM disponível.');
          return;
        }

        setToken(currentToken);
        await registerCurrentBrowserToken(currentToken);

        console.log('Push FCM registrado no JapanFlow.');

        unsubscribe = onMessage(messaging, (payload) => {
          const title =
            payload.notification?.title ||
            payload.data?.title ||
            'JapanFlow';

          const body =
            payload.notification?.body ||
            payload.data?.body ||
            'Nova notificação';

          console.log('Mensagem FCM recebida em foreground:', payload);
          setNotification({ title, body });
        });
      } catch (error) {
        console.error('Erro ao configurar push notifications:', error);
      }
    }

    void setupPush();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  return { token, notification };
}

export async function requestPushPermission() {
  if (!('Notification' in window)) {
    throw new Error('Este navegador não suporta notificações.');
  }

  return Notification.requestPermission();
}

export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  url = '/'
): Promise<void> {
  if (!userId || !title || !body) return;

  try {
    const result = await authenticatedPost('/push/send', {
      userId,
      title,
      body,
      url,
    });

    if (result?.found === 0) {
      console.info(`Usuário ${userId} ainda não possui dispositivo push registrado.`);
    }
  } catch (error) {
    console.warn('Não foi possível enviar push:', error);
  }
}