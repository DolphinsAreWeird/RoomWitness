'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Claim, ClaimVerdict, PipelineResults, StepState } from '@/types';
import { Disclaimer, ShortDisclaimer } from '@/components/Disclaimer';
import DocPreview from '@/components/DocPreview';
import {
  ChevronGlyph, DisputedGlyph, DocGlyph, DownloadGlyph, LawfulGlyph, StepDoneGlyph, StepFailGlyph,
  StepIdleGlyph, StepNowGlyph, StepSkipGlyph, UnlawfulGlyph,
} from '@/components/icons';

// Thai primary, English secondary
const CV_LABEL: Record<string, { th: string; en: string }> = {
  NORMAL_WEAR:  { th: 'สึกหรอตามปกติ',     en: 'Normal wear & tear' },
  PRE_EXISTING: { th: 'เสียหายอยู่ก่อนแล้ว', en: 'Pre-existing damage' },
  UNCHANGED:    { th: 'ไม่เปลี่ยนแปลง',     en: 'No change' },
  NEW_DAMAGE:   { th: 'ความเสียหายใหม่',    en: 'New damage' },
};
// Owner decision: the Unlawful badge matches the headline wording.
const VERDICT_LABEL: Record<string, { th: string; en: string; cls: string }> = {
  LAWFUL:   { th: 'ถูกต้อง',          en: 'Lawful',   cls: 'law' },
  DISPUTED: { th: 'โต้แย้ง',          en: 'Disputed', cls: 'dis' },
  UNLAWFUL: { th: 'ไม่ชอบด้วยกฎหมาย', en: 'Unlawful', cls: 'unl' },
};

export const DOC_TYPES: Record<string, { th: string; en: string }> = {
  demand_letter:    { th: 'หนังสือเรียกร้องคืนเงินประกัน', en: 'Demand letter' },
  evidence_summary: { th: 'สรุปหลักฐานและผลวินิจฉัย',     en: 'Evidence summary' },
  ocpb_complaint:   { th: 'หนังสือร้องเรียน สคบ.',          en: 'OCPB complaint' },
};
// Same fallback the agent 04 request uses (app/app/page.tsx).
export const DEFAULT_DOCS = ['demand_letter', 'evidence_summary'];

const ROUTE_LABEL: Record<string, { th: string; en: string }> = {
  BOTH:  { th: 'ร้องเรียน สคบ. และทวงถามเจ้าของบ้าน', en: 'OCPB complaint + demand letter' },
  CIVIL: { th: 'ทวงถามเจ้าของบ้าน',                  en: 'Demand letter' },
  OCPB:  { th: 'ร้องเรียน สคบ.',                      en: 'OCPB complaint' },
};
const OCPB_UNITS_NOTE = { th: 'ยื่น สคบ. ได้เมื่อผู้ให้เช่ามีห้องเช่า 3 ห้องขึ้นไป', en: 'File the OCPB complaint only if your landlord rents out 3 or more units. Otherwise use the demand letter.' };
const CIVIL_NOTE = { th: 'เส้นทางของคุณคือการเรียกร้องทางแพ่ง สคบ. ใช้กับผู้ให้เช่าที่มีห้องเช่า 3 ห้องขึ้นไป', en: 'Your route is a civil claim. OCPB applies to landlords with 3 or more units.' };

// Task names, not vendor names (one per agent, in pipeline order).
const STEP_ERRORS = [
  { h1: 'เทียบภาพไม่สำเร็จ',      th: 'เทียบภาพไม่สำเร็จในขณะนี้',       en: 'Unable to compare the photos right now.' },
  { h1: 'อ่านสัญญาเช่าไม่สำเร็จ',  th: 'อ่านไฟล์สัญญาไม่ได้ในขณะนี้',      en: 'Unable to read the lease file right now.' },
  { h1: 'ตรวจตามกฎหมายไม่สำเร็จ', th: 'ตรวจตามกฎหมายไม่สำเร็จในขณะนี้',  en: 'Unable to check against the law right now.' },
  { h1: 'จัดทำเอกสารไม่สำเร็จ',    th: 'จัดทำเอกสารไม่สำเร็จในขณะนี้',     en: 'Unable to create the documents right now.' },
];

const baht = (n: number | null | undefined) => `฿${(n ?? 0).toLocaleString()}`;

export function VerdictBadge({ verdict }: { verdict: string }) {
  const v = VERDICT_LABEL[verdict];
  if (!v) return <span className="rw-badge neutral">{verdict || '—'}</span>;
  const Glyph = verdict === 'UNLAWFUL' ? UnlawfulGlyph : verdict === 'DISPUTED' ? DisputedGlyph : LawfulGlyph;
  return (
    <span className={`rw-badge ${v.cls}`}>
      <Glyph size={14} /><span>{v.th} <span className="en" lang="en">· {v.en}</span></span>
    </span>
  );
}

// ── Error panel shown inside the step that failed ──────────────────────
interface StepErrorProps {
  step: number;
  detail: string | null;
  onRetry: () => void;
  onSkip?: () => void;
  onReplaceFile?: (f: File) => void;
  busy?: boolean;
}
function StepError({ step, detail, onRetry, onSkip, onReplaceFile, busy }: StepErrorProps) {
  const msgRef = useRef<HTMLParagraphElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    msgRef.current?.focus({ preventScroll: true });
    msgRef.current?.scrollIntoView({ block: 'center' });
  }, []);
  const copy = STEP_ERRORS[step];
  return (
    <div className="rw-errpanel" data-testid="step-error">
      <p ref={msgRef} role="alert" tabIndex={-1} className="rw-errmsg">
        {copy.th} <span lang="en">· {copy.en}</span>
      </p>
      <div className="rw-btns">
        <button type="button" className="rw-btn small" data-testid="retry" onClick={onRetry} disabled={busy}>
          ลองอีกครั้ง <span lang="en">· Retry</span>
        </button>
        {onSkip && (
          <button type="button" className="rw-btn small quiet outline" data-testid="skip" onClick={onSkip} disabled={busy}>
            ข้ามขั้นนี้ <span lang="en">· Skip</span>
          </button>
        )}
        {onReplaceFile && (
          <>
            <input ref={fileRef} type="file" accept=".pdf,image/*" className="dz-input" tabIndex={-1} aria-hidden="true" data-testid="replace-file-input"
              onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onReplaceFile(f); }} />
            <button type="button" className="rw-btn small quiet" data-testid="replace-file" onClick={() => fileRef.current?.click()} disabled={busy}>
              เปลี่ยนไฟล์สัญญา <span lang="en">· Replace file</span>
            </button>
          </>
        )}
      </div>
      {onSkip && (
        <p className="rw-note">ถ้าข้าม ผลวินิจฉัยจะไม่ใช้ข้อมูลจากสัญญา <span lang="en">· If you skip, the verdict will not use your lease.</span></p>
      )}
      {detail && (
        <details className="rw-details">
          <summary>รายละเอียดทางเทคนิค <span lang="en">· Technical detail</span></summary>
          <code>{detail}</code>
        </details>
      )}
    </div>
  );
}

// ── Headline figure: never "recoverable" ───────────────────────────────
function Headline({ verdicts, totalUnlawful, totalClaimed, compact }: { verdicts: ClaimVerdict[]; totalUnlawful: number; totalClaimed: number; compact?: boolean }) {
  const disputed = verdicts.filter(v => v.verdict === 'DISPUTED').reduce((s, v) => s + (v.amount_thb ?? 0), 0);
  const leadDisputed = totalUnlawful === 0 && disputed > 0;
  const lead = leadDisputed ? disputed : totalUnlawful;
  return (
    <div className={`rw-figure ${compact ? 'compact' : ''}`} data-testid="headline">
      <div className="rw-num">{baht(lead)}</div>
      {leadDisputed ? (
        <>
          <div className="rw-numcap">มีข้อโต้แย้ง ยังไม่มีรายการที่ประเมินว่าไม่ชอบด้วยกฎหมาย<span lang="en">disputed; no deduction assessed unlawful under cited law</span></div>
          <p className="rw-route">ควรเจรจากับผู้ให้เช่า หรือปรึกษา <a href="tel:1166">สายด่วน สคบ. 1166</a> หรือทนายความ <span lang="en">· Negotiate, or call the OCPB hotline 1166 or a lawyer.</span></p>
        </>
      ) : (
        <div className="rw-numcap">ประเมินว่าไม่ชอบด้วยกฎหมาย<span lang="en">assessed unlawful under cited law</span></div>
      )}
      <div className="rw-of">จาก {baht(totalClaimed)} ที่ถูกหัก <span lang="en">· of {baht(totalClaimed)} claimed</span></div>
    </div>
  );
}

type PlanState = 'idle' | 'now' | 'done' | 'fail' | 'skipped';
const PLAN_GLYPH: Record<PlanState, () => JSX.Element> = {
  idle: () => <StepIdleGlyph />, now: () => <StepNowGlyph />, done: () => <StepDoneGlyph />,
  fail: () => <StepFailGlyph />, skipped: () => <StepSkipGlyph />,
};
const PLAN_STATE_WORD: Record<PlanState, string> = {
  idle: 'ยังไม่เริ่ม · not started', now: 'กำลังทำ · in progress', done: 'เสร็จแล้ว · done', fail: 'ไม่สำเร็จ · failed', skipped: 'ข้ามแล้ว · skipped',
};

interface Props {
  steps: StepState[];
  results: PipelineResults;
  claims: Claim[];
  moveInPreviews:  string[];
  moveOutPreviews: string[];
  hasContract: boolean;
  agent02Skipped: boolean;
  errorDetail: string | null;
  running: boolean;
  awaitingDocApproval?: boolean;
  generatingDocs?: boolean;
  onApproveDocs?: () => void;
  onRetry: (step: number) => void;
  onSkip: () => void;
  onReplaceFile: (f: File) => void;
  onEditCase: () => void;
}

export default function Pipeline({
  steps, results, claims, moveInPreviews, moveOutPreviews, hasContract, agent02Skipped, errorDetail, running,
  awaitingDocApproval, generatingDocs, onApproveDocs, onRetry, onSkip, onReplaceFile, onEditCase,
}: Props) {
  const [s1, s2, s3, s4] = steps;
  const d1 = results.agent01;
  const d2 = results.agent02;
  const d3 = results.agent03;
  const d4 = results.agent04;
  const verdicts = d3?.verdicts ?? [];
  const totalUnlawful = d3?.total_unlawful_thb ?? 0;
  const totalClaimed = d3?.total_claimed_thb ?? verdicts.reduce((sum, v) => sum + (v.amount_thb ?? 0), 0);
  const requestedDocs: string[] = d3?.documents_to_generate ?? DEFAULT_DOCS;
  const generatedDocs = d4 ? requestedDocs.filter(k => d4.documents?.[k]) : [];
  const missingDocs = d4 ? requestedDocs.filter(k => !d4.documents?.[k]) : [];
  const route = d3?.routing ? ROUTE_LABEL[d3.routing] : undefined;
  const docsReady = !!d4?.case_id;
  const showApproval = !!d3 && (!!awaitingDocApproval || s4 === 'error' || (!!generatingDocs && !d4));
  const failedStep = [s1, s2, s3].findIndex(s => s === 'error');
  const descFor = (v: ClaimVerdict) => claims.find(c => c.claim_id === v.claim_id)?.description;
  const newDamage = (d1?.damage_map ?? []).filter(r => r.verdict === 'NEW_DAMAGE').length;

  // ── The five-step plan: photos, contract, law, your approval, documents ──
  const toPlan = (s: StepState): PlanState => s === 'active' ? 'now' : s === 'done' ? 'done' : s === 'error' ? 'fail' : 'idle';
  const approvalState: PlanState = d4 || generatingDocs || s4 !== 'idle' ? 'done' : awaitingDocApproval ? 'now' : 'idle';
  const plan: Array<{ key: number; state: PlanState; st: string; sd: string; slot?: React.ReactNode }> = [
    { key: 1, state: toPlan(s1), st: 'เทียบภาพก่อน–หลัง',
      sd: s1 === 'active' ? 'กำลังเทียบภาพก่อนและหลังเช่า · Comparing your photos'
        : s1 === 'done' ? (newDamage > 0 ? `พบความเสียหายใหม่ ${newDamage} รายการ · ${newDamage} new damage found` : 'ไม่พบความเสียหายใหม่ · No new damage found')
        : 'ภาพวันเข้าอยู่และวันย้ายออก · Move-in and move-out photos',
      slot: s1 === 'error' ? <StepError step={0} detail={errorDetail} onRetry={() => onRetry(0)} busy={running} /> : undefined },
    { key: 2, state: agent02Skipped ? 'skipped' : toPlan(s2), st: 'อ่านสัญญาเช่า',
      sd: agent02Skipped ? 'ข้ามแล้ว ผลวินิจฉัยไม่ใช้สัญญา · Skipped; the verdict does not use your lease'
        : s2 === 'active' ? 'กำลังอ่านข้อสัญญาเรื่องเงินประกัน · Reading the deposit clauses'
        : s2 === 'done' ? ((d2?.unfair_clauses?.length ?? 0) > 0 ? `พบข้อสัญญาที่เป็นโมฆะ ${d2!.unfair_clauses.length} ข้อ · ${d2!.unfair_clauses.length} void clause found` : 'อ่านสัญญาแล้ว · Lease read')
        : 'ข้อสัญญาเรื่องเงินประกัน · The deposit clauses',
      slot: s2 === 'error' ? <StepError step={1} detail={errorDetail} onRetry={() => onRetry(1)} onSkip={onSkip} onReplaceFile={onReplaceFile} busy={running} /> : undefined },
    { key: 3, state: toPlan(s3), st: 'ตรวจตามกฎหมาย',
      sd: s3 === 'active' ? 'กำลังตรวจแต่ละรายการตามกฎหมาย · Checking each deduction against the law'
        : s3 === 'done' ? `ตรวจครบ ${verdicts.length} รายการ · ${verdicts.length} deduction${verdicts.length !== 1 ? 's' : ''} checked`
        : 'ป.พ.พ. และประกาศ สคบ. 2568 · CCC and OCPB 2568',
      slot: s3 === 'error' ? <StepError step={2} detail={errorDetail} onRetry={() => onRetry(2)} busy={running} /> : undefined },
    { key: 4, state: approvalState, st: 'ยืนยันโดยคุณ',
      sd: approvalState === 'now' ? 'รอการอนุมัติ · Waiting for you' : approvalState === 'done' ? 'อนุมัติแล้ว · Approved' : 'คุณตรวจผลก่อนสร้างเอกสาร · You approve first' },
    { key: 5, state: toPlan(s4), st: 'จัดทำเอกสาร',
      sd: s4 === 'active' ? `กำลังจัดทำเอกสาร ${requestedDocs.length} ฉบับ · Drafting ${requestedDocs.length} Thai documents`
        : s4 === 'done' ? `พร้อมดาวน์โหลด ${generatedDocs.length} ฉบับ · ${generatedDocs.length} ready`
        : s4 === 'error' ? 'ไม่สำเร็จ ลองอีกครั้งได้ในกล่องอนุมัติ · Failed; retry from the approval box'
        : 'เอกสารภาษาไทย · Thai PDFs' },
  ];
  const currentIdx = plan.findIndex(p => p.state !== 'done' && p.state !== 'skipped');
  const stepNo = currentIdx === -1 ? 5 : currentIdx + 1;

  // ── Page state: heading, status line ──
  const mode = failedStep >= 0 ? 'error' : docsReady ? 'docs' : d3 ? 'review' : 'running';
  const heading = {
    running: { h1: 'กำลังตรวจสอบหลักฐานของคุณ', sub: <span lang="en">Checking your evidence, one step at a time.</span> },
    error:   { h1: STEP_ERRORS[Math.max(failedStep, 0)].h1, sub: <>รายการและภาพของคุณยังอยู่ครบ <span lang="en">· Your claims and photos are kept.</span></> },
    review:  { h1: 'ผลวินิจฉัยพร้อมให้คุณตรวจ', sub: <>ยังไม่มีการสร้างเอกสารจนกว่าคุณจะอนุมัติ <span lang="en">· Nothing is created until you approve.</span></> },
    docs:    { h1: 'เอกสารของคุณพร้อมแล้ว', sub: <span lang="en">Your {generatedDocs.length} Thai documents are ready to download.</span> },
  }[mode];
  const status = mode === 'error' ? 'หยุดชั่วคราว · Paused'
    : mode === 'docs' ? `เคส · Case ${d4!.case_id}`
    : `ขั้น ${stepNo} จาก 5 · Step ${stepNo} of 5`;

  // The generated document open in the in-page viewer, if any.
  const [previewKey, setPreviewKey] = useState<string | null>(null);

  // Scroll to and focus the heading of each new decision state.
  const h1Ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (mode !== 'review' && mode !== 'docs') return;
    if (mode === 'review' && !awaitingDocApproval) return;
    window.scrollTo(0, 0);
    h1Ref.current?.focus({ preventScroll: true });
  }, [mode, awaitingDocApproval]);

  const planList = (
    <ol className="rw-plan rw-list" aria-label="การวิเคราะห์ · Analysis">
      {plan.map(p => (
        <li key={p.key} className={p.state} data-testid={`plan-step-${p.key}`} data-state={p.state} aria-current={p.state === 'now' ? 'step' : undefined}>
          {PLAN_GLYPH[p.state]()}
          <div>
            <div className="st">{p.st}<span className="visually-hidden"> · {PLAN_STATE_WORD[p.state]}</span></div>
            {!p.slot && <div className="sd">{p.sd}</div>}
            {p.slot}
          </div>
        </li>
      ))}
    </ol>
  );

  const verdictGroup = d3 && (
    <section className="rw-group" data-testid="review-section" aria-labelledby="g-verdicts">
      <h2 id="g-verdicts" className="rw-gt"><span>ผลวินิจฉัยรายการ <span lang="en">· Verdict per deduction</span></span></h2>
      <div className="rw-list">
        {verdicts.map((v, i) => (
          <div key={i} className="rw-row col" data-testid="verdict-row">
            <div className="rw-split">
              <div className="rw-rowmain">
                <div className="rw-rt">{v.item}</div>
                {descFor(v) && <div className="rw-rd">{descFor(v)}</div>}
              </div>
              <div className="rw-amt">{baht(v.amount_thb)}</div>
            </div>
            <VerdictBadge verdict={v.verdict} />
            <div className="rw-reason">
              <p>{v.reasoning_th}</p>
              {v.reasoning_en && <p className="en" lang="en">{v.reasoning_en}</p>}
            </div>
            {v.citations?.length > 0 && (
              <div className="rw-cites" aria-label="ข้อกฎหมายที่อ้างอิง · Cited law">
                {v.citations.map((c, j) => <span key={j} className="rw-cite">{c}</span>)}
              </div>
            )}
            {v.recommended_action_th && <p className="rw-next"><b>ขั้นต่อไป · Next step:</b> {v.recommended_action_th}</p>}
          </div>
        ))}
      </div>
      {agent02Skipped && <p className="rw-note">ผลวินิจฉัยนี้ไม่ได้ใช้ข้อมูลจากสัญญา <span lang="en">· This verdict did not use your lease.</span></p>}
    </section>
  );

  const approval = showApproval && d3 && (
    <section className="rw-group" aria-labelledby="g-approve" data-testid="approval">
      <h2 id="g-approve" className="rw-gt"><span>อนุมัติเพื่อสร้างเอกสาร <span lang="en">· Approve to create</span></span></h2>
      <div className="rw-list pad">
        <div className="rw-rd ink">
          เมื่ออนุมัติแล้ว AI จะจัดทำเอกสาร {requestedDocs.length} ฉบับ <span lang="en">· Once you approve, AI drafts {requestedDocs.length} documents:</span>
          <ul className="rw-bullets" data-testid="approval-docs">
            {requestedDocs.map(k => <li key={k}>{DOC_TYPES[k]?.th ?? k} <span lang="en">· {DOC_TYPES[k]?.en ?? k}</span></li>)}
          </ul>
        </div>
        {route && <p className="rw-rd ink"><b>เส้นทางดำเนินการ · Next step:</b> {route.th} <span lang="en">· {route.en}</span></p>}
        {d3.routing === 'CIVIL' && <p className="rw-rd">{CIVIL_NOTE.th} <span lang="en">· {CIVIL_NOTE.en}</span></p>}
        <Disclaimer />
        {s4 === 'error' ? (
          <StepError step={3} detail={errorDetail} onRetry={() => onApproveDocs?.()} busy={generatingDocs} />
        ) : (
          <button type="button" className="rw-btn full wrap" data-testid="approve" onClick={onApproveDocs} disabled={generatingDocs} aria-busy={generatingDocs || undefined}>
            {generatingDocs
              ? <>กำลังสร้างเอกสาร <span lang="en">· Creating documents…</span></>
              : <>อนุมัติและสร้าง {requestedDocs.length} ฉบับ <span lang="en">· Approve</span></>}
          </button>
        )}
      </div>
    </section>
  );

  const docsGroup = docsReady && d4 && (
    <section className="rw-group" id="case-documents" data-testid="docs-section" aria-labelledby="g-docs">
      <h2 id="g-docs" className="rw-gt"><span>เอกสาร {generatedDocs.length} ฉบับ พร้อมยื่นได้ทันที <span lang="en">· {generatedDocs.length} ready-to-file Thai legal documents</span></span></h2>
      <div className="rw-list">
        {generatedDocs.map(key => {
          const doc = d4.documents[key];
          const caseId = d4.case_id!;
          const name = DOC_TYPES[key] ?? { th: key, en: key };
          return (
            <div key={key} className="rw-row center" data-testid="doc-row">
              <DocGlyph />
              <div className="rw-rowmain">
                <div className="rw-rt">{name.th}</div>
                <div className="rw-rd"><span lang="en">{name.en}</span> · PDF · {doc.pages} หน้า · {doc.pages} page{doc.pages !== 1 ? 's' : ''}</div>
                {key === 'ocpb_complaint' && <div className="rw-rd">{OCPB_UNITS_NOTE.th} <span lang="en">· {OCPB_UNITS_NOTE.en}</span></div>}
                <div className="rw-inline-actions">
                  <button type="button" className="rw-btn small quiet outline" data-testid="doc-preview" data-preview-key={key} onClick={() => setPreviewKey(key)}
                    aria-label={`ดูเอกสาร · Preview: ${name.th} · ${name.en}`}>
                    ดูเอกสาร <span lang="en">· Preview</span>
                  </button>
                </div>
              </div>
              <a
                className="rw-btn icon"
                href={`/download/${caseId}/${key}`}
                download={`${key}_${caseId}.pdf`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`ดาวน์โหลด ${name.th} · Download ${name.en}`}
              >
                <DownloadGlyph size={20} />
              </a>
            </div>
          );
        })}
        {missingDocs.map(key => {
          const name = DOC_TYPES[key] ?? { th: key, en: key };
          return (
            <div key={key} className="rw-row center" data-testid="doc-missing">
              <StepFailGlyph />
              <div className="rw-rowmain">
                <div className="rw-rt">{name.th}</div>
                <div className="rw-rd">สร้างเอกสารนี้ไม่สำเร็จ <span lang="en">· {name.en} was not created.</span></div>
              </div>
              {s4 !== 'error' && (
                <button type="button" className="rw-btn small" data-testid="retry-docs" onClick={onApproveDocs} disabled={generatingDocs} aria-busy={generatingDocs || undefined}>
                  {generatingDocs ? 'กำลังสร้าง · Creating…' : 'ลองอีกครั้ง · Retry'}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {s4 === 'error' && (
        <div className="rw-list pad">
          <StepError step={3} detail={errorDetail} onRetry={() => onApproveDocs?.()} busy={generatingDocs} />
        </div>
      )}
    </section>
  );

  const beforeFiling = docsReady && (
    <section className="rw-group" aria-labelledby="g-before">
      <h2 id="g-before" className="rw-gt"><span>ก่อนยื่น <span lang="en">· Before you file</span></span></h2>
      <div className="rw-list">
        {d3?.routing === 'CIVIL' && (
          <div className="rw-row"><div className="rw-rowmain"><div className="rw-rt">ทวงถามเจ้าของบ้านด้วยหนังสือเรียกร้อง</div><div className="rw-rd">{CIVIL_NOTE.th} <span lang="en">· {CIVIL_NOTE.en}</span></div></div></div>
        )}
        <div className="rw-row"><div className="rw-rowmain">
          <div className="rw-rt"><a href="tel:1166">สายด่วน สคบ. 1166</a></div>
          <div className="rw-rd" lang="en">OCPB hotline, or a lawyer, for complex cases.</div>
        </div></div>
      </div>
    </section>
  );

  // Supporting evidence from each agent: collapsed at every width, verdicts never are.
  const evidence = d3 && (
    <section className="rw-group" aria-labelledby="g-evidence">
      <h2 id="g-evidence" className="rw-gt"><span>หลักฐานประกอบ <span lang="en">· Supporting evidence</span></span></h2>
      {d1 && (
        <details className="rw-evidence" data-testid="agent-card">
          <summary><span>ภาพถ่าย <span lang="en">· Photo comparison</span></span><ChevronGlyph /></summary>
          <div className="rw-evidence-body">{photoEvidence()}</div>
        </details>
      )}
      {(d2 || agent02Skipped) && (
        <details className="rw-evidence" data-testid="agent-card">
          <summary><span>สัญญาเช่า <span lang="en">· Lease review</span></span><ChevronGlyph /></summary>
          <div className="rw-evidence-body">
            {agent02Skipped ? <p className="rw-rd">ข้ามขั้นนี้แล้ว <span lang="en">· This step was skipped.</span></p> : contractEvidence()}
          </div>
        </details>
      )}
      <details className="rw-evidence" data-testid="agent-card">
        <summary><span>สรุปคดี <span lang="en">· Case summary</span></span><ChevronGlyph /></summary>
        <div className="rw-evidence-body">
          {route && <p className="rw-rd ink"><b>เส้นทางดำเนินการ · Next step:</b> {route.th} <span lang="en">· {route.en}</span></p>}
          <p>{d3.case_summary_th}</p>
          {d3.case_summary_en && <p className="rw-rd" lang="en">{d3.case_summary_en}</p>}
          {d4 && <p className="rw-note">สร้างเอกสาร {generatedDocs.length} ฉบับใน {d4.generation_time_seconds} วินาที <span lang="en">· {generatedDocs.length} documents in {d4.generation_time_seconds}s</span></p>}
        </div>
      </details>
    </section>
  );

  function photoEvidence() {
    return (
      <>
        {(moveInPreviews.length > 0 || moveOutPreviews.length > 0) && (
          <div className="rw-photos">
            <figure>
              {moveInPreviews[0] ? <img src={moveInPreviews[0]} alt="ภาพวันเข้าอยู่ · Move-in photo" /> : null}
              <figcaption>วันเข้าอยู่ · Move-in ({moveInPreviews.length})</figcaption>
            </figure>
            <figure>
              {moveOutPreviews[0] ? <img src={moveOutPreviews[0]} alt="ภาพวันย้ายออก · Move-out photo" /> : null}
              <figcaption>วันย้ายออก · Move-out ({moveOutPreviews.length})</figcaption>
            </figure>
          </div>
        )}
        {(d1?.damage_map ?? []).map((r, i) => (
          <div key={i} className="rw-group">
            <div className="rw-rt">{r.item}</div>
            <p className="rw-rd ink">
              {r.verdict ? <>{CV_LABEL[r.verdict]?.th ?? r.verdict} <span lang="en">· {CV_LABEL[r.verdict]?.en ?? ''}</span></> : <>ตรวจสอบไม่ได้ <span lang="en">· Unverifiable</span></>}
              {' '}— ความมั่นใจ {Math.round((r.confidence ?? 0) * 100)}% <span lang="en">· confidence {Math.round((r.confidence ?? 0) * 100)}%</span>
            </p>
            <dl className="rw-kv">
              <div><dt>เข้าอยู่ · Move-in</dt><dd>{r.move_in_condition || '—'}</dd></div>
              <div><dt>ย้ายออก · Move-out</dt><dd>{r.move_out_condition || '—'}</dd></div>
            </dl>
            {r.status === 'unverifiable_by_cv' && (
              <p className="rw-note">คุณภาพรูปไม่พอ ขั้นตรวจตามกฎหมายจะใช้สัญญาและกฎหมายเท่านั้น <span lang="en">· Photo quality is too low; the legal check will use the lease and the law only.</span></p>
            )}
          </div>
        ))}
      </>
    );
  }

  function contractEvidence() {
    if (!d2) return null;
    const cs = d2.contract_summary ?? ({} as typeof d2.contract_summary);
    return (
      <>
        {d2.pdf_filename && <p className="rw-rd">อ่านจากไฟล์ · Read from: <b>{d2.pdf_filename}</b></p>}
        <dl className="rw-kv">
          <div><dt>เงินประกัน · Deposit</dt><dd>{baht(cs.deposit_amount_thb)} ({cs.deposit_months ?? 0} เดือน · months)</dd></div>
          <div><dt>ระยะสัญญา · Period</dt><dd>{cs.lease_start || '—'} → {cs.lease_end || '—'}</dd></div>
          <div><dt>แจ้งล่วงหน้า · Notice</dt><dd>{cs.notice_period_days != null ? `${cs.notice_period_days} วัน · days` : '—'}</dd></div>
          <div><dt>ค่าเช่า · Rent</dt><dd>{baht(cs.monthly_rent_thb)}/เดือน · month</dd></div>
        </dl>
        {d2.unfair_clauses?.length > 0 && (
          <div className="rw-group">
            <div className="rw-rt">พบข้อสัญญาที่เป็นโมฆะ ({d2.unfair_clauses.length}) <span className="rw-gloss" lang="en">· Void clauses found</span></div>
            {d2.unfair_clauses.map((u, i) => (
              <div key={i} className="rw-group"><p className="rw-quote">“{u.clause_text}”</p><p className="rw-rd">{u.reason_void}</p></div>
            ))}
          </div>
        )}
        {d2.liability_map?.map((l, i) => (
          <div key={i} className="rw-group">
            <div className="rw-split">
              <div className="rw-rt">{l.item}</div>
              <span className="rw-badge neutral">
                {!hasContract ? <>ไม่มีสัญญา <span lang="en">· No contract given</span></>
                  : l.tenant_liable ? <>ผู้เช่าต้องรับผิด <span lang="en">· Tenant liable</span></>
                  : <>ไม่ต้องรับผิด <span lang="en">· Not liable</span></>}
              </span>
            </div>
            <p className="rw-rd">{l.notes}</p>
            {l.contract_clause && <p className="rw-quote">“{l.contract_clause}”</p>}
          </div>
        ))}
        {((d2.landlord_promises?.length ?? 0) > 0 || (d2.tenant_promises?.length ?? 0) > 0) && (
          <div className="rw-group">
            <div className="rw-rt">หลักฐานจากแชท <span className="rw-gloss" lang="en">· Evidence from chats{(d2.platforms ?? []).length ? ` (${d2.platforms.join(', ')})` : ''}</span></div>
            {(d2.landlord_promises ?? []).map((p, i) => <p key={`l${i}`} className="rw-quote">เจ้าของบ้าน · Landlord: “{p}”</p>)}
            {(d2.tenant_promises ?? []).map((p, i) => <p key={`t${i}`} className="rw-quote">ผู้เช่า · Tenant: “{p}”</p>)}
          </div>
        )}
      </>
    );
  }

  return (
    <div className="rw-shell" id="pipeline">
      <header className="rw-top"><div className="rw-top-in">
        <Link href="/" className="rw-mark">RoomWitness</Link>
        <div className="rw-topright">
          <span className={`rw-live ${running || generatingDocs ? '' : 'rw-only-desktop'}`} role="status" aria-live="polite" data-testid="run-status">{mode === 'running' && <i />}{status}</span>
          {!running && !generatingDocs && <button type="button" className="rw-toplink" onClick={onEditCase}>แก้ไขข้อมูล · Edit case</button>}
        </div>
      </div></header>

      <div className="rw-page">
        <div className="rw-head">
          <h1 className="rw-h1" id="page-heading" ref={h1Ref} tabIndex={-1} data-mode={mode}>{heading.h1}</h1>
          <p className="rw-sub">{heading.sub}</p>
          <ShortDisclaimer />
        </div>

        {(mode === 'running' || mode === 'error') && (
          <>
            <aside className="rw-aside first" aria-label="การวิเคราะห์ · Analysis">
              <section className="rw-group">
                <h2 className="rw-gt"><span>การวิเคราะห์ <span lang="en">· Analysis</span></span></h2>
                {planList}
              </section>
            </aside>
            <main className="rw-main">
              <section className="rw-group" aria-labelledby="g-checking">
                <h2 id="g-checking" className="rw-gt"><span>สิ่งที่ส่งตรวจ <span lang="en">· What is being checked</span></span></h2>
                <div className="rw-list">
                  {claims.map(c => (
                    <div key={c.claim_id} className="rw-row">
                      <div className="rw-rowmain"><div className="rw-rt">{c.item}</div>{c.description && <div className="rw-rd">{c.description}</div>}</div>
                      <div className="rw-amt">{baht(c.amount_thb)}</div>
                    </div>
                  ))}
                </div>
              </section>
              {d1 && (
                <section className="rw-group" aria-labelledby="g-photos">
                  <h2 id="g-photos" className="rw-gt"><span>ภาพถ่าย <span lang="en">· Photos — done</span></span></h2>
                  <div className="rw-list pad">{photoEvidence()}</div>
                </section>
              )}
            </main>
          </>
        )}

        {mode === 'review' && (
          <>
            <main className="rw-main">
              <Headline verdicts={verdicts} totalUnlawful={totalUnlawful} totalClaimed={totalClaimed} />
              {verdictGroup}
              {evidence}
            </main>
            <aside className="rw-aside" aria-label="อนุมัติ · Approval">
              {approval}
              <div className="rw-only-desktop">{planList}</div>
            </aside>
          </>
        )}

        {mode === 'docs' && (
          <>
            <main className="rw-main">
              {docsGroup}
              {beforeFiling}
              {verdictGroup}
              {evidence}
            </main>
            <aside className="rw-aside" aria-label="สรุป · Summary">
              <Headline verdicts={verdicts} totalUnlawful={totalUnlawful} totalClaimed={totalClaimed} compact />
              <Disclaimer />
            </aside>
          </>
        )}
      </div>
      {previewKey && d4?.case_id && d4.documents?.[previewKey] && (
        <DocPreview
          caseId={d4.case_id}
          docKey={previewKey}
          name={DOC_TYPES[previewKey] ?? { th: previewKey, en: previewKey }}
          pages={d4.documents[previewKey].pages}
          onClose={() => {
            // Return focus to the row that opened it (Safari does not focus buttons on click).
            const key = previewKey;
            setPreviewKey(null);
            requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-preview-key="${key}"]`)?.focus());
          }}
        />
      )}
    </div>
  );
}
