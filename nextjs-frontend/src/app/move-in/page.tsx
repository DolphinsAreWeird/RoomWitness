'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { addMoveInRecord } from '@/lib/moveInVault';
import { CloseGlyph, InfoGlyph, PlusGlyph, StepDoneGlyph, StepFailGlyph } from '@/components/icons';

type SaveState = { kind: 'idle' } | { kind: 'saved' } | { kind: 'error'; reason: 'empty' | 'quota' | 'other' };

export default function MoveInPage() {
  const [label, setLabel] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [prevs, setPrevs] = useState<string[]>([]);
  const [save, setSave] = useState<SaveState>({ kind: 'idle' });
  const inputRef = useRef<HTMLInputElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const imgs = Array.from(incoming).filter(f => f.type.startsWith('image/'));
    setFiles(prev => [...prev, ...imgs]);
    imgs.forEach(f => {
      const r = new FileReader();
      r.onload = e => setPrevs(prev => [...prev, e.target?.result as string]);
      r.readAsDataURL(f);
    });
    if (save.kind === 'error') setSave({ kind: 'idle' });
  };
  const removeFile = (i: number) => {
    setFiles(prev => prev.filter((_, idx) => idx !== i));
    setPrevs(prev => prev.filter((_, idx) => idx !== i));
  };

  const focusNotice = () => setTimeout(() => {
    noticeRef.current?.focus({ preventScroll: true });
    noticeRef.current?.scrollIntoView({ block: 'center' });
  }, 0);

  const saveRecord = () => {
    if (prevs.length === 0) { setSave({ kind: 'error', reason: 'empty' }); focusNotice(); return; }
    try {
      addMoveInRecord({
        id: `MI-${Date.now()}`,
        createdAt: new Date().toISOString(),
        label: label.trim() || 'My apartment',
        photoDataUrls: prevs,
      });
      setSave({ kind: 'saved' });
    } catch (err: any) {
      // localStorage is small (about 5 MB); large photo sets can exceed it.
      const quota = err?.name === 'QuotaExceededError' || /quota/i.test(String(err?.message));
      setSave({ kind: 'error', reason: quota ? 'quota' : 'other' });
    }
    focusNotice();
  };

  return (
    <div className="rw-shell">
      <header className="rw-top"><div className="rw-top-in">
        <Link href="/" className="rw-mark">RoomWitness</Link>
        <Link href="/" className="rw-toplink">หน้าหลัก · Home</Link>
      </div></header>

      <div className="rw-page">
        <div className="rw-head">
          <h1 className="rw-h1">เก็บหลักฐานตั้งแต่วันแรก</h1>
          <p className="rw-sub">ถ่ายภาพผนัง พื้น เฟอร์นิเจอร์ และร่องรอยที่มีอยู่แล้ว <span lang="en">· Capture walls, floors, furniture and any existing damage.</span></p>
        </div>

        <main className="rw-main">
          <section className="rw-group" aria-labelledby="g-record">
            <h2 id="g-record" className="rw-gt"><span>บันทึกตอนเข้าอยู่ <span lang="en">· Move-in record</span></span></h2>
            <div className="rw-fields">
              <div className="rw-field">
                <label className="rw-label" htmlFor="movein-label">ชื่อห้องหรือที่พัก <span lang="en">· Property nickname</span></label>
                <input id="movein-label" className="rw-input" type="text" data-testid="movein-label" placeholder="เช่น ห้อง 12B · Room 12B" value={label} onChange={e => setLabel(e.target.value)} />
              </div>
              <input ref={inputRef} type="file" accept="image/*" multiple className="dz-input" tabIndex={-1} aria-hidden="true" data-testid="movein-photos"
                onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
              <div className="rw-field">
                <span className="rw-label">ภาพห้อง <span lang="en">· Room photos</span></span>
                <div className="rw-thumbs">
                  {prevs.map((src, i) => (
                    <div key={i} className="rw-thumb photo-thumb">
                      <img src={src} alt={`ภาพห้อง ${i + 1} · Room photo ${i + 1}`} />
                      <button type="button" className="rw-btn icon" aria-label={`ลบภาพ ${i + 1} · Remove photo ${i + 1}`} onClick={() => removeFile(i)}><CloseGlyph /></button>
                    </div>
                  ))}
                  <button type="button" className="rw-addtile" onClick={() => inputRef.current?.click()}>
                    <PlusGlyph />
                    <span>{prevs.length === 0 ? <>เพิ่มรูป <span lang="en">· Add</span></> : <>เพิ่มอีก <span lang="en">· More</span></>}</span>
                  </button>
                </div>
              </div>
            </div>
          </section>

          {save.kind === 'saved' ? (
            <div ref={noticeRef} tabIndex={-1} className="rw-notice" role="status" data-testid="movein-saved">
              <StepDoneGlyph size={24} />
              <div>
                <p><b>บันทึกแล้ว</b> รูปอยู่ในเบราว์เซอร์เครื่องนี้เท่านั้น โปรดเก็บไฟล์ต้นฉบับไว้ด้วย</p>
                <p className="rw-rd" lang="en">Saved. Photos stay in this browser on this device only. Keep your original files.</p>
                <Link href="/app" className="rw-btn start" data-testid="movein-continue">ไปสร้างเคส <span lang="en">· Continue to case</span></Link>
              </div>
            </div>
          ) : (
            <>
              {save.kind === 'error' && (
                <div ref={noticeRef} tabIndex={-1} className="rw-err" role="alert" data-testid="movein-error">
                  <StepFailGlyph size={20} />
                  <span>
                    {save.reason === 'empty' && <>เพิ่มรูปอย่างน้อย 1 รูปก่อนบันทึก <span lang="en">· Add at least one photo first.</span></>}
                    {save.reason === 'quota' && <>พื้นที่ในเบราว์เซอร์เต็ม ลองลดจำนวนรูปหรือใช้รูปขนาดเล็กลง <span lang="en">· This browser&apos;s storage is full. Try fewer or smaller photos.</span></>}
                    {save.reason === 'other' && <>บันทึกในเบราว์เซอร์นี้ไม่สำเร็จ <span lang="en">· Couldn&apos;t save in this browser.</span></>}
                  </span>
                </div>
              )}
              <button type="button" className="rw-btn start" data-testid="movein-save" onClick={saveRecord}>
                บันทึกรูปเข้าอยู่ <span lang="en">· Save move-in record</span>
              </button>
            </>
          )}
        </main>

        <aside className="rw-aside">
          <p className="rw-short"><InfoGlyph /><span>รูปถูกบันทึกในเบราว์เซอร์บนอุปกรณ์นี้ โปรดเก็บต้นฉบับไว้ด้วย <span lang="en">· Photos are saved in this browser on this device. Keep your original copies.</span></span></p>
        </aside>
      </div>
    </div>
  );
}
