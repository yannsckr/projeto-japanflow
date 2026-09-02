import { useEffect, useRef, useCallback, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, setDoc, getDoc, updateDoc, addDoc, getDocs, Timestamp } from "firebase/firestore";
import { useApp } from "@/contexts/AppContext";

export type PresenceStatus = "online" | "offline" | "paused";

export interface UserPresence {
  user_id: string;
  status: PresenceStatus;
  pause_type: string | null;
  pause_started_at: Date | null;
  last_seen_at: Date;
}

// Mapeamento de usuários online em tempo real (para evitar requisições repetidas ao Firestore)
const onlineUsers = new Map<string, UserPresence>();

const updateOnlineUser = (user: UserPresence) => {
  onlineUsers.set(user.user_id, user);
};

export const usePresence = (userId: string | null) => {
  const { user, setIsLoading } = useApp();
  const [presences, setPresences] = useState<UserPresence[]>([]);
  const stateRef = useRef<{ status: PresenceStatus; pauseType: string | null; pauseStartedAt: Date | null }>({ status: "online", pauseType: null, pauseStartedAt: null });

  const currentUserId = user?.id || null;

  // Efeito para atualizar o status de presença do usuário atual no Firestore
  useEffect(() => {
    if (!currentUserId) return;

    const userPresenceDocRef = doc(db, "presence", currentUserId);

    const updateFirestorePresence = async () => {
      const now = new Date();
      const presenceData: UserPresence = {
        user_id: currentUserId,
        status: stateRef.current.status,
        pause_type: stateRef.current.pauseType,
        pause_started_at: stateRef.current.pauseStartedAt,
        last_seen_at: now,
      };
      await setDoc(userPresenceDocRef, presenceData, { merge: true });
      updateOnlineUser(presenceData);
    };

    // Atualiza a presença ao montar e a cada 30 segundos
    updateFirestorePresence();
    const interval = setInterval(updateFirestorePresence, 30000);

    // Monitora o estado de visibilidade da aba para atualizar a presença
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        stateRef.current.status = "online";
        updateFirestorePresence();
      } else {
        // Opcional: Marcar como ausente ou offline após um tempo em segundo plano
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Marca offline ao fechar a aba
    const handleBeforeUnload = async () => {
      if (currentUserId) {
        const offlineData: Partial<UserPresence> = { status: "offline", last_seen_at: new Date() };
        await updateDoc(userPresenceDocRef, offlineData);
        onlineUsers.set(currentUserId, { ...onlineUsers.get(currentUserId)!, ...offlineData });
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      // Opcional: Marcar offline imediatamente ao desmontar o hook
      if (currentUserId) {
        updateDoc(userPresenceDocRef, { status: "offline", last_seen_at: new Date() });
        onlineUsers.delete(currentUserId);
      }
    };
  }, [currentUserId]);

  // Efeito para escutar as mudanças de presença de TODOS os usuários no Firestore
  useEffect(() => {
    const presenceCollection = collection(db, "presence");
    const unsubscribe = onSnapshot(presenceCollection, (snapshot) => {
      const currentPresences: UserPresence[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as UserPresence;
        currentPresences.push({
          ...data,
          last_seen_at: data.last_seen_at instanceof Date ? data.last_seen_at : (data.last_seen_at && typeof data.last_seen_at.toDate === "function" ? data.last_seen_at.toDate() : data.last_seen_at), // Converte timestamp se necessário
          pause_started_at: data.pause_started_at instanceof Date ? data.pause_started_at : (data.pause_started_at && typeof data.pause_started_at.toDate === "function" ? data.pause_started_at.toDate() : data.pause_started_at), // Converte timestamp se necessário
        });
      });
      setPresences(currentPresences);
      currentPresences.forEach(updateOnlineUser);
    });

    return () => unsubscribe();
  }, []);

  const updatePresenceStatus = useCallback(async (status: PresenceStatus, pauseType?: string | null) => {
    if (!currentUserId) return;
    const now = new Date();
    stateRef.current = {
      status,
      pauseType: pauseType ?? null,
      pauseStartedAt: status === "paused" ? now : null,
    };
    const userPresenceDocRef = doc(db, "presence", currentUserId);
    const updatedData: Partial<UserPresence> = {
      status,
      pause_type: pauseType ?? null,
      pause_started_at: status === "paused" ? now : null,
      last_seen_at: now,
    };
    await updateDoc(userPresenceDocRef, updatedData);
    updateOnlineUser({ ...onlineUsers.get(currentUserId)!, ...updatedData } as UserPresence);
  }, [currentUserId]);

  const startSession = useCallback(async () => {
    if (!currentUserId) return;
    const now = new Date();
    const sessionsCollection = collection(db, "presence_sessions");

    // Finaliza sessões abertas anteriores
    const openSessionsQuery = query(sessionsCollection, where("user_id", "==", currentUserId), where("ended_at", "==", null));
    const openSessionsSnapshot = await getDocs(openSessionsQuery);
    openSessionsSnapshot.forEach(async (d) => {
      const sessionData = d.data();
      const startedAt = sessionData.started_at.toDate();
      const duration = Math.floor((now.getTime() - startedAt.getTime()) / 1000);
      await updateDoc(d.ref, { ended_at: now, duration_seconds: duration });
    });

    await addDoc(sessionsCollection, {
      user_id: currentUserId,
      status: "online",
      started_at: now,
    });
  }, [currentUserId]);

  const endSession = useCallback(async () => {
    if (!currentUserId) return;
    const now = new Date();
    const sessionsCollection = collection(db, "presence_sessions");
    const q = query(
      sessionsCollection,
      where("user_id", "==", currentUserId),
      where("status", "==", "online"),
      where("ended_at", "==", null),
      // orderBy("started_at", "desc"), // Firestore não permite orderBy em queries de igualdade sem índice
      // limit(1)
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const latestSessionDoc = querySnapshot.docs[0]; // Pega o primeiro (mais antigo se não houver orderby)
      const sessionData = latestSessionDoc.data();
      const startedAt = sessionData.started_at.toDate();
      const duration = Math.floor((now.getTime() - startedAt.getTime()) / 1000);
      await updateDoc(latestSessionDoc.ref, { ended_at: now, duration_seconds: duration });
    }
  }, [currentUserId]);

  // TODO: Migrar as chamadas startSession e endSession para um Provider ou useEffect com controle mais preciso

  return { presences, updatePresenceStatus, startSession, endSession };
};

export const useAllPresences = () => {
  const [presences, setPresences] = useState<UserPresence[]>([]);

  useEffect(() => {
    const presenceCollection = collection(db, "presence");
    const unsubscribe = onSnapshot(presenceCollection, (snapshot) => {
      const allPresences: UserPresence[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as UserPresence;
        allPresences.push({
          ...data,
          last_seen_at: data.last_seen_at instanceof Date ? data.last_seen_at : (data.last_seen_at && typeof data.last_seen_at.toDate === "function" ? data.last_seen_at.toDate() : data.last_seen_at),
          pause_started_at: data.pause_started_at instanceof Date ? data.pause_started_at : (data.pause_started_at && typeof data.pause_started_at.toDate === "function" ? data.pause_started_at.toDate() : data.pause_started_at),
        });
      });
      setPresences(allPresences);
    });

    return () => unsubscribe();
  }, []);

  const getStatus = (userId: string): PresenceStatus => {
    const p = presences.find((p) => p.user_id === userId);
    if (!p) return "offline";
    return p.status;
  };

  const getPauseInfo = (userId: string) => {
    const p = presences.find((p) => p.user_id === userId);
    return p ? { pauseType: p.pause_type, pauseStartedAt: p.pause_started_at } : null;
  };

  return { presences, getStatus, getPauseInfo };
};
