'use client';

import { Claim } from '@/types';

interface Props {
  claims: Claim[];
  onChange: (claims: Claim[]) => void;
}

export default function ClaimsList({ claims, onChange }: Props) {
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
    <section className="card">
      <h2>รายการหักเงินของเจ้าของบ้าน <span className="h2-en">Landlord claims</span></h2>
      <div>
        {claims.map((c, i) => (
          <div key={i} className="claim-row">
            <div className="claim-num">{i + 1}</div>
            <div className="claim-fields">
              <div className="field">
                <label>รายการ <span className="lbl-en">Item</span></label>
                <input
                  type="text"
                  placeholder="เช่น ผนังห้องนอน · Bedroom wall"
                  value={c.item}
                  onChange={e => update(i, 'item', e.target.value)}
                />
              </div>
              <div className="field claim-desc-field">
                <label>รายละเอียด <span className="lbl-en">Description</span></label>
                <input
                  type="text"
                  placeholder="อธิบายความเสียหาย · Describe the damage"
                  value={c.description}
                  onChange={e => update(i, 'description', e.target.value)}
                />
              </div>
              <div className="field claim-amount-field">
                <label>จำนวนเงิน (บาท) <span className="lbl-en">Amount</span></label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={c.amount_thb || ''}
                  onChange={e => update(i, 'amount_thb', parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
            <button type="button" className="btn-remove" aria-label={`ลบรายการ ${i + 1} · Remove claim`} onClick={() => remove(i)}>✕</button>
          </div>
        ))}
      </div>
      <button type="button" className="btn-secondary" onClick={add}>+ เพิ่มรายการ · Add claim</button>
    </section>
  );
}
