import { useRef } from 'react';
import type { PendingOpeningAttachment } from '../utils/openingAttachments';
import {
  revokePendingPreviews,
  validateOpeningFile,
  validateWorkOrderImageFile,
  isVideoContentType,
  normalizeImageContentType,
} from '../utils/openingAttachments';

type Props = {
  attachments: PendingOpeningAttachment[];
  onChange: (next: PendingOpeningAttachment[]) => void;
  disabled?: boolean;
  title: string;
  hint?: string;
  maxCount?: number;
  allowVideo?: boolean;
};

export default function WorkOrderPhotoPicker({
  attachments,
  onChange,
  disabled,
  title,
  hint,
  maxCount = 10,
  allowVideo = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const accept = allowVideo
    ? 'image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm'
    : 'image/jpeg,image/png,image/webp';

  const handleFiles = (files: FileList | null) => {
    if (!files || disabled) return;
    const remaining = maxCount - attachments.length;
    if (remaining <= 0) {
      alert(`En fazla ${maxCount} dosya ekleyebilirsiniz.`);
      return;
    }

    const next = [...attachments];
    for (const file of Array.from(files).slice(0, remaining)) {
      const error = allowVideo ? validateOpeningFile(file) : validateWorkOrderImageFile(file);
      if (error) {
        alert(error);
        continue;
      }
      const contentType = normalizeImageContentType(file.type, file.name);
      next.push({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        contentType,
        isVideo: allowVideo && isVideoContentType(contentType),
      });
    }
    onChange(next);
    if (inputRef.current) inputRef.current.value = '';
  };

  const removeAt = (index: number) => {
    const removed = attachments[index];
    if (removed) URL.revokeObjectURL(removed.previewUrl);
    onChange(attachments.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    revokePendingPreviews(attachments);
    onChange([]);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">{title}</h4>
          {hint && <p className="text-[11px] text-slate-500 font-medium">{hint}</p>}
          <p className="text-[11px] text-slate-500 font-medium">
            {attachments.length}/{maxCount} yeni dosya seçildi
          </p>
        </div>
        {attachments.length > 0 && !disabled && (
          <button type="button" onClick={clearAll} className="text-[11px] font-bold text-rose-600 hover:text-rose-700">
            Seçimi Temizle
          </button>
        )}
      </div>

      {attachments.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {attachments.map((item, index) => (
            <div key={item.id} className="relative rounded-lg border border-slate-200 bg-white overflow-hidden">
              {item.isVideo ? (
                <video src={item.previewUrl} className="w-full h-24 object-cover bg-black" muted />
              ) : (
                <img src={item.previewUrl} alt={item.file.name} className="w-full h-24 object-cover" />
              )}
              <p className="text-[10px] text-slate-500 px-2 py-1 truncate font-semibold">{item.file.name}</p>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeAt(index)}
                  className="absolute top-1 right-1 bg-rose-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded"
                >
                  Kaldır
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {attachments.length < maxCount && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple
            className="hidden"
            disabled={disabled}
            onChange={(e) => handleFiles(e.target.files)}
          />
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="w-full border-2 border-dashed border-blue-200 rounded-lg py-3 text-xs font-bold text-slate-600 hover:border-brand-orange hover:text-brand-orange disabled:opacity-50"
          >
            + {allowVideo ? 'Görsel / Video Ekle' : 'Görsel Ekle'}
          </button>
        </>
      )}
    </div>
  );
}
