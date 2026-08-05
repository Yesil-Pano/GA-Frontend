import { useRef } from 'react';
import type { PendingOpeningAttachment } from '../utils/openingAttachments';
import {
  MAX_OPENING_ATTACHMENTS,
  revokePendingPreviews,
  validateOpeningFile,
  isVideoContentType,
  normalizeImageContentType,
} from '../utils/openingAttachments';

type Props = {
  attachments: PendingOpeningAttachment[];
  onChange: (next: PendingOpeningAttachment[]) => void;
  disabled?: boolean;
};

export default function OpeningAttachmentsPicker({ attachments, onChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files || disabled) return;
    const remaining = MAX_OPENING_ATTACHMENTS - attachments.length;
    if (remaining <= 0) {
      alert(`En fazla ${MAX_OPENING_ATTACHMENTS} dosya ekleyebilirsiniz.`);
      return;
    }

    const next = [...attachments];
    for (const file of Array.from(files).slice(0, remaining)) {
      const error = validateOpeningFile(file);
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
        isVideo: isVideoContentType(contentType),
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
    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Açılış Ekleri</h4>
          <p className="text-[11px] text-slate-500 font-medium">
            Görsel (max 10 MB) veya video (max 30 MB) · {attachments.length}/{MAX_OPENING_ATTACHMENTS}
          </p>
        </div>
        {attachments.length > 0 && !disabled && (
          <button type="button" onClick={clearAll} className="text-[11px] font-bold text-rose-600 hover:text-rose-700">
            Tümünü Kaldır
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

      {attachments.length < MAX_OPENING_ATTACHMENTS && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
            multiple
            className="hidden"
            disabled={disabled}
            onChange={(e) => handleFiles(e.target.files)}
          />
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="w-full border-2 border-dashed border-slate-300 rounded-lg py-3 text-xs font-bold text-slate-600 hover:border-brand-orange hover:text-brand-orange disabled:opacity-50"
          >
            + Görsel / Video Ekle
          </button>
        </>
      )}
    </div>
  );
}
