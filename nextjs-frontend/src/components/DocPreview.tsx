'use client';

import { useEffect, useRef, useState } from 'react';
import { CloseGlyph, DownloadGlyph, StepFailGlyph } from '@/components/icons';

interface Props {
  caseId: string;
  docKey: string;
  name: { th: string; en: string };
  pages: number;
  onClose: () => void;
}

type Load =
  | { kind: 'loading' }
  | { kind: 'ready'; url: string }
  | { kind: 'unsupported' }
  | { kind: 'error'; detail: string };

// Shows a generated PDF inside the page, so the renter can read it before downloading.
// The download route answers with Content-Disposition: attachment, which a frame would save
// rather than show; the same file re-wrapped as a blob URL has no such header, so the
// browser's own PDF viewer renders it.
export default function DocPreview({ caseId, docKey, name, pages, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const href = `/download/${caseId}/${docKey}`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    fetch(href)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.blob(); })
      .then(b => {
        if (cancelled) return;
        // Android Chrome has no inline PDF viewer and reports pdfViewerEnabled === false.
        const inline = (navigator as Navigator & { pdfViewerEnabled?: boolean }).pdfViewerEnabled !== false;
        if (!inline) { setLoad({ kind: 'unsupported' }); return; }
        url = URL.createObjectURL(new Blob([b], { type: 'application/pdf' }));
        setLoad({ kind: 'ready', url });
      })
      .catch(err => { if (!cancelled) setLoad({ kind: 'error', detail: String(err?.message ?? err) }); });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [href]);

  const close = () => dialogRef.current?.close();
  const downloadLink = (
    <a className="rw-btn small quiet outline" href={href} download={`${docKey}_${caseId}.pdf`} target="_blank" rel="noopener noreferrer" data-testid="preview-download">
      <DownloadGlyph />ดาวน์โหลด <span lang="en">· Download</span>
    </a>
  );

  return (
    <dialog ref={dialogRef} className="rw-viewer" aria-labelledby="viewer-title" onClose={onClose} data-testid="doc-viewer">
      <div className="rw-viewer-bar">
        <div className="rw-rowmain">
          <h2 id="viewer-title" className="rw-rt">{name.th}</h2>
          <p className="rw-rd"><span lang="en">{name.en}</span> · PDF · {pages} หน้า · {pages} page{pages !== 1 ? 's' : ''}</p>
        </div>
        <span className="rw-only-desktop">{downloadLink}</span>
        <button type="button" className="rw-btn icon quiet-ink" aria-label="ปิด · Close" onClick={close} data-testid="viewer-close">
          <CloseGlyph size={20} />
        </button>
      </div>

      {load.kind === 'ready' && (
        <iframe className="rw-viewer-frame" src={load.url} title={`${name.th} · ${name.en}`} data-testid="viewer-frame" />
      )}
      {load.kind !== 'ready' && (
        <div className="rw-viewer-state" data-testid="viewer-state" data-state={load.kind}>
          {load.kind === 'loading' && <p role="status">กำลังเปิดเอกสาร… <span lang="en">· Opening the document…</span></p>}
          {load.kind === 'unsupported' && (
            <p>เบราว์เซอร์นี้แสดง PDF ในหน้าไม่ได้ ดาวน์โหลดเพื่อเปิดดู <span lang="en">· This browser can&apos;t show PDFs here. Download to read it.</span></p>
          )}
          {load.kind === 'error' && (
            <div className="rw-err" role="alert">
              <StepFailGlyph size={20} />
              <span>
                เปิดเอกสารไม่ได้ในขณะนี้ ลองดาวน์โหลดแทน <span lang="en">· Unable to open the document right now. Try downloading it instead.</span>
                <details className="rw-details"><summary>รายละเอียดทางเทคนิค · Technical detail</summary><code>{load.detail}</code></details>
              </span>
            </div>
          )}
        </div>
      )}
      <div className="rw-viewer-foot rw-only-mobile">{downloadLink}</div>
    </dialog>
  );
}
