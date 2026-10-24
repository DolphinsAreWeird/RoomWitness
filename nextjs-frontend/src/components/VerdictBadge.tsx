import { DisputedGlyph, LawfulGlyph, UnlawfulGlyph } from '@/components/icons';

// Owner decision: the Unlawful badge matches the headline wording.
export const VERDICT_LABEL: Record<string, { th: string; en: string; cls: string }> = {
  LAWFUL:   { th: 'ถูกต้อง',          en: 'Lawful',   cls: 'law' },
  DISPUTED: { th: 'โต้แย้ง',          en: 'Disputed', cls: 'dis' },
  UNLAWFUL: { th: 'ไม่ชอบด้วยกฎหมาย', en: 'Unlawful', cls: 'unl' },
};

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
