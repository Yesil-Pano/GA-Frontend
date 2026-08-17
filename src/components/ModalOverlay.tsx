// src/components/ModalOverlay.tsx

import { createPortal } from 'react-dom';
import type { MouseEventHandler, ReactNode } from 'react';

type ModalOverlayProps = {
  children: ReactNode;
  className?: string;
  onClick?: MouseEventHandler<HTMLDivElement>;
};

/**
 * Tam ekran modal katmanı — document.body'ye portal edilir.
 * MainLayout header (z-40) altında kalmayı önler.
 */
export default function ModalOverlay({ children, className = '', onClick }: ModalOverlayProps) {
  const hasCustomBg = /\bbg-/.test(className);
  return createPortal(
    <div
      role="presentation"
      onClick={onClick}
      className={`fixed inset-0 z-200 flex items-center justify-center p-4 backdrop-blur-sm ${
        hasCustomBg ? '' : 'bg-slate-900/60'
      } ${className}`.trim().replace(/\s+/g, ' ')}
    >
      {children}
    </div>,
    document.body,
  );
}
