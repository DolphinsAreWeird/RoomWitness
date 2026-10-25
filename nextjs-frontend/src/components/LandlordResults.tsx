'use client';

import { useMemo } from 'react';
import { Claim, ClaimVerdict } from '@/types';
import { BuildingType, DORM_NOTE, Role } from '@/lib/roles';
import { VERDICT_LABEL } from '@/components/VerdictBadge';
import { ShortDisclaimer } from '@/components/Disclaimer';
import { DownloadGlyph } from '@/components/icons';

// Results for landlords and property businesses. Same Agent 03 verdicts the tenant
// sees; only the framing and the output (a deduction statement) differ.

const baht = (n: number | null | undefined) => `฿${(n ?? 0).toLocaleString()}`;
const sum = (vs: ClaimVerdict[]) => vs.reduce((s, v) => s + (v.amount_thb ?? 0), 0);

// Agent 03's recommended_action_th is written for the tenant; owners see this instead.
export const OWNER_NEXT: Record<string, { th: string; en: string }> = {
  LAWFUL:   { th: 'หักได้ แนบใบเสร็จค่าซ่อมจริงและภาพถ่ายไว้กับใบแจ้ง', en: 'You can deduct this. Attach the real repair receipt and the photos.' },
  DISPUTED: { th: 'ยังไม่ชัดเจน เพิ่มหลักฐานหรือตกลงกับผู้เช่าก่อนหัก',    en: 'Not clear yet. Add evidence or agree it with the tenant before deducting.' },
  UNLAWFUL: { th: 'ไม่ควรหัก คืนจำนวนนี้ให้ผู้เช่า',                     en: 'Do not deduct this. Return it to the tenant.' },
};

// Lawful items start on the statement, disputed ones are the owner's call,
// and items assessed unlawful can never be put on it.
export const isKept = (v: ClaimVerdict, keep: Record<string, boolean>) =>
  v.verdict !== 'UNLAWFUL' && (keep[v.claim_id] ?? v.verdict === 'LAWFUL');

// OCPB 2568 rules apply from 3 units (Agent 03 routing), but never to a licensed dormitory.
export const ocpbApplies = (routing: string | undefined, buildingType?: BuildingType) =>
  routing === 'OCPB' && buildingType !== 'dorm';

export function OwnerHeadline({ verdicts, keep, deposit, compact }: {
  verdicts: ClaimVerdict[]; keep: Record<string, boolean>; deposit: number; compact?: boolean;
}) {
  const by = (verdict: string) => sum(verdicts.filter(v => v.verdict === verdict));
  const total = sum(verdicts);
  const kept = sum(verdicts.filter(v => isKept(v, keep)));
  return (
    <div className={`rw-figure ${compact ? 'compact' : ''}`} data-testid="owner-headline">
      <div className="rw-num">{baht(by('LAWFUL'))}</div>
      <div className="rw-numcap">หักได้ตามข้อกฎหมายที่อ้างอิง<span lang="en">supported by cited law</span></div>
      <dl className="rw-tally">
        <div><dt><i className="dis" /><span>ควรทบทวน <span lang="en">· Needs review</span></span></dt><dd>{baht(by('DISPUTED'))}</dd></div>
        <div><dt><i className="unl" /><span>ไม่ควรหัก <span lang="en">· Should not deduct</span></span></dt><dd>{baht(by('UNLAWFUL'))}</dd></div>
      </dl>
      <div className="rw-of">จาก {baht(total)} ที่จะหัก <span lang="en">· of {baht(total)} you plan to deduct</span></div>
      {deposit > 0 && (
        <p className="rw-route">
          คืนผู้เช่า {baht(Math.max(0, deposit - kept))} จากเงินประกัน {baht(deposit)} ตามรายการที่เลือก{' '}
          <span lang="en">· Refund {baht(Math.max(0, deposit - kept))} of the {baht(deposit)} deposit, based on what you keep.</span>
        </p>
      )}
    </div>
  );
}

export function KeepToggle({ v, keep, onChange }: {
  v: ClaimVerdict; keep: Record<string, boolean>; onChange: (claimId: string, on: boolean) => void;
}) {
  const unlawful = v.verdict === 'UNLAWFUL';
  const noteId = `keep-note-${v.claim_id}`;
  return (
    <div className="rw-keep">
      <label className="rw-check">
        <input type="checkbox" data-testid="keep-toggle" checked={isKept(v, keep)} disabled={unlawful}
          aria-describedby={unlawful ? noteId : undefined} onChange={e => onChange(v.claim_id, e.target.checked)} />
        <span>รวมในใบแจ้งหัก <span lang="en">· Include in the statement</span></span>
      </label>
      {unlawful && (
        <p id={noteId} className="rw-fieldnote">รายการที่ประเมินว่าไม่ชอบด้วยกฎหมายจะไม่อยู่ในใบแจ้ง <span lang="en">· Items assessed unlawful are left off the statement.</span></p>
      )}
    </div>
  );
}

interface StatementProps {
  verdicts: ClaimVerdict[];
  claims: Claim[];
  keep: Record<string, boolean>;
  deposit: number;
  unitLabel: string;
  routing?: string;
  buildingType?: BuildingType;
}

export function DeductionStatement({ verdicts, claims, keep, deposit, unitLabel, routing, buildingType }: StatementProps) {
  const items = verdicts.filter(v => isKept(v, keep));
  const left = verdicts.filter(v => !isKept(v, keep));
  const kept = sum(items);
  const over = deposit > 0 ? kept - deposit : 0;
  const ocpb = ocpbApplies(routing, buildingType);
  // Fixed for the life of this result, so a reprint carries the same reference.
  const ref = useMemo(() => `RW-S-${Date.now().toString(36).toUpperCase()}`, []);
  const date = useMemo(() => new Date().toLocaleDateString('th-TH', { dateStyle: 'long' }), []);
  const descFor = (v: ClaimVerdict) => claims.find(c => c.claim_id === v.claim_id)?.description;
  const unit = unitLabel.trim();

  return (
    <section className="rw-group" id="case-documents" data-testid="statement-section" aria-labelledby="g-statement">
      <h2 id="g-statement" className="rw-gt"><span>ใบแจ้งรายการหักเงินประกัน <span lang="en">· Deduction statement</span></span></h2>
      <article className="rw-statement" id="deduction-statement" data-testid="statement" aria-labelledby="stmt-title">
        <header className="rw-stmt-head">
          <span className="rw-mark">RoomWitness</span>
          <h3 id="stmt-title">ใบแจ้งรายการหักเงินประกัน</h3>
          <p className="rw-rd" lang="en">Deposit deduction statement</p>
          <p className="rw-rd">เลขที่ · Ref {ref} · {date}{unit && <> · ห้อง · Unit {unit}</>}</p>
        </header>

        <table className="rw-stmt-table">
          <thead>
            <tr><th scope="col">รายการ <span lang="en">· Item</span></th><th scope="col" className="num">จำนวน <span lang="en">· Amount</span></th></tr>
          </thead>
          <tbody>
            {items.map(v => {
              const label = VERDICT_LABEL[v.verdict];
              return (
                <tr key={v.claim_id} data-testid="statement-row">
                  <td>
                    <div className="rw-rt">{v.item}</div>
                    {descFor(v) && <div className="rw-rd">{descFor(v)}</div>}
                    <div className="rw-rd">ผลตรวจ · Check: <b className={`rw-vtext ${label?.cls ?? ''}`}>{label ? `${label.th} · ${label.en}` : v.verdict}</b></div>
                    {v.citations?.length > 0 && <div className="rw-rd">อ้างอิง · Law: {v.citations.join(' · ')}</div>}
                  </td>
                  <td className="num">{baht(v.amount_thb)}</td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr><td colSpan={2} className="rw-rd">ไม่มีรายการหัก <span lang="en">· No deductions</span></td></tr>
            )}
          </tbody>
          <tfoot>
            <tr><th scope="row">รวมหัก <span lang="en">· Total deducted</span></th><td className="num">{baht(kept)}</td></tr>
            {deposit > 0 && (
              <>
                <tr><th scope="row">เงินประกันที่ถือไว้ <span lang="en">· Deposit held</span></th><td className="num">{baht(deposit)}</td></tr>
                <tr className="due"><th scope="row">คืนผู้เช่า <span lang="en">· Refund to tenant</span></th><td className="num" data-testid="statement-refund">{baht(Math.max(0, -over))}</td></tr>
              </>
            )}
          </tfoot>
        </table>

        <div className="rw-stmt-notes">
          {over > 0 && (
            <p className="rw-note">ยอดหักเกินเงินประกัน {baht(over)} ส่วนนี้ต้องเรียกเก็บแยกต่างหาก <span lang="en">· Deductions exceed the deposit by {baht(over)}; that part has to be claimed separately.</span></p>
          )}
          {items.some(v => v.verdict === 'DISPUTED') && (
            <p className="rw-note">รายการที่ผลตรวจเป็น &quot;โต้แย้ง&quot; ยังไม่มีข้อยุติ ควรแนบหลักฐานและตกลงกับผู้เช่า <span lang="en">· Items checked as Disputed are not settled: attach evidence and agree them with the tenant.</span></p>
          )}
          {left.length > 0 && (
            <p className="rw-note">ไม่รวม {left.length} รายการ ({baht(sum(left))}) ที่ไม่ได้เลือกหรือประเมินว่าไม่ควรหัก <span lang="en">· {left.length} item{left.length !== 1 ? 's' : ''} ({baht(sum(left))}) left off: not chosen, or assessed as not deductible.</span></p>
          )}
          <p className="rw-note">
            ตรวจโดย RoomWitness เทียบกับ ป.พ.พ. มาตรา 537–571{ocpb ? ' และประกาศ สคบ. 2568' : ''}{' '}
            <span lang="en">· Checked by RoomWitness against Civil and Commercial Code §537–571{ocpb ? ' and the OCPB 2568 notification' : ''}.</span>
          </p>
        </div>

        <div className="rw-sign">
          <div><span className="line" />ผู้ให้เช่า <span lang="en">· Landlord</span></div>
          <div><span className="line" />ผู้เช่า <span lang="en">· Tenant</span></div>
        </div>
        <ShortDisclaimer />
      </article>
      <div className="rw-inline-actions rw-noprint">
        <button type="button" className="rw-btn small" data-testid="print-statement" onClick={() => window.print()}>
          <DownloadGlyph />พิมพ์หรือบันทึก PDF <span lang="en">· Print or save as PDF</span>
        </button>
      </div>
    </section>
  );
}

export function OwnerBeforeSend({ role, routing, buildingType }: { role: Role; routing?: string; buildingType?: BuildingType }) {
  const ocpb = ocpbApplies(routing, buildingType);
  const rows: Array<{ th: React.ReactNode; en: string }> = [
    { th: 'แนบภาพก่อน–หลังและใบเสร็จค่าซ่อมจริง', en: 'Attach the before-and-after photos and the real repair receipts.' },
  ];
  if (ocpb) {
    rows.push(
      { th: 'คืนเงินประกันภายใน 7 วัน หรือไม่เกิน 14 วันเมื่อมีการหัก ตามแบบสัญญา', en: 'Return the deposit within 7 days, or within 14 days at most when you deduct, per the contract form.' },
      { th: 'ค่าน้ำค่าไฟที่หักต้องไม่เกินอัตราที่ผู้ให้บริการเรียกเก็บ', en: 'Utility deductions can’t be higher than the provider’s actual rate.' },
    );
  }
  if (role === 'business') {
    rows.push({ th: 'ผู้ประกอบการมีภาระพิสูจน์ เก็บภาพวันเข้าอยู่ที่ลงวันที่ไว้ทุกห้อง', en: 'As a business, the burden of proof is on you (Consumer Case Procedure Act s.29). Keep dated move-in photos for every unit.' });
  }
  if (buildingType === 'dorm') rows.push({ th: DORM_NOTE.th, en: DORM_NOTE.en });
  if (!ocpb && buildingType !== 'dorm') {
    rows.push({ th: 'ผู้เช่าที่ไม่เห็นด้วยอาจทวงถามหรือฟ้องทางแพ่ง ใบแจ้งที่มีหลักฐานช่วยให้ตกลงกันได้เร็วขึ้น', en: 'A tenant who disagrees can send a demand or file a civil claim. A statement backed by evidence helps you settle quickly.' });
  }
  rows.push({ th: <a href="tel:1166">สายด่วน สคบ. 1166</a>, en: 'OCPB hotline, or a lawyer, for complex cases.' });

  return (
    <section className="rw-group" aria-labelledby="g-before" data-testid="owner-before-send">
      <h2 id="g-before" className="rw-gt"><span>ก่อนส่งให้ผู้เช่า <span lang="en">· Before you send it</span></span></h2>
      <div className="rw-list">
        {rows.map((r, i) => (
          <div key={i} className="rw-row"><div className="rw-rowmain"><div className="rw-rt">{r.th}</div><div className="rw-rd" lang="en">{r.en}</div></div></div>
        ))}
      </div>
    </section>
  );
}
