'use client';

import { useState } from 'react';
import { PipelineResults, StepState } from '@/types';

// Thai primary, English secondary
const CV_LABEL: Record<string, { th: string; en: string }> = {
  NORMAL_WEAR:  { th: 'สึกหรอตามปกติ',     en: 'Normal wear & tear' },
  PRE_EXISTING: { th: 'เสียหายอยู่ก่อนแล้ว', en: 'Pre-existing damage' },
  UNCHANGED:    { th: 'ไม่เปลี่ยนแปลง',     en: 'No change' },
  NEW_DAMAGE:   { th: 'ความเสียหายใหม่',    en: 'New damage' },
};
const VERDICT_LABEL: Record<string, { th: string; en: string }> = {
  LAWFUL:   { th: 'ถูกต้อง',   en: 'Lawful' },
  DISPUTED: { th: 'โต้แย้ง',   en: 'Disputed' },
  UNLAWFUL: { th: 'ผิดกฎหมาย', en: 'Unlawful' },
};

const DOC_TYPES: Array<{ key: string; th: string; en: string; icon: string }> = [
  { key: 'demand_letter',    th: 'หนังสือเรียกร้องคืนเงินประกัน', en: 'Demand letter',    icon: '📨' },
  { key: 'evidence_summary', th: 'สรุปหลักฐานและผลวินิจฉัย',     en: 'Evidence summary', icon: '📋' },
  { key: 'ocpb_complaint',   th: 'หนังสือร้องเรียน สคบ.',          en: 'OCPB complaint',   icon: '🏛️' },
];

function esc(s: unknown) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

interface StepBadgeProps { n: number; state: StepState; label: string; }
function StepBadge({ n, state, label }: StepBadgeProps) {
  return (
    <div className={`pip-step ${state}`} aria-current={state === 'active' ? 'step' : undefined}>
      <div className="pip-dot">{state === 'done' ? '✓' : state === 'error' ? '!' : n}</div>
      {label}
    </div>
  );
}

interface AgentCardProps {
  n: number;
  title: string;
  titleTh: string;
  subtitle: string;
  colorClass: string;
  state: StepState;
  children?: React.ReactNode;
}
function AgentCard({ n, title, titleTh, subtitle, colorClass, state, children }: AgentCardProps) {
  // Mobile (<768px): cards collapse to a single-line summary with an expand toggle
  const [mobileOpen, setMobileOpen] = useState(false);
  if (state === 'idle') return null;
  return (
    <div id={`assessment-${n}`} className={`agent-card ${mobileOpen ? '' : 'mob-collapsed'}`}>
      <div className="agent-card-hdr">
        <div className={`agent-num ${colorClass}`}>{String(n).padStart(2, '0')}</div>
        <div className="agent-card-titles">
          <h3>{titleTh} <span className="h3-en">{title}</span></h3>
          <p>{subtitle}</p>
        </div>
        <div className="agent-status" role="status">
          {state === 'active' && <><span className="spinner-sm" />กำลังวิเคราะห์…</>}
          {state === 'done'   && <span className="ok">✓ เสร็จสิ้น</span>}
          {state === 'error'  && <span style={{ color: 'var(--red)' }}>✗ ผิดพลาด</span>}
        </div>
        {state === 'done' && (
          <button
            type="button"
            className="agent-expand-toggle"
            onClick={() => setMobileOpen(o => !o)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? 'Collapse' : 'Expand'}
          >
            {mobileOpen ? '▴' : '▾'}
          </button>
        )}
      </div>
      {state === 'done' && <div className="agent-body">{children}</div>}
    </div>
  );
}

interface Props {
  steps: StepState[];
  results: PipelineResults;
  moveInPreviews:  string[];
  moveOutPreviews: string[];
  depositAmount?: string;
  awaitingDocApproval?: boolean;
  generatingDocs?: boolean;
  onApproveDocs?: () => void;
}

export default function Pipeline({ steps, results, moveInPreviews, moveOutPreviews, depositAmount, awaitingDocApproval, generatingDocs, onApproveDocs }: Props) {
  const [s1, s2, s3, s4] = steps;
  const allDone = steps.every(s => s === 'done');

  // Hero strip: sum of UNLAWFUL verdicts = money the tenant can recover
  const recoverable = (results.agent03?.verdicts ?? [])
    .filter(v => v.verdict === 'UNLAWFUL')
    .reduce((sum, v) => sum + (v.amount_thb ?? 0), 0);
  const totalClaimed = results.agent03?.total_claimed_thb
    ?? (results.agent03?.verdicts ?? []).reduce((sum, v) => sum + (v.amount_thb ?? 0), 0);
  const depositNum = parseFloat(depositAmount || '') || 0;

  return (
    <div id="pipeline">
      <div className="pipeline-heading">
        <h2>{allDone ? 'ผลการวิเคราะห์ของคุณ' : 'กำลังตรวจสอบหลักฐานของคุณ'}</h2>
        <p>{allDone ? 'Your case assessment' : 'Evidence review · Live analysis progress'}</p>
      </div>
      <div className="disclaimer-banner" role="note">
        <strong>ข้อจำกัดความรับผิดชอบ · Disclaimer:</strong>{' '}
        ผลวิเคราะห์นี้จัดทำโดย AI เพื่อช่วยเตรียมข้อมูลเบื้องต้น ไม่ใช่คำแนะนำทางกฎหมายอย่างเป็นทางการ
        หากกรณีซับซ้อนหรือความเชื่อมั่นต่ำ โปรดติดต่อสายด่วน สคบ. 1166 หรือทนายความ.{' '}
        <span className="disclaimer-en">This is AI-assisted guidance, not formal legal advice. For complex or
        low-confidence cases, contact the OCPB hotline (1166) or a lawyer.</span>
      </div>
      {results.agent03 && <nav className="assessment-nav" aria-label="Assessment sections">
        <a href="#assessment-3">ผลวินิจฉัย<small>Claim verdicts</small></a>
        <a href="#assessment-1">หลักฐานภาพถ่าย<small>Photo evidence</small></a>
        <a href="#assessment-2">สัญญาเช่า<small>Contract review</small></a>
        {results.agent04?.case_id && <a href="#case-documents">เอกสารของคุณ<small>Your documents</small></a>}
      </nav>}
      {/* Progress bar */}
      <div className="pip-bar">
        <StepBadge n={1} state={s1} label="ภาพถ่าย · Photos" />
        <div className="pip-line" />
        <StepBadge n={2} state={s2} label="สัญญา · Contract" />
        <div className="pip-line" />
        <StepBadge n={3} state={s3} label="กฎหมาย · Legal" />
        <div className="pip-line" />
        <StepBadge n={4} state={s4} label="เอกสาร · Docs" />
      </div>

      {/* Hero ฿ recoverable strip — the emotional payoff */}
      {allDone && results.agent03 && (
        <div className="hero-strip">
          <div className="hero-main">
            <div className="hero-amount">฿{recoverable.toLocaleString()}</div>
            <div className="hero-caption">
              เงินที่เรียกคืนได้ <span className="hero-en">recoverable</span>
            </div>
          </div>
          <div className="hero-side">
            <div className="hero-fact">
              <label>ยอดที่ถูกเรียกร้อง · claimed</label>
              <span>฿{totalClaimed.toLocaleString()}</span>
            </div>
            {depositNum > 0 && (
              <div className="hero-fact">
                <label>เงินประกันที่วางไว้ · your deposit</label>
                <span>฿{depositNum.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Agent 01 */}
      <AgentCard n={1} titleTh="ตรวจสอบความเสียหายด้วย AI" title="CV Damage Assessment" subtitle="AI Vision Model · ภาพถ่ายเปรียบเทียบ" colorClass="a01" state={s1}>
        {/* Photo strip — shown once, not per claim */}
        {(moveInPreviews.length > 0 || moveOutPreviews.length > 0) && (
          <div className="cv-photo-strip">
            <div className="cv-strip-col">
              <div className="cv-photo-label">เข้าอยู่ · Move-in</div>
              <div className="cv-strip-imgs">
                {moveInPreviews.map((src, i) => <img key={i} src={src} className="cv-strip-img" alt="" />)}
              </div>
            </div>
            <div className="cv-photos-arrow">→</div>
            <div className="cv-strip-col">
              <div className="cv-photo-label">ย้ายออก · Move-out</div>
              <div className="cv-strip-imgs">
                {moveOutPreviews.map((src, i) => <img key={i} src={src} className="cv-strip-img" alt="" />)}
              </div>
            </div>
          </div>
        )}
        <div className="cv-results">
          {results.agent01?.damage_map.map((r, i) => (
            <div key={i} className="cv-row">
              <div className="cv-info">
                <div className="cv-info-header">
                  {r.item && <strong>{esc(r.item)}</strong>}
                  <span className={`badge badge-${(r.verdict ?? 'none').toLowerCase()}`}>
                    {r.verdict
                      ? <>{CV_LABEL[r.verdict]?.th ?? r.verdict} <span className="badge-en">{CV_LABEL[r.verdict]?.en ?? ''}</span></>
                      : <>ตรวจสอบไม่ได้ <span className="badge-en">Unverifiable</span></>}
                  </span>
                  <span className="badge badge-conf">ความมั่นใจ {Math.round((r.confidence ?? 0) * 100)}%</span>
                </div>
                <div className="cv-condition">
                  <span>เข้าอยู่:</span> {esc(r.move_in_condition)}<br />
                  <span>ย้ายออก:</span> {esc(r.move_out_condition)}
                </div>
                {r.status === 'unverifiable_by_cv' && (
                  <div className="unverifiable-note">⚠ คุณภาพรูปไม่พอ — Agent 03 จะวิเคราะห์จากสัญญาและกฎหมายเท่านั้น</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </AgentCard>

      {/* Agent 02 */}
      <AgentCard n={2} titleTh="วิเคราะห์สัญญาเช่า" title="Contract Parser" subtitle="pdfplumber · ข้อสัญญาและเงินประกัน" colorClass="a02" state={s2}>
        {results.agent02 && (() => {
          const d = results.agent02!;
          const cs = d.contract_summary;
          const hasChatEvidence =
            (d.landlord_promises?.length ?? 0) > 0 || (d.tenant_promises?.length ?? 0) > 0;
          return (
            <>
              {d.pdf_filename && <div className="parsed-from">อ่านจากไฟล์: <strong>{esc(d.pdf_filename)}</strong></div>}
              <div className="info-grid">
                <div className="info-box"><label>เงินประกัน · Deposit</label><span>฿{(cs.deposit_amount_thb ?? 0).toLocaleString()} ({cs.deposit_months ?? 0} เดือน)</span></div>
                <div className="info-box"><label>ระยะสัญญา · Period</label><span>{cs.lease_start || '—'} → {cs.lease_end || '—'}</span></div>
                <div className="info-box"><label>แจ้งล่วงหน้า · Notice</label><span>{cs.notice_period_days ?? 30} วัน</span></div>
                <div className="info-box"><label>ค่าเช่า · Rent</label><span>฿{(cs.monthly_rent_thb ?? 0).toLocaleString()}/เดือน</span></div>
              </div>
              {d.unfair_clauses?.length > 0 && (
                <div className="unfair-banner">
                  <h4>⚠ พบข้อสัญญาที่เป็นโมฆะ ({d.unfair_clauses.length}) <span className="lbl-en">Void clauses found</span></h4>
                  {d.unfair_clauses.map((u, i) => (
                    <div key={i}><p>"{esc(u.clause_text)}"</p><small>{esc(u.reason_void)}</small></div>
                  ))}
                </div>
              )}
              <div className="liability-rows">
                {d.liability_map?.map((l, i) => (
                  <div key={i} className="liability-row">
                    <span className={`badge ${l.tenant_liable ? 'badge-unlawful' : 'badge-lawful'}`}>
                      {l.tenant_liable
                        ? <>ผู้เช่าต้องรับผิด <span className="badge-en">Tenant liable</span></>
                        : <>ไม่ต้องรับผิด <span className="badge-en">Not liable</span></>}
                    </span>
                    <div>
                      <div className="liability-text">{esc(l.notes)}</div>
                      {l.contract_clause && <div className="liability-clause">"{esc(l.contract_clause)}"</div>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Evidence extracted from chat screenshots */}
              {hasChatEvidence && (
                <div className="chat-evidence">
                  <h4>
                    หลักฐานจากแชท <span className="lbl-en">Evidence from chats</span>
                    {(d.platforms ?? []).map((p, i) => (
                      <span key={i} className="platform-badge">{esc(p)}</span>
                    ))}
                  </h4>
                  <div className="promise-cols">
                    {(d.landlord_promises?.length ?? 0) > 0 && (
                      <div className="promise-col promise-landlord">
                        <div className="promise-col-label">เจ้าของบ้านพูดไว้ · Landlord promises</div>
                        {d.landlord_promises!.map((p, i) => (
                          <div key={i} className="promise-item">“{esc(p)}”</div>
                        ))}
                      </div>
                    )}
                    {(d.tenant_promises?.length ?? 0) > 0 && (
                      <div className="promise-col promise-tenant">
                        <div className="promise-col-label">ผู้เช่าแย้งไว้ · Tenant statements</div>
                        {d.tenant_promises!.map((p, i) => (
                          <div key={i} className="promise-item">“{esc(p)}”</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </AgentCard>

      {/* Agent 03 */}
      <AgentCard n={3} titleTh="วิเคราะห์ข้อกฎหมาย" title="Legal Reasoning" subtitle="Groq · ChromaDB RAG · ประกาศ สคบ. 2568 + ป.พ.พ." colorClass="a03" state={s3}>
        {results.agent03 && (() => {
          const d = results.agent03!;
          const pct = d.total_claimed_thb ? Math.round(d.total_unlawful_thb / d.total_claimed_thb * 100) : 0;
          return (
            <>
              <div className="totals-bar">
                <div className="total-box t-claimed"><label>ยอดเรียกร้องทั้งหมด · claimed</label><span>฿{(d.total_claimed_thb ?? 0).toLocaleString()}</span></div>
                <div className="total-box t-unlawful"><label>ผิดกฎหมาย ({pct}%) · unlawful</label><span>฿{(d.total_unlawful_thb ?? 0).toLocaleString()}</span></div>
                <div className="total-box t-route"><label>ช่องทาง · route</label><span>{d.routing || '—'}</span></div>
              </div>
              <div className="verdict-rows">
                {d.verdicts?.map((v, i) => (
                  <div key={i} className={`verdict-row v-${(v.verdict ?? '').toLowerCase()}`}>
                    <div className="verdict-row-header">
                      <strong>{esc(v.item)}</strong>
                      <span className={`badge badge-${(v.verdict ?? '').toLowerCase()}`}>
                        {VERDICT_LABEL[v.verdict]
                          ? <>{VERDICT_LABEL[v.verdict].th} <span className="badge-en">{VERDICT_LABEL[v.verdict].en}</span></>
                          : (v.verdict ?? '—')}
                      </span>
                      <span className="verdict-amount">฿{(v.amount_thb ?? 0).toLocaleString()}</span>
                    </div>
                    <div className="verdict-reasoning">{esc(v.reasoning_th)}</div>
                    {v.reasoning_en && (
                      <div className="verdict-reasoning-en">{esc(v.reasoning_en)}</div>
                    )}
                    {v.citations?.length > 0 && (
                      <div className="verdict-cites">
                        {v.citations.map((c, j) => <span key={j} className="cite">{esc(c)}</span>)}
                      </div>
                    )}
                    <div className="verdict-action">💡 {esc(v.recommended_action_th)}</div>
                  </div>
                ))}
              </div>
              <div className="case-summary">
                <h4>สรุปคดี <span className="lbl-en">Case Summary</span></h4>
                <p>{esc(d.case_summary_th)}</p>
                {d.case_summary_en && <p className="en">{esc(d.case_summary_en)}</p>}
              </div>
            </>
          );
        })()}
      </AgentCard>

      {/* Responsible AI: explicit tenant approval before any document is generated */}
      {awaitingDocApproval && (
        <div className="approval-gate" role="region" aria-label="Document generation approval">
          <h4>ยืนยันก่อนสร้างเอกสาร <span className="lbl-en">Approve before generating documents</span></h4>
          <p>
            โปรดตรวจสอบผลวินิจฉัยด้านบนก่อนให้ AI สร้างเอกสารกฎหมายทั้ง 3 ฉบับ
            <br />
            <span className="approval-en">Please review the legal verdicts above before AI generates your 3 legal documents.</span>
          </p>
          <button type="button" className="btn-approve" onClick={onApproveDocs} disabled={generatingDocs}>
            {generatingDocs ? 'กำลังสร้างเอกสาร… · Generating…' : 'อนุมัติและสร้างเอกสาร · Approve & generate'}
          </button>
        </div>
      )}

      {/* Agent 04 */}
      <AgentCard n={4} titleTh="สร้างเอกสารกฎหมาย" title="Document Generator" subtitle="AI Document Generator · ReportLab" colorClass="a04" state={s4}>
        {results.agent04 && (() => {
          const d = results.agent04!;
          return (
            <div className="gen-meta">
              สร้างเสร็จใน {d.generation_time_seconds} วินาที · เรียกคืนได้:{' '}
              <strong>฿{(d.total_unlawful_amount_thb ?? 0).toLocaleString()}</strong>
            </div>
          );
        })()}
      </AgentCard>

      {/* Download section — prominent, below the pipeline */}
      {results.agent04?.case_id && (
        <section id="case-documents" className="download-section">
          <h2 className="download-title">
            ดาวน์โหลดเอกสารของคุณ
            <span className="download-title-en">Download your documents</span>
          </h2>
          <p className="download-sub">เอกสาร 3 ฉบับ พร้อมยื่นได้ทันที · 3 ready-to-file Thai legal documents</p>
          <div className="dl-cards">
            {DOC_TYPES.map(({ key, th, en, icon }) => {
              const doc = results.agent04!.documents?.[key];
              const caseId = results.agent04!.case_id!;
              return (
                <div key={key} className={`dl-card ${doc ? '' : 'dl-card-missing'}`}>
                  <div className="dl-icon">{icon}</div>
                  <div className="dl-name">{th}</div>
                  <div className="dl-name-en">{en}</div>
                  <div className="dl-meta">
                    <span className="dl-filetype">PDF</span>
                    {doc && <span>{doc.pages} หน้า · {doc.pages} page{doc.pages !== 1 ? 's' : ''}</span>}
                  </div>
                  {doc ? (
                    <a
                      className="dl-btn"
                      href={`/download/${caseId}/${key}`}
                      download={`${key}_${caseId}.pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      ⬇ ดาวน์โหลด · Download
                    </a>
                  ) : (
                    <button className="dl-btn" disabled>ไม่ได้สร้าง · Not generated</button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
