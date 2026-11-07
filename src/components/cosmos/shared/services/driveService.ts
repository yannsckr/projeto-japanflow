import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { deleteObject, getBlob, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import type { DriveFile, DriveFolder } from '../types/drive';

const FOLDERS = 'cosmos_drive_folders';
const FILES = 'cosmos_drive_files';
const MAX_SIZE = 30 * 1024 * 1024;

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error('Falha na operação do Drive');
}

export function watchDriveFolders(
  receive: (folders: DriveFolder[]) => void,
  fail: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, FOLDERS), orderBy('created_at', 'desc')),
    (snapshot) =>
      receive(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as DriveFolder)),
    (error) => fail(error)
  );
}

export function watchDriveFiles(
  receive: (files: DriveFile[]) => void,
  fail: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, FILES), orderBy('created_at', 'desc')),
    (snapshot) =>
      receive(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as DriveFile)),
    (error) => fail(error)
  );
}

export async function createDriveFolder(
  name: string,
  parentId: string,
  userId: string
): Promise<void> {
  const clean = name.trim();
  if (!clean || clean.length > 100) throw new Error('Nome de pasta inválido (máx. 100 caracteres)');
  const destination = doc(collection(db, FOLDERS));
  await setDoc(destination, {
    name: clean,
    parent_id: parentId,
    created_by: userId,
    created_at: serverTimestamp(),
  });
}

export async function uploadDriveFile(file: File, folderId: string, userId: string): Promise<void> {
  if (!file.size || file.size > MAX_SIZE) throw new Error('Arquivo deve ter até 30 MB');
  const mime = file.type || 'application/octet-stream';
  // Nome interno aleatório; nome original fica apenas no Firestore.
  const extension =
    (file.name.split('.').pop() || 'bin')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 12) || 'bin';
  const destination = doc(collection(db, FILES));
  const storagePath = `cosmos_drive/${destination.id}/arquivo.${extension}`;
  await setDoc(destination, {
    name: file.name.slice(0, 180),
    folder_id: folderId,
    storage_path: storagePath,
    content_type: mime,
    size: file.size,
    status: 'pending',
    created_by: userId,
    created_at: serverTimestamp(),
  });
  let uploaded = false;
  try {
    await uploadBytes(ref(storage, storagePath), file, { contentType: mime });
    uploaded = true;
    await updateDoc(destination, { status: 'ready' });
  } catch (error) {
    // Falhas de upload nao devem deixar metadados pendentes.
    // Se a limpeza falhar, um administrador podera remover o documento pendente.
    if (uploaded) {
      try {
        await deleteObject(ref(storage, storagePath));
      } catch {
        /* limpeza pendente */
      }
    }
    try {
      await deleteDoc(destination);
    } catch {
      /* limpeza pendente */
    }
    throw normalizeError(error);
  }
}

export async function downloadDriveFile(file: DriveFile): Promise<void> {
  // getBlob consulta as regras do Storage; nao criar URLs publicas permanentes.
  const blob = await getBlob(ref(storage, file.storage_path));
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 15_000);
}

export async function deleteDriveFile(file: DriveFile): Promise<void> {
  // Remover objeto antes do documento: a autorizacao do Storage depende do documento.
  if (file.status === 'ready') await deleteObject(ref(storage, file.storage_path));
  await deleteDoc(doc(db, FILES, file.id));
}

export async function deleteDriveFolder(folder: DriveFolder): Promise<void> {
  await deleteDoc(doc(db, FOLDERS, folder.id));
}
