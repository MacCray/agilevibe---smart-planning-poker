import { initializeApp, FirebaseApp } from 'firebase/app';
import { 
  getFirestore, 
  Firestore, 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  collection,
  Timestamp
} from 'firebase/firestore';
import type { ActiveTeam, Team } from '../types';

// Конфигурация Firebase (будет загружена из переменных окружения)
const getFirebaseConfig = () => {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
  const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID;
  const appId = import.meta.env.VITE_FIREBASE_APP_ID;

  if (!apiKey || !authDomain || !projectId) {
    console.warn('[Firebase] Configuration missing. Real-time sync will be disabled.');
    return null;
  }

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId
  };
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

export const initFirebase = (): Firestore | null => {
  if (db) return db;

  const config = getFirebaseConfig();
  if (!config) return null;

  try {
    app = initializeApp(config);
    db = getFirestore(app);
    console.log('[Firebase] Initialized successfully');
    return db;
  } catch (error) {
    console.error('[Firebase] Initialization error:', error);
    return null;
  }
};

// ID комнаты для синхронизации (можно сделать динамическим в будущем)
const ROOM_ID = 'agilevibe_main_room';

export interface RoomState {
  revealed: boolean;
  currentTask: {
    id: string;
    title: string;
    description: string;
  };
  activeTeam: ActiveTeam;
}

export interface ParticipantData {
  id: string;
  name: string;
  role: 'voter' | 'admin';
  team: Team | null; // admin has no team
  currentVote: string | null;
  joinedAt: number;
  lastSeen: Timestamp;
}

// Подписка на состояние комнаты
export const subscribeToRoomState = (
  onStateChange: (state: RoomState) => void,
  onError?: (error: Error) => void
): (() => void) | null => {
  const firestore = initFirebase();
  if (!firestore) {
    onError?.(new Error('Firebase not initialized'));
    return null;
  }

  const roomRef = doc(firestore, 'rooms', ROOM_ID);

  return onSnapshot(
    roomRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        onStateChange({
          revealed: data.revealed || false,
          currentTask: data.currentTask || {
            id: '1',
            title: 'New Story',
            description: 'Describe requirements here...'
          },
          activeTeam: data.activeTeam || 'All'
        });
      } else {
        // Создаем начальное состояние, если его нет
        setDoc(roomRef, {
          revealed: false,
          currentTask: {
            id: '1',
            title: 'New Story',
            description: 'Describe requirements here...'
          },
          activeTeam: 'All'
        });
      }
    },
    (error) => {
      console.error('[Firebase] Room state error:', error);
      onError?.(error);
    }
  );
};

// Обновление состояния раскрытия карт
export const updateRevealedState = async (revealed: boolean): Promise<void> => {
  const firestore = initFirebase();
  if (!firestore) throw new Error('Firebase not initialized');

  const roomRef = doc(firestore, 'rooms', ROOM_ID);
  await updateDoc(roomRef, { revealed });
};

// Обновление задачи
export const updateTask = async (task: { id: string; title: string; description: string }): Promise<void> => {
  const firestore = initFirebase();
  if (!firestore) throw new Error('Firebase not initialized');

  const roomRef = doc(firestore, 'rooms', ROOM_ID);
  await updateDoc(roomRef, { currentTask: task });
};

// Выбор активной команды для голосования
export const updateActiveTeam = async (activeTeam: ActiveTeam): Promise<void> => {
  const firestore = initFirebase();
  if (!firestore) throw new Error('Firebase not initialized');

  const roomRef = doc(firestore, 'rooms', ROOM_ID);
  await updateDoc(roomRef, { activeTeam });
};

// Подписка на участников
export const subscribeToParticipants = (
  onParticipantChange: (participants: Record<string, ParticipantData>) => void,
  onError?: (error: Error) => void
): (() => void) | null => {
  const firestore = initFirebase();
  if (!firestore) {
    onError?.(new Error('Firebase not initialized'));
    return null;
  }

  const participantsRef = collection(firestore, 'rooms', ROOM_ID, 'participants');

  return onSnapshot(
    participantsRef,
    (snapshot) => {
      const participants: Record<string, ParticipantData> = {};
      const thirtySecondsAgo = Timestamp.fromMillis(Date.now() - 30000);

      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data() as ParticipantData;
        // Удаляем неактивных участников (не были онлайн более 30 секунд)
        if (data.lastSeen && data.lastSeen.toMillis() < thirtySecondsAgo.toMillis()) {
          return; // Пропускаем неактивных
        }
        const rawRole = (data as any).role as string | undefined;
        const role: ParticipantData['role'] = rawRole === 'admin' ? 'admin' : 'voter'; // observer -> voter (compat)

        participants[docSnapshot.id] = {
          ...(data as any),
          role,
          team: (data as any).team ?? (role === 'admin' ? null : 'React'),
          joinedAt: (data as any).joinedAt || 0
        } as ParticipantData;
      });

      onParticipantChange(participants);
    },
    (error) => {
      console.error('[Firebase] Participants error:', error);
      onError?.(error);
    }
  );
};

// Добавление/обновление участника
export const upsertParticipant = async (participant: Omit<ParticipantData, 'lastSeen'>): Promise<void> => {
  const firestore = initFirebase();
  if (!firestore) throw new Error('Firebase not initialized');

  const participantRef = doc(firestore, 'rooms', ROOM_ID, 'participants', participant.id);
  await setDoc(participantRef, {
    ...participant,
    lastSeen: Timestamp.now()
  }, { merge: true });
};

// Удаление участника
export const removeParticipant = async (participantId: string): Promise<void> => {
  const firestore = initFirebase();
  if (!firestore) throw new Error('Firebase not initialized');

  const participantRef = doc(firestore, 'rooms', ROOM_ID, 'participants', participantId);
  await deleteDoc(participantRef);
};

// Обновление голоса участника
export const updateParticipantVote = async (participantId: string, vote: string | null): Promise<void> => {
  const firestore = initFirebase();
  if (!firestore) throw new Error('Firebase not initialized');

  const participantRef = doc(firestore, 'rooms', ROOM_ID, 'participants', participantId);
  await updateDoc(participantRef, {
    currentVote: vote,
    lastSeen: Timestamp.now()
  });
};

// Сброс всех голосов
export const resetAllVotes = async (participantIds: string[]): Promise<void> => {
  const firestore = initFirebase();
  if (!firestore) throw new Error('Firebase not initialized');

  const batch = participantIds.map(id => {
    const participantRef = doc(firestore!, 'rooms', ROOM_ID, 'participants', id);
    return updateDoc(participantRef, {
      currentVote: null,
      lastSeen: Timestamp.now()
    });
  });

  await Promise.all(batch);
};

// Heartbeat для поддержания активности участника
export const updateParticipantHeartbeat = async (participantId: string): Promise<void> => {
  const firestore = initFirebase();
  if (!firestore) return;

  try {
    const participantRef = doc(firestore, 'rooms', ROOM_ID, 'participants', participantId);
    await updateDoc(participantRef, {
      lastSeen: Timestamp.now()
    });
  } catch (error) {
    // Игнорируем ошибки heartbeat
    console.warn('[Firebase] Heartbeat error:', error);
  }
};

