'use client';

import { useState, useEffect, useRef, CSSProperties } from 'react';
import Link from 'next/link';
import DropZone from '@/components/DropZone';
import ClaimsList from '@/components/ClaimsList';
import Pipeline from '@/components/Pipeline';
import { Claim, PipelineResults, StepState } from '@/types';
import { getMoveInRecords, dataUrlToFile, MoveInRecord } from '@/lib/moveInVault';
import { CameraIcon, FileTextIcon, ScaleIcon, StackIcon, LockIcon } from '@/components/icons';

const IDLE_STEPS: StepState[] = ['idle', 'idle', 'idle', 'idle'];

// Mirrors roomwitness-app/src/app/new-case.tsx's 4-step wizard, accent-for-accent.
const WIZ_STEPS = [
  { headline: 'เจ้าของบ้านหักค่าอะไรบ้าง?', sub: 'Landlord deductions · Add each claim below', accent: 'var(--amber-dark)' },
  { headline: 'เปรียบเทียบภาพห้องของคุณ', sub: 'Photo evidence · Move-in vs move-out (optional)', accent: 'var(--blue)' },
  { headline: 'เพิ่มหลักฐานประกอบ', sub: 'Supporting evidence · Contract and messages (optional)', accent: 'var(--green)' },
  { headline: 'ตรวจสอบข้อมูลก่อนวิเคราะห์', sub: 'Review your case · Before AI analysis', accent: 'var(--purple)' },
];

// Line items sum to the flat ฿99 charged once per claim — metered like a real API bill.
const LINE_ITEMS = [
  { Icon: CameraIcon, label: 'เปรียบเทียบภาพถ่าย', sub: 'Photo comparison · Move-in vs move-out', price: 25 },
  { Icon: FileTextIcon, label: 'ตรวจข้อสัญญาเช่า', sub: 'Contract review · Lease text extraction', price: 20 },
  { Icon: ScaleIcon, label: 'วิเคราะห์ข้อกฎหมาย', sub: 'Legal assessment · ป.พ.พ. + สคบ.', price: 24 },
  { Icon: StackIcon, label: 'จัดทำเอกสารภาษาไทย', sub: 'Document generation · 3 Thai documents', price: 30 },
];
const TOTAL_PRICE = LINE_ITEMS.reduce((s, i) => s + i.price, 0);

export default function AppPage() {
  // ── Form state ──────────────────────────────────────────────────
  const [moveInFiles,  setMoveInFiles]  = useState<File[]>([]);
  const [moveOutFiles, setMoveOutFiles] = useState<File[]>([]);
  const [moveInPrevs,  setMoveInPrevs]  = useState<string[]>([]);
  const [moveOutPrevs, setMoveOutPrevs] = useState<string[]>([]);
  const [claims, setClaims] = useState<Claim[]>([
    { claim_id: 'C001', item: '', description: '', amount_thb: 0 },
  ]);

  // Extras
  const [contractFile,    setContractFile]    = useState<File | null>(null);
  const [contractClause,  setContractClause]  = useState('');
  const [leaseStart,      setLeaseStart]      = useState('');
  const [leaseEnd,        setLeaseEnd]        = useState('');
  const [depositAmount,   setDepositAmount]   = useState('');
  const [monthlyRent,     setMonthlyRent]     = useState('');
  const [unitCount,       setUnitCount]       = useState('0');
  const [screenshots,     setScreenshots]     = useState<File[]>([]);
  const [screenshotPrevs, setScreenshotPrevs] = useState<string[]>([]);
  const [landlordPromises, setLandlordPromises] = useState('');
  const [tenantPromises,   setTenantPromises]   = useState('');

  // ── UI state ────────────────────────────────────────────────────
  const [corpusLoaded, setCorpusLoaded] = useState<boolean | null>(null);
  const [running,   setRunning]   = useState(false);
  const [elapsed,   setElapsed]   = useState(0);
  const [error,     setError]     = useState<string | null>(null);
  const [showPipeline, setShowPipeline] = useState(false);
  const [steps,   setSteps]   = useState<StepState[]>(IDLE_STEPS);
  const [results, setResults] = useState<PipelineResults>({});

  // ── Wizard step ─────────────────────────────────────────────────
  const [step, setStep] = useState(0);

  // ── Move-in vault (free, saved earlier) + paywall (paid claim step) ──
  const [moveInRecords, setMoveInRecords] = useState<MoveInRecord[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [unlockedClaim, setUnlockedClaim] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    const records = getMoveInRecords();
    setMoveInRecords(records);
    if (records[0]) selectRecord(records[0].id, records);
  }, []);

  const selectRecord = (id: string | null, records = moveInRecords) => {
    setSelectedRecordId(id);
    const rec = id ? records.find(r => r.id === id) : undefined;
    if (!rec) { setMoveInFiles([]); setMoveInPrevs([]); return; }
    setMoveInPrevs(rec.photoDataUrls);
    Promise.all(rec.photoDataUrls.map((u, i) => dataUrlToFile(u, `movein_${i}.jpg`))).then(setMoveInFiles);
  };

  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const moveInInputRef   = useRef<HTMLInputElement>(null);
  const moveOutInputRef  = useRef<HTMLInputElement>(null);
  const extractBtnRef    = useRef<HTMLButtonElement>(null);

  const makePreviews = (files: File[], setPrevs: (p: string[]) => void) => {
    const readers = files.map(f => new Promise<string>(resolve => {
      if (!f.type.startsWith('image/')) { resolve(''); return; }
      const r = new FileReader();
      r.onload = e => resolve(e.target?.result as string ?? '');
      r.readAsDataURL(f);
    }));
    Promise.all(readers).then(setPrevs);
  };

  const addMoveIn = (incoming: FileList | null) => {
    if (!incoming) return;
    const imgs = Array.from(incoming).filter(f => f.type.startsWith('image/'));
    setMoveInFiles(prev => {
      const next = [...prev, ...imgs];
      makePreviews(next, setMoveInPrevs);
      return next;
    });
  };
  const removeMoveIn = (i: number) => {
    setMoveInFiles(prev => { const n = prev.filter((_, idx) => idx !== i); makePreviews(n, setMoveInPrevs); return n; });
  };

  const addMoveOut = (incoming: FileList | null) => {
    if (!incoming) return;
    const imgs = Array.from(incoming).filter(f => f.type.startsWith('image/'));
    setMoveOutFiles(prev => {
      const next = [...prev, ...imgs];
      makePreviews(next, setMoveOutPrevs);
      return next;
    });
  };
  const removeMoveOut = (i: number) => {
    setMoveOutFiles(prev => { const n = prev.filter((_, idx) => idx !== i); makePreviews(n, setMoveOutPrevs); return n; });
  };

  // ── Health check ─────────────────────────────────────────────────
  useEffect(() => {
    fetch('/health')
      .then(r => r.json())
      .then(d => setCorpusLoaded(!!d.corpus_loaded))
      .catch(() => setCorpusLoaded(false));
  }, []);

  // ── Elapsed seconds while the pipeline runs ──────────────────────
  useEffect(() => {
    if (!running) return;
    setElapsed(0);
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  // ── Screenshot upload ────────────────────────────────────────────
  const addScreenshots = (files: FileList | File[]) => {
    const imgs = Array.from(files).filter(f => f.type.startsWith('image/'));
    setScreenshots(prev => [...prev, ...imgs]);
    imgs.forEach(f => {
      const r = new FileReader();
      r.onload = e => setScreenshotPrevs(prev => [...prev, e.target?.result as string]);
      r.readAsDataURL(f);
    });
  };
  const removeScreenshot = (i: number) => {
    setScreenshots(prev => prev.filter((_, idx) => idx !== i));
    setScreenshotPrevs(prev => prev.filter((_, idx) => idx !== i));
  };

  // ── Contract PDF extraction ──────────────────────────────────────
  const extractContract = async () => {
    if (!contractFile) return;
    const btn = extractBtnRef.current;
    if (btn) { btn.textContent = 'Extracting…'; btn.disabled = true; }
    try {
      const fd = new FormData();
      fd.append('contract_file', contractFile);
      const d = await fetch('/extract-contract', { method: 'POST', body: fd }).then(r => r.json());
      if (d.error) throw new Error(d.error);
      setContractClause(d.text);
      if (btn) btn.textContent = '✓ Done';
    } catch (err: any) {
      if (btn) btn.textContent = 'Failed';
      alert(err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        setTimeout(() => { if (btn) btn.textContent = 'Extract ↑'; }, 3000);
      }
    }
  };

  // ── Pipeline step helpers ─────────────────────────────────────────
  const setStepState = (i: number, state: StepState) =>
    setSteps(prev => prev.map((s, idx) => idx === i ? state : s));

  // ── Wizard nav ──────────────────────────────────────────────────
  const validClaims = claims.filter(c => c.item.trim());
  function goNext() {
    if (step === 0 && !validClaims.length) { setError('Add at least one claim.'); return; }
    setError(null);
    if (step < 3) setStep(s => s + 1);
  }
  function goBack() {
    if (step > 0) setStep(s => s - 1);
  }

  // ── Submit ────────────────────────────────────────────────────────
  function requestAnalysis() {
    if (!validClaims.length) { setError('Add at least one claim.'); return; }
    setError(null);
    // Upload + claim entry are free; running the AI + generating documents is the paid step.
    if (!unlockedClaim) { setShowPaywall(true); return; }
    runPipeline(validClaims);
  }

  function pay() {
    setPaying(true);
    // No real payment provider wired up yet — demo stand-in for the metered, pay-per-claim gate.
    setTimeout(() => {
      setPaying(false);
      setUnlockedClaim(true);
      setShowPaywall(false);
      runPipeline(validClaims);
    }, 900);
  }

  const runPipeline = async (validClaims: Claim[]) => {
    setRunning(true);
    setShowPipeline(true);
    setSteps(IDLE_STEPS);
    setResults({});

    setTimeout(() => {
      document.getElementById('pipeline')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);

    try {
      setStepState(0, 'active');
      const fd1 = new FormData();
      moveInFiles.forEach(f  => fd1.append('move_in',  f));
      moveOutFiles.forEach(f => fd1.append('move_out', f));
      fd1.append('claims', JSON.stringify(validClaims));
      const d1 = await fetch('/run/agent01', { method: 'POST', body: fd1 }).then(r => r.json());
      if (d1.error) throw new Error(`Agent 01: ${d1.error}`);
      setResults(prev => ({ ...prev, agent01: d1 }));
      setStepState(0, 'done');

      setStepState(1, 'active');
      const fd2 = new FormData();
      fd2.append('claims',           JSON.stringify(validClaims));
      fd2.append('contract_clause',  contractClause);
      fd2.append('lease_start',      leaseStart);
      fd2.append('lease_end',        leaseEnd);
      fd2.append('deposit_amount',   depositAmount || '0');
      fd2.append('monthly_rent',     monthlyRent   || '0');
      fd2.append('manual_landlord_promises', landlordPromises);
      fd2.append('manual_tenant_promises',   tenantPromises);
      if (contractFile) fd2.append('contract_file', contractFile);
      screenshots.forEach(f => fd2.append('screenshots', f));
      const d2 = await fetch('/run/agent02', { method: 'POST', body: fd2 }).then(r => r.json());
      if (d2.error) throw new Error(`Agent 02: ${d2.error}`);
      setResults(prev => ({ ...prev, agent02: d2 }));
      setStepState(1, 'done');

      setStepState(2, 'active');
      const d3 = await fetch('/run/agent03', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claims: validClaims,
          damage_map:          d1.damage_map ?? [],
          contract_clause:     contractClause,
          landlord_unit_count: parseInt(unitCount) || 0,
          has_void_clause:     (d2.unfair_clauses ?? []).length > 0,
        }),
      }).then(r => r.json());
      if (d3.error) throw new Error(`Agent 03: ${d3.error}`);
      setResults(prev => ({ ...prev, agent03: d3 }));
      setStepState(2, 'done');

      setStepState(3, 'active');
      const d4 = await fetch('/run/agent04', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documents_to_generate: d3.documents_to_generate ?? ['demand_letter', 'evidence_summary'],
          total_unlawful_thb:    d3.total_unlawful_thb ?? 0,
          verdicts:              d3.verdicts ?? [],
          case_summary_th:       d3.case_summary_th ?? '',
          case_summary_en:       d3.case_summary_en ?? '',
          claims:                validClaims,
        }),
      }).then(r => r.json());
      if (d4.error) throw new Error(`Agent 04: ${d4.error}`);
      setResults(prev => ({ ...prev, agent04: d4 }));
      setStepState(3, 'done');

    } catch (err: any) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  const corpusPillClass = corpusLoaded === null
    ? 'corpus-pill corpus-loading'
    : corpusLoaded ? 'corpus-pill corpus-ok' : 'corpus-pill corpus-err';
  const corpusPillText = corpusLoaded === null
    ? 'checking'
    : corpusLoaded ? '✓ Corpus ready' : '✗ Corpus missing';

  const totalCharged = claims.reduce((s, c) => s + (c.amount_thb || 0), 0);
  const s = WIZ_STEPS[step];

  // ── Paywall (invoice-style, own screen — like the mobile app's /paywall) ──
  if (showPaywall) {
    return (
      <>
        <header><div className="header-inner"><div><h1>RoomWitness</h1></div></div></header>
        <div className="paywall-wrap">
          <button className="wiz-back" onClick={() => setShowPaywall(false)} style={{ marginBottom: 20 }}>← ย้อนกลับ · Back</button>
          <div className="paywall-lock"><LockIcon size={26} color="var(--amber-dark)" /></div>
          <div className="paywall-title">เตรียมเอกสารเพื่อเรียกคืนเงินประกัน<span className="h2-en">Prepare your deposit claim</span></div>
          <p className="paywall-sub">
            บันทึกรูปและกรอกรายการได้ฟรี ชำระครั้งเดียวเพื่อวิเคราะห์และสร้างเอกสาร<br />
            One payment for AI analysis and document generation.
          </p>
          <div className="invoice-card">
            <div className="invoice-meta">
              <span>{validClaims.length} claim{validClaims.length !== 1 ? 's' : ''} · ฿{totalCharged.toLocaleString()} disputed</span>
              <em>ชำระครั้งเดียว · One-time</em>
            </div>
            <div className="invoice-total">฿{TOTAL_PRICE}</div>
            {LINE_ITEMS.map((f, i) => (
              <div key={i} className="invoice-line">
                <div className="invoice-line-icon"><f.Icon size={14} color="var(--green)" /></div>
                <div className="invoice-line-text"><b>{f.label}</b><span>{f.sub}</span></div>
                <div className="invoice-line-price">฿{f.price}</div>
              </div>
            ))}
            <div className="invoice-total-row"><span>ยอดชำระครั้งเดียว · Total</span><span>฿{TOTAL_PRICE}</span></div>
          </div>
          <button className="paywall-pay-btn" onClick={pay} disabled={paying}>
            {paying ? 'กำลังดำเนินการ · Processing…' : `ชำระ ฿${TOTAL_PRICE} และวิเคราะห์ · Pay & analyze`}
          </button>
          <button className="paywall-cancel" onClick={() => setShowPaywall(false)}>ยกเลิก · Cancel</button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className={showPipeline ? 'case-flow is-analyzing' : 'case-flow'} style={{ '--wiz-accent': s.accent } as CSSProperties}>
        <div className="wiz-header">
          <div className="wiz-brand">RoomWitness<span>ผู้ช่วยเรื่องเงินประกันเช่า<small>Rental deposit disputes</small></span></div>
          <div className="wiz-topline">
            <Link href="/" className="wiz-back">← หน้าหลัก · Home</Link>
            <span className="wiz-step-pill">ขั้นตอน {step + 1} / 4 · Step {step + 1}</span>
          </div>
          <div className="wiz-progress">
            {['รายการหักเงิน|Claims', 'ภาพถ่าย|Photos', 'หลักฐานเพิ่มเติม|Extras', 'ตรวจสอบ|Review'].map((label, i) => (
              <div key={i} className={`wiz-progress-seg ${i <= step ? 'on' : ''} ${i === step ? 'current' : ''}`} aria-current={i === step ? 'step' : undefined}>
                <span className="wiz-progress-number">{i < step ? '✓' : i + 1}</span>
                <span>{label.split('|')[0]}<small>{label.split('|')[1]}</small></span>
              </div>
            ))}
          </div>
          <div className="wiz-title-row">
            <div>
              <div className="wiz-headline">{s.headline}</div>
              <div className="wiz-sub">{s.sub}</div>
            </div>
            <div className="wiz-badge">{step + 1}</div>
          </div>
        </div>

        <main className="wiz-body">
          <div className="case-editor">
          {/* ── Step 0: Claims ─────────────────────────── */}
          {step === 0 && (
            <>
              <ClaimsList claims={claims} onChange={setClaims} />
              <p className="privacy-note">
                🔒 รูปภาพ สัญญาเช่า และข้อความที่คุณอัปโหลดใช้เพื่อประมวลผลคดีของคุณเท่านั้น ไม่เปิดเผยต่อบุคคลที่สาม
                ระบบเก็บบันทึกสรุปผลวิเคราะห์ (ไม่รวมภาพต้นฉบับ) ไว้ 90 วันเพื่อการตรวจสอบย้อนหลัง
                <br />
                <span className="privacy-note-en">Your photos, lease, and messages are used only to process your case and are never shared with third parties. A summary record (not original photos) is kept for 90 days for audit purposes.</span>
              </p>
            </>
          )}

          {/* ── Step 1: Photos ─────────────────────────── */}
          {step === 1 && (
            <section className="card">
              <input ref={moveInInputRef}  type="file" accept="image/*" multiple className="dz-input"
                onChange={e => { addMoveIn(e.target.files);  e.target.value = ''; }} />
              <input ref={moveOutInputRef} type="file" accept="image/*" multiple className="dz-input"
                onChange={e => { addMoveOut(e.target.files); e.target.value = ''; }} />

              <div className="photo-columns">
                <div className="photo-col">
                  <div className="photo-col-label">ภาพเมื่อเข้าอยู่<span className="h2-en">Move-in</span></div>
                  {moveInRecords.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                      {moveInRecords.map(r => (
                        <button key={r.id} type="button" className="btn-secondary"
                          style={selectedRecordId === r.id ? { borderColor: 'var(--green)', color: 'var(--green)' } : undefined}
                          onClick={() => selectRecord(selectedRecordId === r.id ? null : r.id)}>
                          {r.label} · {r.photoDataUrls.length}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="photo-thumb-grid">
                    {moveInPrevs.map((src, i) => (
                      <div key={i} className="photo-thumb">
                        <img src={src} alt="" />
                        {moveInRecords.length === 0 && <div className="dz-filename">{moveInFiles[i]?.name}</div>}
                        {moveInRecords.length === 0 && (
                          <button type="button" className="thumb-remove" onClick={() => removeMoveIn(i)}>✕</button>
                        )}
                      </div>
                    ))}
                    {moveInRecords.length === 0 && (
                      <button type="button" className="photo-add-btn" onClick={() => moveInInputRef.current?.click()}>
                        <span>+</span><span>เพิ่มรูป · Add</span>
                      </button>
                    )}
                  </div>
                  {moveInRecords.length === 0 && (
                    <Link href="/move-in" style={{ fontSize: 12, color: 'var(--blue)', marginTop: 6, display: 'inline-block' }}>
                      บันทึกรูปวันเข้าอยู่ได้ฟรี · Save move-in photos →
                    </Link>
                  )}
                </div>

                <div className="photo-col">
                  <div className="photo-col-label">ภาพเมื่อย้ายออก<span className="h2-en">Move-out</span></div>
                  <div className="photo-thumb-grid">
                    {moveOutPrevs.map((src, i) => (
                      <div key={i} className="photo-thumb">
                        <img src={src} alt="" />
                        <div className="dz-filename">{moveOutFiles[i]?.name}</div>
                        <button type="button" className="thumb-remove" onClick={() => removeMoveOut(i)}>✕</button>
                      </div>
                    ))}
                    <button type="button" className="photo-add-btn" onClick={() => moveOutInputRef.current?.click()}>
                      <span>+</span><span>เพิ่มรูป · Add</span>
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ── Step 2: Extras ─────────────────────────── */}
          {step === 2 && (
            <>
              <section className="card">
                <h2>สัญญาเช่า<span className="h2-en">Rental contract</span></h2>
                <div className="contract-upload-row">
                  <DropZone
                    label="อัปโหลดสัญญา · PDF / image" sublabel="อ่านข้อความอัตโนมัติ · Auto-extract text" accept=".pdf,image/*"
                    file={contractFile} onFile={setContractFile} className="drop-zone-doc" minHeight="70px"
                  />
                  <div className="contract-text-wrap">
                    <div className="contract-extract-row">
                      <label>ข้อสัญญาที่เกี่ยวข้อง <span className="lbl-en">Relevant clause</span></label>
                      {contractFile && <button ref={extractBtnRef} type="button" className="btn-extract" onClick={extractContract}>อ่านข้อความ · Extract</button>}
                    </div>
                    <textarea rows={4} placeholder="Paste a clause, or upload above to auto-extract."
                      value={contractClause} onChange={e => setContractClause(e.target.value)} />
                  </div>
                </div>
                <div className="contract-meta-grid">
                  <div className="field"><label>วันเริ่มสัญญา <span className="lbl-en">Lease start</span></label><input type="date" value={leaseStart} onChange={e => setLeaseStart(e.target.value)} /></div>
                  <div className="field"><label>วันสิ้นสุดสัญญา <span className="lbl-en">Lease end</span></label><input type="date" value={leaseEnd} onChange={e => setLeaseEnd(e.target.value)} /></div>
                  <div className="field"><label>เงินประกัน (฿) <span className="lbl-en">Deposit paid</span></label><input type="number" min="0" placeholder="20000" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} /></div>
                  <div className="field"><label>ค่าเช่าต่อเดือน (฿) <span className="lbl-en">Monthly rent</span></label><input type="number" min="0" placeholder="10000" value={monthlyRent} onChange={e => setMonthlyRent(e.target.value)} /></div>
                  <div className="field"><label>จำนวนห้องของผู้ให้เช่า <span className="lbl-en">Units (0 = unknown)</span></label><input type="number" min="0" placeholder="5" value={unitCount} onChange={e => setUnitCount(e.target.value)} /></div>
                </div>
              </section>

              <section className="card">
                <h2>ภาพแชทสนทนา <span className="h2-en">Chat screenshots · LINE / WhatsApp / SMS</span></h2>
                <div className="screenshot-dz" onClick={() => screenshotInputRef.current?.click()}>
                  <input ref={screenshotInputRef} type="file" accept="image/*" multiple className="dz-input"
                    onChange={e => { if (e.target.files) addScreenshots(e.target.files); e.target.value = ''; }} />
                  {screenshotPrevs.length === 0 ? (
                    <div className="screenshot-dz-placeholder">
                      <strong>เพิ่มภาพแชท · Add screenshots</strong>
                      <span>เลือกได้หลายไฟล์ · Multiple files accepted</span>
                      <button type="button" className="btn-secondary" onClick={e => { e.stopPropagation(); screenshotInputRef.current?.click(); }}>เลือกไฟล์ · Browse</button>
                    </div>
                  ) : (
                    <div className="screenshot-grid">
                      {screenshotPrevs.map((src, i) => (
                        <div key={i} className="screenshot-thumb">
                          <img src={src} alt="" />
                          <button type="button" className="thumb-remove" onClick={e => { e.stopPropagation(); removeScreenshot(i); }}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section className="card">
                <h2>ข้อตกลงเป็นลายลักษณ์อักษร<span className="h2-en">Written promises</span></h2>
                <div className="two-col">
                  <div className="field">
                    <label>เจ้าของบ้านตกลงไว้ <span className="lbl-en">Landlord promises</span></label>
                    <textarea rows={4} placeholder='"I will return deposit in full if room is clean"' value={landlordPromises} onChange={e => setLandlordPromises(e.target.value)} />
                  </div>
                  <div className="field">
                    <label>คุณได้แจ้งหรือตกลงไว้ <span className="lbl-en">Your statements</span></label>
                    <textarea rows={4} placeholder='"Wall scuff was already there at move-in"' value={tenantPromises} onChange={e => setTenantPromises(e.target.value)} />
                  </div>
                </div>
              </section>
            </>
          )}

          {/* ── Step 3: Review ─────────────────────────── */}
          {step === 3 && (
            <>
              <div className="review-hero">
                <div className="review-hero-label">ยอดหักเงินที่ต้องการตรวจสอบ<span className="h2-en">Total disputed</span></div>
                <div className="review-hero-amount">฿{totalCharged.toLocaleString()}</div>
                <div className="review-stat-row">
                  <div className="review-stat"><b>{validClaims.length}</b><span>รายการ · Claims</span></div>
                  <div className="review-stat"><b>{moveInPrevs.length}</b><span>รูปเข้าอยู่ · Move-in</span></div>
                  <div className="review-stat"><b>{moveOutPrevs.length}</b><span>รูปย้ายออก · Move-out</span></div>
                </div>
              </div>
              <section className="card review-claims">
                <div className="section-title-row">
                  <h2>รายการที่ส่งวิเคราะห์<span className="h2-en">Claims to assess</span></h2>
                  <button className="text-button" onClick={() => setStep(0)}>แก้ไข · Edit</button>
                </div>
                {validClaims.map(c => (
                  <div className="review-claim" key={c.claim_id}>
                    <div><strong>{c.item}</strong><p>{c.description || '—'}</p></div>
                    <b>฿{c.amount_thb.toLocaleString()}</b>
                  </div>
                ))}
                <div className="review-evidence-links">
                  <button className="text-button" onClick={() => setStep(1)}>แก้ไขรูปถ่าย · Edit photos</button>
                  <button className="text-button" onClick={() => setStep(2)}>แก้ไขหลักฐาน · Edit evidence</button>
                </div>
              </section>
              <div className="review-agents">
                <div className="review-agents-label">ตรวจสอบหลักฐาน 4 ขั้นตอน<span className="h2-en">Your AI analysis includes</span></div>
                {[
                  { n: '01', l: 'เปรียบเทียบภาพ · Photo comparison', c: 'var(--blue)' },
                  { n: '02', l: 'ตรวจสัญญาเช่า · Contract review', c: 'var(--purple)' },
                  { n: '03', l: 'วิเคราะห์กฎหมาย · Legal assessment', c: 'var(--green)' },
                  { n: '04', l: 'จัดทำเอกสาร · Thai PDF documents', c: 'var(--amber-dark)' },
                ].map(a => (
                  <div key={a.n} className="review-agent-row">
                    <div className="review-agent-num" style={{ background: a.c }}>{a.n}</div>
                    <span>{a.l}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {error && <div className="error-banner">⚠ {error}</div>}
          </div>
          <aside className="case-brief" aria-label="Case summary">
            <div className="brief-heading"><ScaleIcon size={22} /><span>แฟ้มข้อพิพาทของคุณ<small>Your case file</small></span></div>
            <div className="brief-total"><span>ยอดหักเงิน · Deductions</span><strong>฿{totalCharged.toLocaleString()}</strong></div>
            <dl className="brief-evidence">
              <div><dt>รายการหักเงิน<small>Claims</small></dt><dd>{validClaims.length}</dd></div>
              <div><dt>ภาพเมื่อเข้าอยู่<small>Move-in photos</small></dt><dd>{moveInPrevs.length}</dd></div>
              <div><dt>ภาพเมื่อย้ายออก<small>Move-out photos</small></dt><dd>{moveOutPrevs.length}</dd></div>
              <div><dt>สัญญาเช่า<small>Rental contract</small></dt><dd>{contractFile || contractClause.trim() ? '✓' : '—'}</dd></div>
              <div><dt>ภาพแชท<small>Chat screenshots</small></dt><dd>{screenshotPrevs.length}</dd></div>
            </dl>
            <div className="brief-guidance">
              <strong>{['เริ่มจากรายการที่ถูกหัก', 'เห็นความเปลี่ยนแปลงชัดขึ้น', 'ทุกข้อตกลงเป็นหลักฐานได้', 'ตรวจสอบก่อนดำเนินการ'][step]}</strong>
              <p>{[
                'กรอกแต่ละรายการตามที่เจ้าของบ้านแจ้ง พร้อมยอดเงินที่เรียกเก็บ',
                'ใช้ภาพมุมเดียวกันก่อนและหลังเช่า หากไม่มีภาพ สามารถข้ามขั้นตอนนี้ได้',
                'แนบสัญญาหรือข้อความที่เกี่ยวข้อง หากไม่มี สามารถดำเนินการต่อได้',
                'ตรวจสอบยอดเงิน รายการ และหลักฐาน คุณสามารถย้อนกลับไปแก้ไขได้',
              ][step]}</p>
              <small>{[
                'Use the deduction list provided by your landlord, with the amount for each item.',
                'Matching camera angles help comparison. You can continue without photos.',
                'Add relevant lease terms or messages. Supporting evidence is optional.',
                'Check the amounts and evidence. You can edit each section before analysis.',
              ][step]}</small>
            </div>
            <div className="brief-price">วิเคราะห์และจัดทำเอกสาร <b>฿{TOTAL_PRICE}</b><small>Analysis & documents · One-time payment</small></div>
          </aside>
        </main>

        <div className="wiz-footer">
          <div className="wiz-footer-row">
            {step > 0 && <button className="btn-secondary" onClick={goBack}>ย้อนกลับ · Back</button>}
            {step < 3 ? (
              <button className="wiz-btn-next" onClick={goNext}>ถัดไป · Continue →</button>
            ) : (
              <button className="wiz-btn-next" onClick={requestAnalysis} disabled={running}>
                {running ? <><span className="spinner-btn" />กำลังวิเคราะห์ · Analyzing… {elapsed}s</> : 'ดำเนินการวิเคราะห์ · Continue to analysis →'}
              </button>
            )}
          </div>
        </div>
      </div>

      {showPipeline && (
        <>
        <header className="analysis-header"><div className="header-inner">
          <Link href="/" className="analysis-brand">RoomWitness</Link>
          <div className="analysis-toolbar">
            {running ? <span className="analysis-live"><span />กำลังวิเคราะห์ · {elapsed}s</span> : <button className="btn-secondary" onClick={() => setShowPipeline(false)}>กลับไปตรวจสอบ · Back to review</button>}
          </div>
        </div></header>
        {error && <div className="analysis-error error-banner" role="alert">{error}</div>}
        <Pipeline
          steps={steps}
          results={results}
          moveInPreviews={moveInPrevs}
          moveOutPreviews={moveOutPrevs}
          depositAmount={depositAmount}
        />
        </>
      )}
    </>
  );
}
