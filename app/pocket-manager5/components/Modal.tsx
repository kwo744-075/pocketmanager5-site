'use client';
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  labelledById?: string;
};

export default function Modal({ open, onClose, children, labelledById }: ModalProps) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  if (!elRef.current && typeof document !== 'undefined') {
    elRef.current = document.createElement('div');
    elRef.current.className = 'pm-modal-root';
  }

  useEffect(() => {
    const root = document.body;
    const el = elRef.current!;
    if (open) {
      root.appendChild(el);
      lastFocusedRef.current = document.activeElement as HTMLElement | null;
      document.body.classList.add('pm-modal-open');
      setTimeout(() => {
        contentRef.current?.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus();
      }, 0);
    }
    return () => {
      if (root.contains(el)) root.removeChild(el);
      document.body.classList.remove('pm-modal-open');
      lastFocusedRef.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && contentRef.current) {
        const focusable = Array.from(
          contentRef.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
        ).filter(Boolean);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    if (open) {
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    }
  }, [open, onClose]);

  if (!open) return null;

  const modalContent = (
    <div
      className="pm-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledById}
        ref={contentRef}
        className="pm-modal-content bg-white dark:bg-gray-900 rounded-lg shadow-lg max-w-3xl w-full max-h-[90vh] overflow-auto transform transition-all"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );

  return createPortal(modalContent, elRef.current);
}
