import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import { db, storage } from '@/lib/firebase';
import { compressImage } from '@/lib/compressImage';

const ROOT_FOLDER = 'attachments';

export interface UploadImageOptions {
  pathPrefix?: string;
  sourceTable?: string;
  sourceId?: string | null;
  sourceField?: string;
  uploadedBy?: string | null;
  preserve?: boolean;
}

export interface UploadImageResult {
  publicUrl: string;
  storagePath: string;
  isImage: boolean;
}

export async function uploadImage(
  file: File,
  opts: UploadImageOptions = {}
): Promise<UploadImageResult> {
  const toUpload = file.type.startsWith('image/') ? await compressImage(file) : file;

  const ext = (toUpload.name.split('.').pop() || 'bin').toLowerCase();
  const rnd = Math.random().toString(36).slice(2);

  const relativePath = opts.pathPrefix
    ? `${opts.pathPrefix.replace(/\/+$/, '')}/${Date.now()}-${rnd}.${ext}`
    : `uploads/${Date.now()}-${rnd}.${ext}`;

  const storagePath = `${ROOT_FOLDER}/${relativePath}`;
  const mime = toUpload.type || 'application/octet-stream';

  const storageRef = ref(storage, storagePath);

  const snapshot = await uploadBytes(storageRef, toUpload, {
    contentType: mime,
  });

  const publicUrl = await getDownloadURL(snapshot.ref);
  const isImage = mime.startsWith('image/');

  try {
    await addDoc(collection(db, 'image_assets'), {
      storage_path: storagePath,
      public_url: publicUrl,
      mime_type: mime,
      size_bytes: toUpload.size,
      source_table: opts.sourceTable ?? null,
      source_id: opts.sourceId ?? null,
      source_field: opts.sourceField ?? null,
      uploaded_by: opts.uploadedBy ?? null,
      preserve: !!opts.preserve,
      storage_provider: 'firebase-storage',
      processed_at: isImage ? Timestamp.now() : null,
      created_at: Timestamp.now(),
      updated_at: Timestamp.now(),
    });
  } catch (error) {
    console.warn('[uploadImage] não foi possível registrar image_assets:', error);
  }

  return {
    publicUrl,
    storagePath,
    isImage,
  };
}

export async function uploadImages(
  files: File[],
  opts: UploadImageOptions = {}
): Promise<string[]> {
  const urls: string[] = [];

  for (const file of files) {
    try {
      const result = await uploadImage(file, opts);
      urls.push(result.publicUrl);
    } catch (error) {
      console.error('[uploadImages] erro:', error);
    }
  }

  return urls;
}
