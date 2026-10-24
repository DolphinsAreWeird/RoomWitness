'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import DropZone from '@/components/DropZone';
import ClaimsList from '@/components/ClaimsList';
import Pipeline from '@/components/Pipeline';
import { Disclaimer } from '@/components/Disclaimer';
import { Claim, PipelineResults, StepState } from '@/types';
import { getMoveInRecords, dataUrlToFile, MoveInRecord } from '@/lib/moveInVault';
import { BuildingType, DEFAULT_UNITS, DORM_NOTE, ROLES, ROLE_COPY, Role, isLandlordSide, parseRole, roleHref } from '@/lib/roles';
import { ChevronGlyph, CloseGlyph, DocGlyph, InfoGlyph, LockGlyph, PlusGlyph, StepFailGlyph, StepIdleGlyph } from '@/components/icons';

type ExtractState = 'idle' | 'extracting' | 'done' | 'failed';
const EXTRACT_LABEL: Record<ExtractState, string> = {
  idle:       'อ่านข้อความ · Extract',
  extracting: 'กำลังอ่าน… · Reading…',
  done:       'อ่านแล้ว · Done',
  failed:     'อ่านไม่สำเร็จ · Failed',
};

const IDLE_STEPS: StepState[] = ['idle', 'idle', 'idle', 'idle'];

// One headline per wizard step; the stepper uses th/en.
const WIZ_STEPS = [
  { headline: 'เจ้าของบ้านหักค่าอะไรบ้าง?',   sub: 'List each deduction your landlord made.',               th: 'รายการหัก', en: 'Deductions' },
  { headline: 'เปรียบเทียบภาพห้องของคุณ',     sub: 'Move-in and move-out photos. Optional, but they help.', th: 'ภาพถ่าย',   en: 'Photos' },
  { headline: 'เพิ่มหลักฐานประกอบ',          sub: 'Your lease and messages. Optional.',                     th: 'หลักฐาน',   en: 'Evidence' },
  { headline: 'ตรวจสอบก่อนเริ่มวิเคราะห์',     sub: 'Check your case before the analysis starts.',           th: 'ตรวจสอบ',   en: 'Review' },
];

// The five analysis steps, as previewed on the Review step (Pipeline shows them live).
const PLAN_PREVIEW = [
  { th: 'เทียบภาพก่อน–หลัง', sd: 'ภาพวันเข้าอยู่และวันย้ายออก · Move-in and move-out photos' },
  { th: 'อ่านสัญญาเช่า',      sd: 'ข้อสัญญาเรื่องเงินประกัน · The deposit clauses' },
  { th: 'ตรวจตามกฎหมาย',     sd: 'ป.พ.พ. และประกาศ สคบ. 2568 · CCC and OCPB 2568' },
  { th: 'ยืนยันโดยคุณ',       sd: 'คุณตรวจผลก่อนสร้างเอกสาร · You approve first' },
  { th: 'จัดทำเอกสาร',        sd: 'เอกสารภาษาไทย · Thai PDFs' },
];

// Landlord and property-business wording: same steps, seen from the side that deducts.
const OWNER_WIZ_STEPS = [
  { headline: 'คุณจะหักค่าอะไรบ้าง?',          sub: 'List each deduction you plan to make. We check it before your tenant does.', th: 'รายการหัก', en: 'Deductions' },
  { headline: 'เปรียบเทียบภาพห้องก่อนและหลังเช่า', sub: 'Move-in and move-out photos of the unit. Your strongest proof.',          th: 'ภาพถ่าย',   en: 'Photos' },
  { headline: 'เพิ่มสัญญาและข้อมูลห้อง',        sub: 'The lease, the unit and any messages. Optional.',                         th: 'หลักฐาน',   en: 'Evidence' },
  { headline: 'ตรวจสอบก่อนเริ่มวิเคราะห์',       sub: 'Check the deductions before the analysis starts.',                       th: 'ตรวจสอบ',   en: 'Review' },
];
const OWNER_PLAN_PREVIEW = [
  ...PLAN_PREVIEW.slice(0, 3),
  { th: 'ยืนยันโดยคุณ',      sd: 'คุณเลือกรายการก่อนออกใบแจ้ง · You choose what to keep first' },
  { th: 'ออกใบแจ้งรายการหัก', sd: 'ใบแจ้งหักเงินประกันพร้อมข้อกฎหมาย · A law-cited deduction statement' },
];

export default function AppPage({ searchParams }: { searchParams?: { role?: string | string[] } }) {
  // ── Who is using it (?role=landlord|business; no query = tenant) ──
  const [role, setRole] = useState<Role>(() => parseRole(searchParams?.role));
  const owner = isLandlordSide(role);

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
  const [unitCount,       setUnitCount]       = useState(() => DEFAULT_UNITS[role]);
  // Owner-side only: shown on the deduction statement, never sent to the agents.
  const [unitLabel,       setUnitLabel]       = useState('');
  const [buildingType,    setBuildingType]    = useState<BuildingType>('apartment');
  const [screenshots,     setScreenshots]     = useState<File[]>([]);
  const [screenshotPrevs, setScreenshotPrevs] = useState<string[]>([]);
  const [landlordPromises, setLandlordPromises] = useState('');
  const [tenantPromises,   setTenantPromises]   = useState('');

  // ── UI state ────────────────────────────────────────────────────
  const [corpusLoaded, setCorpusLoaded] = useState<boolean | null>(null);
  const [running,   setRunning]   = useState(false);
  const [elapsed,   setElapsed]   = useState(0);
  // Raw message of the failed step; shown behind a <details> in that step's panel.
  const [runError,  setRunError]  = useState<string | null>(null);
  const [claimsError, setClaimsError] = useState(false);
  const [extractState, setExtractState] = useState<ExtractState>('idle');
  const [extractError, setExtractError] = useState<string | null>(null);
  // Agent 02 skipped after a failure: its StepState stays as-is, this flag drives the display.
  const [agent02Skipped, setAgent02Skipped] = useState(false);
  const [runClaims, setRunClaims] = useState<Claim[]>([]);
  const [showPipeline, setShowPipeline] = useState(false);
  const [steps,   setSteps]   = useState<StepState[]>(IDLE_STEPS);
  const [results, setResults] = useState<PipelineResults>({});
  // Responsible AI: tenant reviews the legal verdicts and explicitly approves
  // before any document is generated — a distinct checkpoint, not folded into
  // the earlier pay/run confirmation.
  const [awaitingDocApproval, setAwaitingDocApproval] = useState(false);
  const [pendingDocArgs, setPendingDocArgs] = useState<{ claims: Claim[]; d3: any } | null>(null);
  const [generatingDocs, setGeneratingDocs] = useState(false);
  // Owners approve a deduction statement built from the verdicts instead of Agent 04's
  // tenant filings, so their approval is local state rather than a document request.
  const [statementApproved, setStatementApproved] = useState(false);

  // ── Wizard step ─────────────────────────────────────────────────
  const [step, setStep] = useState(0);

  const changeRole = (r: Role) => {
    setRole(r);
    setUnitCount(DEFAULT_UNITS[r]);
    window.history.replaceState(null, '', roleHref(r));
  };

  // ── Move-in vault (saved earlier) ──
  const [moveInRecords, setMoveInRecords] = useState<MoveInRecord[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [showRecordPicker, setShowRecordPicker] = useState(false);
  const selectTokenRef = useRef(0);

  useEffect(() => {
    const records = getMoveInRecords();
    setMoveInRecords(records);
    if (records[0]) selectRecord(records[0].id, records);
  }, []);

  const selectRecord = (id: string | null, records = moveInRecords) => {
    const token = ++selectTokenRef.current;
    setSelectedRecordId(id);
    setShowRecordPicker(false);
    const rec = id ? records.find(r => r.id === id) : undefined;
    if (!rec) { setMoveInFiles([]); setMoveInPrevs([]); return; }
    setMoveInPrevs(rec.photoDataUrls);
    Promise.all(rec.photoDataUrls.map((u, i) => dataUrlToFile(u, `movein_${i}.jpg`)))
      .then(files => { if (token === selectTokenRef.current) setMoveInFiles(files); });
  };

  // Per-run inputs: Retry and Replace file read these, never a stale render closure.
  const runClaimsRef    = useRef<Claim[]>([]);
  const d1Ref           = useRef<any>(null);
  const d2Ref           = useRef<any>(null);
  const contractFileRef = useRef<File | null>(null);
  useEffect(() => { contractFileRef.current = contractFile; }, [contractFile]);
  useEffect(() => { setExtractState('idle'); setExtractError(null); }, [contractFile]);
  const firstItemRef = useRef<HTMLInputElement>(null);

  // Each wizard step is a new screen: start at the top and move focus to its heading.
  const h1Ref = useRef<HTMLHeadingElement>(null);
  const stepMounted = useRef(false);
  useEffect(() => {
    if (!stepMounted.current) { stepMounted.current = true; return; }
    window.scrollTo(0, 0);
    h1Ref.current?.focus({ preventScroll: true });
  }, [step]);

  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const moveInInputRef   = useRef<HTMLInputElement>(null);
  const moveOutInputRef  = useRef<HTMLInputElement>(null);

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
    setExtractState('extracting');
    setExtractError(null);
    try {
      const fd = new FormData();
      fd.append('contract_file', contractFile);
      const d = await fetch('/extract-contract', { method: 'POST', body: fd }).then(r => r.json());
      if (d.error) throw new Error(d.error);
      setContractClause(d.text);
      setExtractState('done');
    } catch (err: any) {
      setExtractState('failed');
      setExtractError(err.message);
    }
  };

  // ── Pipeline step helpers ─────────────────────────────────────────
  const setStepState = (i: number, state: StepState) =>
    setSteps(prev => prev.map((s, idx) => idx === i ? state : s));

  // ── Wizard nav ──────────────────────────────────────────────────
  const validClaims = claims.filter(c => c.item.trim());
  function goNext() {
    if (step === 0 && !validClaims.length) {
      setClaimsError(true);
      firstItemRef.current?.focus({ preventScroll: true });
      firstItemRef.current?.scrollIntoView({ block: 'center' });
      return;
    }
    if (step < 3) setStep(s => s + 1);
  }
  function goBack() {
    if (step > 0) setStep(s => s - 1);
  }
  const onClaimsChange = (next: Claim[]) => {
    setClaims(next);
    if (claimsError) setClaimsError(false);
  };

  // ── Submit ────────────────────────────────────────────────────────
  function requestAnalysis() {
    if (!validClaims.length) { setStep(0); setClaimsError(true); return; }
    runClaimsRef.current = validClaims;
    setRunClaims(validClaims);
    setAgent02Skipped(false);
    d1Ref.current = null;
    d2Ref.current = null;
    setTimeout(() => {
      document.getElementById('pipeline')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    runFrom(0);
  }

  // Runs the agents from step `start` on, reusing earlier results held in refs.
  // The fetch blocks below are the original ones; only the control flow around them changed.
  const runFrom = async (start: number) => {
    const validClaims = runClaimsRef.current;
    const contractFile = contractFileRef.current;
    setRunning(true);
    setShowPipeline(true);
    setRunError(null);
    setAwaitingDocApproval(false);
    setPendingDocArgs(null);
    setGeneratingDocs(false);
    setStatementApproved(false);
    setSteps(prev => prev.map((s, idx) => (idx >= start || idx === 3) ? 'idle' : s));
    setResults(prev => start === 0 ? {} : start === 1 ? { agent01: prev.agent01 } : { agent01: prev.agent01, agent02: prev.agent02 });
    if (start <= 1) setAgent02Skipped(false);

    let i = start;
    try {
      if (start <= 0) {
        i = 0;
        setStepState(0, 'active');
        const fd1 = new FormData();
        moveInFiles.forEach(f  => fd1.append('move_in',  f));
        moveOutFiles.forEach(f => fd1.append('move_out', f));
        fd1.append('claims', JSON.stringify(validClaims));
        const d1 = await fetch('/run/agent01', { method: 'POST', body: fd1 }).then(r => r.json());
        if (d1.error) throw new Error(`Agent 01: ${d1.error}`);
        d1Ref.current = d1;
        setResults(prev => ({ ...prev, agent01: d1 }));
        setStepState(0, 'done');
      }
      const d1 = d1Ref.current;

      if (start <= 1) {
        i = 1;
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
        d2Ref.current = d2;
        setResults(prev => ({ ...prev, agent02: d2 }));
        setStepState(1, 'done');
      }
      // After Skip this is {}, so has_void_clause below is false.
      const d2 = d2Ref.current ?? {};

      i = 2;
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

      // Pause here: the tenant sees the legal verdicts and must explicitly
      // approve before any document is generated (step 4 waits for approveDocs()).
      setPendingDocArgs({ claims: validClaims, d3 });
      setAwaitingDocApproval(true);

    } catch (err: any) {
      setStepState(i, 'error');
      setRunError(err.message);
    } finally {
      setRunning(false);
    }
  };

  const retryStep = (i: number) => runFrom(i);

  // Agent 02 failed: continue without contract analysis (same agent 03 request, d2 = {}).
  const skipAgent02 = () => {
    d2Ref.current = {};
    setAgent02Skipped(true);
    setStepState(1, 'idle');
    runFrom(2);
  };

  const replaceContractFile = (f: File) => {
    contractFileRef.current = f;
    setContractFile(f);
    runFrom(1);
  };

  const approveDocs = async () => {
    if (!pendingDocArgs) return;
    // Agent 04 drafts documents a tenant files against a landlord; an owner's approval
    // issues their deduction statement instead, which Pipeline builds from the verdicts.
    if (owner) {
      setStepState(3, 'done');
      setAwaitingDocApproval(false);
      setStatementApproved(true);
      return;
    }
    const { claims: validClaims, d3 } = pendingDocArgs;
    // The approval section stays mounted (showing "Creating…") until agent 04 succeeds.
    setGeneratingDocs(true);
    setRunError(null);
    setStepState(3, 'active');
    try {
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
          approved_by_tenant:    true,
        }),
      }).then(r => r.json());
      if (d4.error) throw new Error(`Agent 04: ${d4.error}`);
      // Downloads need a case id; without one there is nothing to show, so treat it as a failure.
      if (!d4.case_id) throw new Error('Agent 04: response has no case_id');
      setResults(prev => ({ ...prev, agent04: d4 }));
      setStepState(3, 'done');
      setAwaitingDocApproval(false);
      // Keep the args while a requested document is missing, so its Retry can re-run agent 04.
      const requested: string[] = d3.documents_to_generate ?? ['demand_letter', 'evidence_summary'];
      if (requested.every(k => d4.documents?.[k])) setPendingDocArgs(null);
    } catch (err: any) {
      setStepState(3, 'error');
      setRunError(err.message);
    } finally {
      setGeneratingDocs(false);
    }
  };

  const selectedRecord = selectedRecordId ? moveInRecords.find(r => r.id === selectedRecordId) : undefined;
  const totalCharged = claims.reduce((s, c) => s + (c.amount_thb || 0), 0);
  const wizSteps = owner ? OWNER_WIZ_STEPS : WIZ_STEPS;
  const s = wizSteps[step];
  const hasContract = !!contractFile || !!contractClause.trim();
  const isDorm = role === 'business' && buildingType === 'dorm';

  if (showPipeline) {
    return (
      <Pipeline
        steps={steps}
        results={results}
        claims={runClaims}
        moveInPreviews={moveInPrevs}
        moveOutPreviews={moveOutPrevs}
        hasContract={hasContract}
        agent02Skipped={agent02Skipped}
        errorDetail={runError}
        running={running}
        awaitingDocApproval={awaitingDocApproval}
        generatingDocs={generatingDocs}
        onApproveDocs={approveDocs}
        onRetry={retryStep}
        onSkip={skipAgent02}
        onReplaceFile={replaceContractFile}
        onEditCase={() => setShowPipeline(false)}
        role={role}
        statementApproved={statementApproved}
        deposit={parseFloat(depositAmount) || 0}
        unitLabel={unitLabel}
        buildingType={role === 'business' ? buildingType : undefined}
      />
    );
  }

  const stepper = (rail: boolean) => (
    <ol className={`rw-steps ${rail ? '' : 'rw-only-mobile'}`} aria-label="ขั้นตอน · Steps">
      {wizSteps.map((w, i) => (
        <li key={i} className={i < step ? 'done' : i === step ? 'now' : undefined} aria-current={i === step ? 'step' : undefined}>
          <span>
            {w.th}{rail && <span className="rw-railsub" lang="en">· {w.en}</span>}
            {i < step && <span className="visually-hidden"> · เสร็จแล้ว · done</span>}
          </span>
        </li>
      ))}
    </ol>
  );
  const nextButton = (
    <button className={`rw-btn ${step === 3 ? 'wrap' : ''}`} data-testid="wiz-next" onClick={step < 3 ? goNext : requestAnalysis}
      disabled={running} aria-busy={running || undefined}>
      {step < 3
        ? <>ถัดไป <span lang="en">· Next</span></>
        : running ? <>กำลังวิเคราะห์… <span lang="en">· Analyzing…</span></> : <>เริ่มวิเคราะห์ <span lang="en">· Start analysis</span></>}
    </button>
  );
  const editButton = (to: number, label: string) => (
    <button type="button" className="rw-btn quiet small" onClick={() => setStep(to)} aria-label={label}>แก้ไข <span lang="en">· Edit</span></button>
  );

  return (
    <div className="rw-shell">
      <header className="rw-top"><div className="rw-top-in">
        <Link href="/" className="rw-mark">RoomWitness</Link>
        <Link href="/" className="rw-toplink">หน้าหลัก · Home</Link>
      </div></header>

      <div className="rw-page">
        <div className="rw-head stack">
          {stepper(false)}
          <div className="rw-head">
            <h1 className="rw-h1" ref={h1Ref} tabIndex={-1}>{s.headline}</h1>
            <p className="rw-sub" lang="en">{s.sub}</p>
          </div>
        </div>

        <main className="rw-main">
          {/* ── Step 0: Deductions ─────────────────────── */}
          {step === 0 && (
            <>
              <section className="rw-group" aria-labelledby="g-role" data-testid="role-picker">
                <h2 id="g-role" className="rw-gt"><span>คุณคือ <span lang="en">· You are</span></span></h2>
                <div className="rw-list pad">
                  <div className="rw-chips" role="group" aria-labelledby="g-role">
                    {ROLES.map(r => (
                      <button key={r} type="button" className="rw-chip" data-testid={`role-${r}`} aria-pressed={role === r} onClick={() => changeRole(r)}>
                        {ROLE_COPY[r].th} <span lang="en">· {ROLE_COPY[r].en}</span>
                      </button>
                    ))}
                  </div>
                  <p className="rw-rd">{ROLE_COPY[role].blurbTh} <span lang="en">· {ROLE_COPY[role].blurbEn}</span></p>
                </div>
              </section>
              <ClaimsList claims={claims} onChange={onClaimsChange} itemError={claimsError} firstItemRef={firstItemRef} />
              <p className="rw-short">
                <LockGlyph />
                <span>
                  รูปภาพ สัญญาเช่า และข้อความที่คุณอัปโหลดใช้เพื่อประมวลผลคดีของคุณเท่านั้น ไม่เปิดเผยต่อบุคคลที่สาม
                  ระบบเก็บบันทึกสรุปผลวิเคราะห์ (ไม่รวมภาพต้นฉบับ) ไว้ 90 วันเพื่อการตรวจสอบย้อนหลัง{' '}
                  <span lang="en">· Your photos, lease, and messages are used only to process your case and are never shared with third parties. A summary record (not original photos) is kept for 90 days for audit purposes.</span>
                </span>
              </p>
            </>
          )}

          {/* ── Step 1: Photos ─────────────────────────── */}
          {step === 1 && (
            <>
              <input ref={moveInInputRef}  type="file" accept="image/*" multiple className="dz-input" tabIndex={-1} aria-hidden="true" data-testid="movein-input"
                onChange={e => { addMoveIn(e.target.files);  e.target.value = ''; }} />
              <input ref={moveOutInputRef} type="file" accept="image/*" multiple className="dz-input" tabIndex={-1} aria-hidden="true" data-testid="moveout-input"
                onChange={e => { addMoveOut(e.target.files); e.target.value = ''; }} />

              <section className="rw-group" aria-labelledby="g-movein">
                <h2 id="g-movein" className="rw-gt"><span>ภาพวันเข้าอยู่ <span lang="en">· Move-in</span></span></h2>
                <div className="rw-list pad">
                  {selectedRecord ? (
                    <div className="rw-group" data-testid="vault-choice">
                      <div className="rw-rowmain">
                        <div className="rw-rt">ใช้ภาพจาก: {selectedRecord.label}</div>
                        <div className="rw-rd">{selectedRecord.photoDataUrls.length} รูปที่บันทึกไว้ <span lang="en">· Using {selectedRecord.photoDataUrls.length} photos from your saved move-in record</span></div>
                      </div>
                      <div className="rw-inline-actions">
                        {moveInRecords.length > 1 && (
                          <button type="button" className="rw-btn quiet outline small" aria-expanded={showRecordPicker} onClick={() => setShowRecordPicker(v => !v)}>
                            เปลี่ยน <span lang="en">· Change</span>
                          </button>
                        )}
                        <button type="button" className="rw-btn quiet outline small" data-testid="vault-upload-new"
                          onClick={() => { selectRecord(null); moveInInputRef.current?.click(); }}>
                          อัปโหลดใหม่ <span lang="en">· Upload new</span>
                        </button>
                      </div>
                    </div>
                  ) : moveInRecords.length > 0 && (
                    <p className="rw-rd">มีภาพวันเข้าอยู่ที่บันทึกไว้ เลือกใช้ได้ <span lang="en">· You have saved move-in photos you can use</span></p>
                  )}
                  {(showRecordPicker || (!selectedRecord && moveInRecords.length > 0)) && (
                    <div className="rw-chips" role="group" aria-label="ภาพที่บันทึกไว้ · Saved records">
                      {moveInRecords.map(r => (
                        <button key={r.id} type="button" className="rw-chip" aria-pressed={selectedRecordId === r.id} onClick={() => selectRecord(r.id)}>
                          {r.label} · {r.photoDataUrls.length}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="rw-thumbs">
                    {moveInPrevs.map((src, i) => (
                      <div key={i} className="rw-thumb photo-thumb">
                        <img src={src} alt={`ภาพวันเข้าอยู่ ${i + 1} · Move-in photo ${i + 1}`} />
                        {!selectedRecord && (
                          <button type="button" className="rw-btn icon" aria-label={`ลบภาพ ${i + 1} · Remove photo ${i + 1}`} onClick={() => removeMoveIn(i)}><CloseGlyph /></button>
                        )}
                      </div>
                    ))}
                    {!selectedRecord && (
                      <button type="button" className="rw-addtile" data-testid="movein-add" onClick={() => moveInInputRef.current?.click()}>
                        <PlusGlyph /><span>เพิ่มรูป <span lang="en">· Add</span></span>
                      </button>
                    )}
                  </div>
                  {moveInRecords.length === 0 && (
                    <Link href="/move-in" className="rw-btn quiet start">บันทึกรูปวันเข้าอยู่ไว้ใช้ภายหลัง <span lang="en">· Save move-in photos for later</span></Link>
                  )}
                </div>
              </section>

              <section className="rw-group" aria-labelledby="g-moveout">
                <h2 id="g-moveout" className="rw-gt"><span>ภาพวันย้ายออก <span lang="en">· Move-out</span></span></h2>
                <div className="rw-list pad">
                  <div className="rw-thumbs">
                    {moveOutPrevs.map((src, i) => (
                      <div key={i} className="rw-thumb photo-thumb">
                        <img src={src} alt={`ภาพวันย้ายออก ${i + 1} · Move-out photo ${i + 1}`} />
                        <button type="button" className="rw-btn icon" aria-label={`ลบภาพ ${i + 1} · Remove photo ${i + 1}`} onClick={() => removeMoveOut(i)}><CloseGlyph /></button>
                      </div>
                    ))}
                    <button type="button" className="rw-addtile" data-testid="moveout-add" onClick={() => moveOutInputRef.current?.click()}>
                      <PlusGlyph /><span>เพิ่มรูป <span lang="en">· Add</span></span>
                    </button>
                  </div>
                </div>
              </section>
              {owner ? (
                <p className="rw-short"><InfoGlyph /><span>ภาพวันเข้าอยู่ที่ลงวันที่ชัดเจนคือหลักฐานที่ดีที่สุดของคุณ ใช้มุมเดียวกันก่อนและหลังเช่า <span lang="en">· Dated move-in photos are your strongest proof. Matching angles help.</span></span></p>
              ) : (
                <p className="rw-short"><InfoGlyph /><span>ใช้ภาพมุมเดียวกันก่อนและหลังเช่า หากไม่มีภาพ ข้ามขั้นตอนนี้ได้ <span lang="en">· Matching angles help. You can continue without photos.</span></span></p>
              )}
            </>
          )}

          {/* ── Step 2: Evidence ───────────────────────── */}
          {step === 2 && (
            <>
              <section className="rw-group" aria-labelledby="g-contract">
                <h2 id="g-contract" className="rw-gt"><span>สัญญาเช่า <span lang="en">· Rental contract</span></span></h2>
                <div className="rw-fields">
                  <DropZone
                    label="อัปโหลดสัญญา · Upload your lease" sublabel="PDF หรือรูปภาพ · PDF or image" accept=".pdf,image/*"
                    file={contractFile} onFile={setContractFile} testId="contract-drop" icon={<DocGlyph />}
                  />
                  {contractFile && (
                    <div className="rw-inline-actions">
                      <button type="button" className="rw-btn quiet outline small" data-testid="extract-btn" data-state={extractState}
                        onClick={extractContract} disabled={extractState === 'extracting'} aria-busy={extractState === 'extracting' || undefined}>
                        {EXTRACT_LABEL[extractState]}
                      </button>
                      {extractState === 'done' && (
                        <p className="rw-fieldnote" role="status">อ่านข้อความจากไฟล์แล้ว ตรวจสอบได้ด้านล่าง <span lang="en">· Text read from the file. Check it below.</span></p>
                      )}
                    </div>
                  )}
                  {extractState === 'failed' && (
                    <div className="rw-err" role="alert" data-testid="extract-error">
                      <StepFailGlyph size={20} />
                      <span>
                        อ่านข้อความจากไฟล์ไม่สำเร็จ วางข้อสัญญาเองได้ <span lang="en">· Couldn&apos;t read text from the file. You can paste the clause instead.</span>
                        {extractError && <details className="rw-details"><summary>รายละเอียดทางเทคนิค · Technical detail</summary><code>{extractError}</code></details>}
                      </span>
                    </div>
                  )}
                  <div className="rw-field">
                    <label className="rw-label" htmlFor="contract-clause">ข้อสัญญาที่เกี่ยวข้อง <span lang="en">· Relevant clause</span></label>
                    <textarea id="contract-clause" className="rw-input" rows={4} data-testid="contract-text" placeholder="วางข้อสัญญา หรืออัปโหลดไฟล์ด้านบน · Paste a clause, or upload above"
                      value={contractClause} onChange={e => setContractClause(e.target.value)} />
                  </div>
                </div>
              </section>

              <section className="rw-group" aria-labelledby="g-lease">
                <h2 id="g-lease" className="rw-gt"><span>รายละเอียดสัญญา <span lang="en">· Lease details</span></span></h2>
                <div className="rw-fields">
                  <div className="rw-fieldrow even">
                    <div className="rw-field"><label className="rw-label" htmlFor="lease-start">วันเริ่มสัญญา <span lang="en">· Lease start</span></label><input id="lease-start" className="rw-input" data-testid="lease-start" type="date" value={leaseStart} onChange={e => setLeaseStart(e.target.value)} /></div>
                    <div className="rw-field"><label className="rw-label" htmlFor="lease-end">วันสิ้นสุดสัญญา <span lang="en">· Lease end</span></label><input id="lease-end" className="rw-input" data-testid="lease-end" type="date" value={leaseEnd} onChange={e => setLeaseEnd(e.target.value)} /></div>
                    <div className="rw-field"><label className="rw-label" htmlFor="deposit">{owner ? <>เงินประกันที่ถือไว้ <span lang="en">· Deposit held</span></> : <>เงินประกัน <span lang="en">· Deposit paid</span></>}</label><div className="rw-prefix"><span aria-hidden="true">฿</span><input id="deposit" className="rw-input" data-testid="deposit" type="number" inputMode="numeric" min="0" placeholder="20000" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} /></div></div>
                    <div className="rw-field"><label className="rw-label" htmlFor="rent">ค่าเช่าต่อเดือน <span lang="en">· Monthly rent</span></label><div className="rw-prefix"><span aria-hidden="true">฿</span><input id="rent" className="rw-input" data-testid="rent" type="number" inputMode="numeric" min="0" placeholder="10000" value={monthlyRent} onChange={e => setMonthlyRent(e.target.value)} /></div></div>
                    <div className="rw-field">
                      <label className="rw-label" htmlFor="units">
                        {owner ? <>จำนวนห้องที่คุณปล่อยเช่า <span lang="en">· Units you rent out</span></> : <>จำนวนห้องที่ผู้ให้เช่าปล่อยเช่า <span lang="en">· Landlord&apos;s rental units</span></>}
                      </label>
                      <input id="units" className="rw-input" data-testid="units" type="number" inputMode="numeric" min="0" placeholder="5" aria-describedby="units-note" value={unitCount} onChange={e => setUnitCount(e.target.value)} />
                      {owner ? (
                        <p id="units-note" className="rw-fieldnote">3 ห้องขึ้นไป ประกาศ สคบ. 2568 ใช้บังคับ <span lang="en">· At 3 or more units, the OCPB 2568 notification applies</span></p>
                      ) : (
                        <p id="units-note" className="rw-fieldnote">ไม่ทราบให้ใส่ 0 <span lang="en">· Enter 0 if you don&apos;t know</span></p>
                      )}
                    </div>
                    {owner && (
                      <div className="rw-field">
                        <label className="rw-label" htmlFor="unit-label">ห้อง / ยูนิต <span lang="en">· Room or unit</span></label>
                        <input id="unit-label" className="rw-input" data-testid="unit-label" type="text" placeholder="เช่น 504 · e.g. 504" aria-describedby="unit-label-note" value={unitLabel} onChange={e => setUnitLabel(e.target.value)} />
                        <p id="unit-label-note" className="rw-fieldnote">แสดงบนใบแจ้งเท่านั้น <span lang="en">· Shown on the statement only</span></p>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {role === 'business' && (
                <section className="rw-group" aria-labelledby="g-building">
                  <h2 id="g-building" className="rw-gt"><span>ประเภทอาคาร <span lang="en">· Building type</span></span></h2>
                  <div className="rw-list pad">
                    <div className="rw-chips" role="group" aria-labelledby="g-building">
                      <button type="button" className="rw-chip" data-testid="building-apartment" aria-pressed={buildingType === 'apartment'} onClick={() => setBuildingType('apartment')}>
                        อพาร์ตเมนต์ / คอนโด <span lang="en">· Apartment or condo</span>
                      </button>
                      <button type="button" className="rw-chip" data-testid="building-dorm" aria-pressed={buildingType === 'dorm'} onClick={() => setBuildingType('dorm')}>
                        หอพักที่มีใบอนุญาต <span lang="en">· Licensed dormitory</span>
                      </button>
                    </div>
                    {isDorm && <p className="rw-short" role="note" data-testid="dorm-note"><InfoGlyph /><span>{DORM_NOTE.th} <span lang="en">· {DORM_NOTE.en}</span></span></p>}
                  </div>
                </section>
              )}

              <section className="rw-group" aria-labelledby="g-chats">
                <h2 id="g-chats" className="rw-gt"><span>ภาพแชท <span lang="en">· Chat screenshots (LINE, WhatsApp, SMS)</span></span></h2>
                <div className="rw-list pad">
                  <input ref={screenshotInputRef} type="file" accept="image/*" multiple className="dz-input" tabIndex={-1} aria-hidden="true" data-testid="screenshots-input"
                    onChange={e => { if (e.target.files) addScreenshots(e.target.files); e.target.value = ''; }} />
                  <div className="rw-thumbs">
                    {screenshotPrevs.map((src, i) => (
                      <div key={i} className="rw-thumb">
                        <img src={src} alt={`ภาพแชท ${i + 1} · Chat screenshot ${i + 1}`} />
                        <button type="button" className="rw-btn icon" aria-label={`ลบภาพแชท ${i + 1} · Remove screenshot ${i + 1}`} onClick={() => removeScreenshot(i)}><CloseGlyph /></button>
                      </div>
                    ))}
                    <button type="button" className="rw-addtile" onClick={() => screenshotInputRef.current?.click()}>
                      <PlusGlyph /><span>เพิ่มภาพแชท <span lang="en">· Add</span></span>
                    </button>
                  </div>
                </div>
              </section>

              <section className="rw-group" aria-labelledby="g-promises">
                <h2 id="g-promises" className="rw-gt"><span>ข้อตกลงเป็นลายลักษณ์อักษร <span lang="en">· Written promises</span></span></h2>
                <div className="rw-fields">
                  <div className="rw-field">
                    <label className="rw-label" htmlFor="landlord-promises">
                      {owner ? <>คุณตกลงไว้กับผู้เช่า <span lang="en">· Your promises</span></> : <>เจ้าของบ้านตกลงไว้ <span lang="en">· Landlord promises</span></>}
                    </label>
                    <textarea id="landlord-promises" className="rw-input" rows={3} placeholder="เช่น คืนเงินเต็มจำนวนถ้าห้องสะอาด · e.g. Full refund if the room is clean" value={landlordPromises} onChange={e => setLandlordPromises(e.target.value)} />
                  </div>
                  <div className="rw-field">
                    <label className="rw-label" htmlFor="tenant-promises">
                      {owner ? <>ผู้เช่าแจ้งหรือตกลงไว้ <span lang="en">· Tenant&apos;s statements</span></> : <>คุณได้แจ้งหรือตกลงไว้ <span lang="en">· Your statements</span></>}
                    </label>
                    <textarea id="tenant-promises" className="rw-input" rows={3}
                      placeholder={owner ? 'เช่น จะทาสีผนังเองก่อนย้ายออก · e.g. Will repaint the wall before moving out' : 'เช่น รอยบนผนังมีอยู่ก่อนเข้าอยู่ · e.g. The wall scuff was there at move-in'}
                      value={tenantPromises} onChange={e => setTenantPromises(e.target.value)} />
                  </div>
                </div>
              </section>
            </>
          )}

          {/* ── Step 3: Review ─────────────────────────── */}
          {step === 3 && (
            <>
              <div className="rw-figure" data-testid="wizard-review">
                <div className="rw-num">฿{totalCharged.toLocaleString()}</div>
                <div className="rw-numcap">ยอดหักเงินที่ส่งตรวจ<span lang="en">Total deductions to check</span></div>
              </div>
              <section className="rw-group" aria-labelledby="g-review-claims">
                <h2 id="g-review-claims" className="rw-gt"><span>รายการที่ส่งตรวจ <span lang="en">· Deductions</span></span>{editButton(0, 'แก้ไขรายการ · Edit deductions')}</h2>
                <div className="rw-list">
                  {validClaims.map(c => (
                    <div className="rw-row" key={c.claim_id}>
                      <div className="rw-rowmain"><div className="rw-rt">{c.item}</div>{c.description && <div className="rw-rd">{c.description}</div>}</div>
                      <div className="rw-amt">{c.amount_thb ? `฿${c.amount_thb.toLocaleString()}` : <span className="rw-fieldnote">฿0 · ยังไม่ได้ใส่ · No amount</span>}</div>
                    </div>
                  ))}
                </div>
              </section>
              <section className="rw-group" aria-labelledby="g-review-evidence">
                <h2 id="g-review-evidence" className="rw-gt"><span>หลักฐาน <span lang="en">· Evidence</span></span></h2>
                <div className="rw-list">
                  <div className="rw-row center" data-testid="review-role">
                    <div className="rw-rowmain">
                      <div className="rw-rt">คุณคือ{ROLE_COPY[role].th}</div>
                      <div className="rw-rd" lang="en">You are: {ROLE_COPY[role].en}{owner && unitLabel.trim() ? ` · Unit ${unitLabel.trim()}` : ''}</div>
                    </div>
                    {editButton(0, 'แก้ไขบทบาท · Edit role')}
                  </div>
                  <div className="rw-row center"><div className="rw-rowmain"><div className="rw-rt">ภาพวันเข้าอยู่ · วันย้ายออก</div><div className="rw-rd">{moveInPrevs.length} · {moveOutPrevs.length} รูป <span lang="en">· move-in · move-out photos</span></div></div>{editButton(1, 'แก้ไขรูปถ่าย · Edit photos')}</div>
                  <div className="rw-row center"><div className="rw-rowmain"><div className="rw-rt">สัญญาเช่า</div><div className="rw-rd">{hasContract ? 'แนบแล้ว · Added' : 'ไม่ได้แนบ · Not added'}</div></div>{editButton(2, 'แก้ไขหลักฐาน · Edit evidence')}</div>
                  <div className="rw-row center"><div className="rw-rowmain"><div className="rw-rt">ภาพแชท</div><div className="rw-rd">{screenshotPrevs.length} รูป <span lang="en">· screenshots</span></div></div></div>
                </div>
              </section>
              <section className="rw-group" aria-labelledby="g-review-next">
                <h2 id="g-review-next" className="rw-gt"><span>สิ่งที่จะเกิดขึ้น <span lang="en">· What happens next</span></span></h2>
                <ol className="rw-plan rw-list">
                  {(owner ? OWNER_PLAN_PREVIEW : PLAN_PREVIEW).map(p => (
                    <li key={p.th} className="idle"><StepIdleGlyph /><div><div className="st">{p.th}</div><div className="sd">{p.sd}</div></div></li>
                  ))}
                </ol>
              </section>
              {isDorm && <p className="rw-short" role="note"><InfoGlyph /><span>{DORM_NOTE.th} <span lang="en">· {DORM_NOTE.en}</span></span></p>}
              <Disclaimer />
            </>
          )}

          <div className="rw-navrow rw-only-desktop">
            {step > 0 && <button type="button" className="rw-btn quiet outline" onClick={goBack}>ย้อนกลับ <span lang="en">· Back</span></button>}
            {nextButton}
          </div>
        </main>

        <aside className="rw-aside rw-only-desktop" aria-label="ความคืบหน้า · Progress">
          {stepper(true)}
          <p className="rw-note">ยอดหักรวม · Total deducted<b>฿{totalCharged.toLocaleString()}</b></p>
        </aside>
      </div>

      <div className="rw-actionbar rw-only-mobile">
        {step > 0 && (
          <button type="button" className="rw-btn icon quiet-ink flip" aria-label="ย้อนกลับ · Back" onClick={goBack}><ChevronGlyph size={20} /></button>
        )}
        {step < 3 && <div className="rw-sum">ยอดหักรวม · Total<b>฿{totalCharged.toLocaleString()}</b></div>}
        <div className={step < 3 ? 'rw-barbtn' : 'rw-barbtn grow'}>{nextButton}</div>
      </div>
    </div>
  );
}
