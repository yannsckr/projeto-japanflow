import { 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

export interface AppUserProfile {
  id: string;
  name: string;
  email: string;
  role?: string;
  sector?: string;
  avatarUrl?: string;
  createdAt?: string;
}

export async function loginUser(email: string, password: string): Promise<AppUserProfile> {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const user = credential.user;
  
  const userDocRef = doc(db, 'users', user.uid);
  const userDoc = await getDoc(userDocRef);

  if (userDoc.exists()) {
    return userDoc.data() as AppUserProfile;
  }

  const newProfile: AppUserProfile = {
    id: user.uid,
    name: user.displayName || email.split('@')[0],
    email: user.email || email,
    createdAt: new Date().toISOString(),
  };

  await setDoc(userDocRef, newProfile);
  return newProfile;
}

export async function logoutUser(): Promise<void> {
  await firebaseSignOut(auth);
}

export function subscribeToAuthChanges(callback: (user: AppUserProfile | null) => void) {
  return onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
    if (!firebaseUser) {
      callback(null);
      return;
    }

    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      callback(userDoc.data() as AppUserProfile);
    } else {
      callback({
        id: firebaseUser.uid,
        name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Usuário',
        email: firebaseUser.email || '',
      });
    }
  });
}