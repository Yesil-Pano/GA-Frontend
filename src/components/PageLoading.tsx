type PageLoadingProps = {
  /** panel: sol liste / içerik alanı; page: tam sayfa yüksekliği */
  variant?: 'page' | 'panel';
  className?: string;
};

export default function PageLoading({ variant = 'page', className = '' }: PageLoadingProps) {
  const sizeClass = variant === 'panel' ? 'flex-1 min-h-[280px] w-full' : 'min-h-screen w-full';

  return (
    <div
      className={`flex flex-col items-center justify-center bg-brand-navy ${sizeClass} ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-label="Yükleniyor"
    >
      <div className="page-loading-spinner mb-5" />
      <span className="text-sm font-medium text-slate-400 tracking-wide">Yükleniyor...</span>
    </div>
  );
}
