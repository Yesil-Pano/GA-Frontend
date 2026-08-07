import api from '../services/api';

export const OPENING_ATTACHMENT_CATEGORY = 'ACILIS';
export const MAX_OPENING_ATTACHMENTS = 5;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 30 * 1024 * 1024;

/** Base64 JSON gövdesi limit altında kalsın diye hedef (sunucu 413 önlemi) */
const COMPRESS_IMAGE_TARGET_BYTES = 2.5 * 1024 * 1024;
const COMPRESS_MAX_DIMENSION = 2048;

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);

export type PendingOpeningAttachment = {
  id: string;
  file: File;
  previewUrl: string;
  contentType: string;
  isVideo: boolean;
};

export function isVideoContentType(contentType: string): boolean {
  return VIDEO_TYPES.has(contentType.toLowerCase());
}

export function normalizeImageContentType(type: string, fileName: string): string {
  const t = (type || '').toLowerCase();
  if (IMAGE_TYPES.has(t)) return t;
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return t;
}

export function validateOpeningFile(file: File): string | null {
  const type = normalizeImageContentType(file.type, file.name);
  if (!IMAGE_TYPES.has(type) && !VIDEO_TYPES.has(type)) {
    return `"${file.name}" desteklenmiyor. JPEG, PNG, WebP veya MP4/MOV/WebM seçin.`;
  }
  const max = isVideoContentType(type) ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size > max) {
    const mb = Math.round(max / 1024 / 1024);
    return `"${file.name}" çok büyük (en fazla ${mb} MB).`;
  }
  return null;
}

/** Telefon fotoğraflarını yüklemeden önce küçültür (413 / yavaş ağ). */
async function compressImageForUpload(file: File): Promise<File> {
  const contentType = normalizeImageContentType(file.type, file.name);
  if (!IMAGE_TYPES.has(contentType)) return file;
  if (file.size <= COMPRESS_IMAGE_TARGET_BYTES) return file;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      const scale = Math.min(1, COMPRESS_MAX_DIMENSION / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      const tryQuality = (quality: number) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            if (blob.size > COMPRESS_IMAGE_TARGET_BYTES && quality > 0.45) {
              tryQuality(quality - 0.12);
              return;
            }
            const base = file.name.replace(/\.[^.]+$/, '') || 'photo';
            resolve(new File([blob], `${base}.jpg`, { type: 'image/jpeg' }));
          },
          'image/jpeg',
          quality,
        );
      };
      tryQuality(0.85);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Görsel okunamadı'));
    };
    img.src = objectUrl;
  });
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function uploadOpeningAttachments(
  workOrderId: string,
  attachments: PendingOpeningAttachment[],
): Promise<void> {
  await uploadWorkOrderPhotos(workOrderId, attachments, OPENING_ATTACHMENT_CATEGORY);
}

export async function uploadWorkOrderPhotos(
  workOrderId: string,
  attachments: PendingOpeningAttachment[],
  description: string,
): Promise<void> {
  for (const item of attachments) {
    const prepared = item.isVideo ? item.file : await compressImageForUpload(item.file);
    const contentType = item.isVideo
       ? item.contentType
      : normalizeImageContentType(prepared.type, prepared.name);
    const base64Data = await readFileAsBase64(prepared);
    await api.post('/photos', {
      base64Data,
      fileName: prepared.name,
      contentType,
      entityType: 'WorkOrder',
      entityId: workOrderId,
      description,
    }, { timeout: 180_000 });
  }
}

export function validateWorkOrderImageFile(file: File): string | null {
  const type = normalizeImageContentType(file.type, file.name);
  if (!IMAGE_TYPES.has(type)) {
    return `"${file.name}" desteklenmiyor. JPEG, PNG veya WebP seçin.`;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `"${file.name}" çok büyük (en fazla ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB).`;
  }
  return null;
}

export function revokePendingPreviews(items: PendingOpeningAttachment[]): void {
  items.forEach((item) => URL.revokeObjectURL(item.previewUrl));
}

export function formatOpeningUploadError(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const resp = (error as { response?: { status?: number; data?: { message?: string } } }).response;
    if (resp?.status === 413) {
      return 'Dosya sunucu limitini aştı (413). Daha küçük bir görsel deneyin veya yöneticiye başvurun.';
    }
    if (typeof resp?.data?.message === 'string') return resp.data.message;
  }
  return 'Açılış ekleri yüklenemedi.';
}
