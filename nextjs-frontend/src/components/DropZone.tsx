'use client';

import { useRef, useState, DragEvent, ChangeEvent, MouseEvent } from 'react';
import { CloseGlyph, DocGlyph } from '@/components/icons';

interface Props {
  accept?: string;
  label: string;
  file: File | null;
  preview?: string | null;
  onFile: (file: File | null) => void;
  className?: string;
  minHeight?: string;
  icon?: React.ReactNode;
  sublabel?: string;
  testId?: string;
}

const defaultIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="24" height="24" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

export default function DropZone({
  accept = 'image/*',
  label,
  file,
  preview,
  onFile,
  className = '',
  minHeight,
  icon = defaultIcon,
  sublabel = 'Click or drag & drop',
  testId,
}: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => onFile(f);
  const clear = (e: MouseEvent) => { e.stopPropagation(); onFile(null); };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const dzClass = [
    'drop-zone',
    dragging ? 'dz-drag' : '',
    file ? 'dz-has-file' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div
      className={dzClass}
      data-testid={testId}
      style={minHeight ? { minHeight } : undefined}
      role="button"
      tabIndex={0}
      aria-label={file ? `${file.name} · ${label}` : label}
      onClick={() => inputRef.current?.click()}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="dz-input"
        tabIndex={-1}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />

      {preview ? (
        <>
          <img src={preview} className="dz-preview" alt="" />
          <div className="dz-filename">{file?.name}</div>
        </>
      ) : file ? (
        <div className="dz-doc-name"><DocGlyph size={20} />{file.name}</div>
      ) : (
        <div className="dz-placeholder">
          {icon}
          <span><strong>{label}</strong><span>{sublabel}</span></span>
        </div>
      )}

      {file && (
        <button type="button" className="dz-clear" onClick={clear} aria-label={`ลบไฟล์ ${file.name} · Remove file`}><CloseGlyph /></button>
      )}
    </div>
  );
}
