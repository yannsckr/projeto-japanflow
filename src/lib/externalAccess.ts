import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

// Chave usada em user_feature_permissions para liberar acesso fora da rede
export const EXTERNAL_ACCESS_KEY = 'external_access' as const;

export async function userCanAccessExternally(userId: string): Promise<boolean> {
  try {
    const permissionQuery = query(
      collection(db, 'user_feature_permissions'),
      where('user_id', '==', userId),
      where('feature_key', '==', EXTERNAL_ACCESS_KEY)
    );

    const snapshot = await getDocs(permissionQuery);

    if (snapshot.empty) {
      return false;
    }

    return snapshot.docs.some((permissionDoc) => permissionDoc.data().enabled === true);
  } catch (error) {
    console.error('Erro ao verificar acesso externo:', error);

    return false;
  }
}
