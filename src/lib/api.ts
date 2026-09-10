export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8787').replace(
  /\/+$/,
  ''
);

const REQUEST_TIMEOUT_MS = 10_000;
const STORAGE_TIMEOUT_MS = 60_000;

interface ApiErrorPayload {
  error?: string;
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as T | ApiErrorPayload;

  if (!response.ok) {
    const message =
      'error' in data && typeof data.error === 'string'
        ? data.error
        : `Erro HTTP ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    return await parseApiResponse<T>(response);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('A IA/API demorou demais para responder. Tente novamente.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function encodeStoragePath(path: string): string {
  return path
    .replace(/^\/+/, '')
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
}

export function storageFileUrl(path: string): string {
  return `${API_BASE_URL}/storage/file/${encodeStoragePath(path)}`;
}

export interface StorageObjectInfo {
  path: string;
  size: number;
  mimetype: string | null;
  uploaded: string | null;
}

export async function uploadStorageFileApi(
  file: Blob,
  input: {
    storagePath: string;
    sourceTable?: string | null;
    sourceId?: string | null;
    sourceField?: string | null;
    uploadedBy?: string | null;
    preserve?: boolean;
  }
): Promise<{
  ok: boolean;
  storagePath: string;
  publicUrl: string;
  sizeBytes: number | null;
  mimeType: string;
}> {
  const params = new URLSearchParams({
    path: input.storagePath,
    sourceTable: input.sourceTable ?? '',
    sourceId: input.sourceId ?? '',
    sourceField: input.sourceField ?? '',
    uploadedBy: input.uploadedBy ?? '',
    preserve: input.preserve ? 'true' : 'false',
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), STORAGE_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}/storage/upload?${params.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: file,
      signal: controller.signal,
    });

    return await parseApiResponse(response);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('O upload demorou demais para responder. Tente novamente.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function deleteStorageFileApi(
  storagePath: string
): Promise<{ ok: boolean; storagePath: string }> {
  const response = await fetch(`${API_BASE_URL}/storage/file/${encodeStoragePath(storagePath)}`, {
    method: 'DELETE',
  });

  return parseApiResponse(response);
}

export async function listStorageFilesApi(
  prefix = 'attachments/',
  cursor?: string
): Promise<{
  objects: StorageObjectInfo[];
  truncated: boolean;
  cursor: string | null;
}> {
  const params = new URLSearchParams({ prefix });
  if (cursor) params.set('cursor', cursor);

  const response = await fetch(`${API_BASE_URL}/storage/list?${params.toString()}`);
  return parseApiResponse(response);
}

export async function listAllStorageFilesApi(
  prefix = 'attachments/'
): Promise<StorageObjectInfo[]> {
  const files: StorageObjectInfo[] = [];
  let cursor: string | undefined;

  do {
    const page = await listStorageFilesApi(prefix, cursor);
    files.push(...page.objects);
    cursor = page.truncated && page.cursor ? page.cursor : undefined;
  } while (cursor);

  return files;
}

export interface ParsedCalendarEvent {
  title: string;
  description?: string;
  date: string;
  time: string | null;
  type: 'event' | 'reminder';
  targetMode: 'all' | 'sector' | 'specific';
  targetInfo: string;
}

export const parseCalendarEventsApi = (input: {
  text: string;
  users: unknown[];
  sectors: unknown[];
}) => postJson<{ events: ParsedCalendarEvent[] }>('/parse-calendar-events', input);

export const parseScheduleApi = (input: {
  imageBase64?: string;
  mimeType?: string;
  text?: string;
  userName?: string;
  referenceWeekStart?: string;
}) => postJson<{ weeks: unknown[] }>('/parse-schedule', input);

export const parseInventoryLabelApi = (input: { imageBase64: string; mimeType?: string }) =>
  postJson<{ type: string; code: string }>('/parse-inventory-label', input);

export const parsePurchaseOrderApi = (input: { fileBase64: string; mimeType?: string }) =>
  postJson<{ supplier?: Record<string, unknown>; items?: unknown[] }>(
    '/parse-purchase-order',
    input
  );

export const transcribeImageApi = (input: { imageBase64: string; mimeType?: string }) =>
  postJson<{ text: string }>('/transcribe-image', input);

export const freightCalcApi = (input: { address: string }) =>
  postJson<{
    city: string | null;
    state: string | null;
    carrier: string;
    price: string;
    deadline: string;
    notes?: string;
    distanceKm?: number;
    resolvedAddress?: string;
  }>('/freight-calc', input);

export const processImageApi = (input: {
  storagePath: string;
  mimeType?: string;
  sizeBytes?: number;
  sourceTable?: string | null;
  sourceId?: string | null;
  sourceField?: string | null;
  uploadedBy?: string | null;
  preserve?: boolean;
}) =>
  postJson<{
    ok: boolean;
    storagePath: string;
    mimeType: string | null;
    sizeBytes: number;
    processed: boolean;
    note?: string;
  }>('/process-image', input);

export interface StorageAuditResult {
  runId: string;
  totalFiles: number;
  knownAssets: number;
  orphans: number;
  orphanBytes: number;
  sample: string[];
  orphanFiles: Array<{ path: string; size: number }>;
}

export const storageAuditReportApi = (input: { knownPaths: string[] }) =>
  postJson<StorageAuditResult>('/storage-audit-report', input);

export const backfillWebpApi = (input: {
  mode: 'paths';
  paths: string[];
  maxDimension: number;
  quality: number;
  updateAssetsRow: boolean;
  inPlace: boolean;
  skipIfLarger: boolean;
}) =>
  postJson<{
    results?: Array<{
      storagePath: string;
      status: 'ok' | 'skipped' | 'error';
      reason?: string;
      beforeBytes?: number;
      afterBytes?: number;
    }>;
  }>('/backfill-webp', input);
