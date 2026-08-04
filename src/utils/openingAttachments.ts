import api from '../services/api';

export const OPENING_ATTACHMENT_CATEGORY = 'ACILIS';
export const MAX_OPENING_ATTACHMENTS = 5;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 30 * 1024 * 1024;

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

export function validateOpeningFile(file: File): string | null {
  const type = (file.type || '').toLowerCase();
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
  for (const item of attachments) {
    const base64Data = await readFileAsBase64(item.file);
    await api.post('/photos', {
      base64Data,
      fileName: item.file.name,
      contentType: item.contentType,
      entityType: 'WorkOrder',
      entityId: workOrderId,
      description: OPENING_ATTACHMENT_CATEGORY,
    }, { timeout: 180_000 });
  }
}

export function revokePendingPreviews(items: PendingOpeningAttachment[]): void {
  items.forEach((item) => URL.revokeObjectURL(item.previewUrl));
}
