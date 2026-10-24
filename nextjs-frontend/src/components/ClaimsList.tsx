'use client';

import { RefObject } from 'react';
import { Claim } from '@/types';
import { CloseGlyph, PlusGlyph, StepFailGlyph } from '@/components/icons';

interface Props {
  claims: Claim[];
  onChange: (claims: Claim[]) => void;
  // Set when Next was pressed with no named deduction; the first Item field carries it.
  itemError?: boolean;
  firstItemRef?: RefObject<HTMLInputElement>;
}

export const CLAIMS_ERROR_ID = 'claims-item-error';

export default function ClaimsList({ claims, onChange, itemError, firstItemRef }: Props) {
  const add = () => {
    const n = claims.length + 1;
    onChange([...claims, {
      claim_id: `C${String(n).padStart(3, '0')}`,
      item: '', description: '', amount_thb: 0,
    }]);
  };

  const remove = (i: number) =>
    onChange(
      claims
        .filter((_, idx) => idx !== i)
        .map((c, idx) => ({ ...c, claim_id: `C${String(idx + 1).padStart(3, '0')}` }))
    );

  const update = (i: number, field: keyof Claim, value: string | number) =>
    onChange(claims.map((c, idx) => idx === i ? { ...c, [field]: value } : c));

  return (
    <>
      {claims.map((c, i) => {
        const showError = itemError && i === 0;
        const noAmount = c.item.trim() !== '' && !c.amount_thb;
        return (
          <section key={i} className="rw-group" data-testid="claim-row" aria-labelledby={`claim-title-${i}`}>
            <h2 id={`claim-title-${i}`} className="rw-gt">
              <span>รายการที่ {i + 1} <span lang="en">· Deduction {i + 1}</span></span>
              {claims.length > 1 && (
                <button type="button" className="rw-btn icon quiet-ink" aria-label={`ลบรายการ ${i + 1} · Remove deduction ${i + 1}`} onClick={() => remove(i)}>
                  <CloseGlyph />
                </button>
              )}
            </h2>
            <div className="rw-fields">
              <div className="rw-field">
                <label className="rw-label" htmlFor={`claim-item-${i}`}>รายการ <span lang="en">· Item</span></label>
                <input
                  id={`claim-item-${i}`}
                  ref={i === 0 ? firstItemRef : undefined}
                  data-testid="claim-item"
                  className="rw-input"
                  type="text"
                  placeholder="เช่น โซฟา · Sofa"
                  value={c.item}
                  aria-invalid={showError || undefined}
                  aria-describedby={showError ? CLAIMS_ERROR_ID : undefined}
                  onChange={e => update(i, 'item', e.target.value)}
                />
                {showError && (
                  <p id={CLAIMS_ERROR_ID} className="rw-err" data-testid="claims-error">
                    <StepFailGlyph size={20} />
                    <span>กรอกชื่อรายการอย่างน้อย 1 รายการ <span lang="en">· Add at least one deduction</span></span>
                  </p>
                )}
              </div>
              <div className="rw-field">
                <label className="rw-label" htmlFor={`claim-desc-${i}`}>รายละเอียด <span lang="en">· Description</span></label>
                <input
                  id={`claim-desc-${i}`}
                  data-testid="claim-desc"
                  className="rw-input"
                  type="text"
                  placeholder="เช่น คราบบนผ้า · Stain on fabric"
                  value={c.description}
                  onChange={e => update(i, 'description', e.target.value)}
                />
              </div>
              <div className="rw-field">
                <label className="rw-label" htmlFor={`claim-amount-${i}`}>จำนวนเงิน <span lang="en">· Amount</span></label>
                <div className="rw-prefix">
                  <span aria-hidden="true">฿</span>
                  <input
                    id={`claim-amount-${i}`}
                    data-testid="claim-amount"
                    className="rw-input"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    placeholder="0"
                    value={c.amount_thb || ''}
                    aria-describedby={noAmount ? `claim-amount-note-${i}` : undefined}
                    onChange={e => update(i, 'amount_thb', parseFloat(e.target.value) || 0)}
                  />
                </div>
                {noAmount && (
                  <p id={`claim-amount-note-${i}`} className="rw-fieldnote" data-testid="amount-warning">
                    ยังไม่ได้ใส่จำนวนเงิน ดำเนินการต่อได้ <span lang="en">· No amount yet. You can still continue.</span>
                  </p>
                )}
              </div>
            </div>
          </section>
        );
      })}
      <button type="button" className="rw-btn quiet start" onClick={add}>
        <PlusGlyph />เพิ่มรายการ <span lang="en">· Add a deduction</span>
      </button>
    </>
  );
}
