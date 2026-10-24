import { InfoGlyph } from '@/components/icons';

// Both wordings are frozen verbatim (handoff §3). The full text is the original
// Pipeline.tsx:112-116 banner; the short line is PRODUCT.md's.
export const DISCLAIMER_LABEL = 'ข้อจำกัดความรับผิดชอบ · Disclaimer:';
export const DISCLAIMER_TH = 'ผลวิเคราะห์นี้จัดทำโดย AI เพื่อช่วยเตรียมข้อมูลเบื้องต้น ไม่ใช่คำแนะนำทางกฎหมายอย่างเป็นทางการ หากกรณีซับซ้อนหรือความเชื่อมั่นต่ำ โปรดติดต่อสายด่วน สคบ. 1166 หรือทนายความ.';
export const DISCLAIMER_EN = 'This is AI-assisted guidance, not formal legal advice. For complex or low-confidence cases, contact the OCPB hotline (1166) or a lawyer.';
export const DISCLAIMER_SHORT = 'ข้อมูลนี้ไม่ใช่คำปรึกษาทางกฎหมาย';

export function Disclaimer() {
  return (
    <div className="disclaimer" role="note" data-testid="disclaimer">
      <strong>{DISCLAIMER_LABEL}</strong>
      <span>{DISCLAIMER_TH}</span>
      <span lang="en" className="disclaimer-en">{DISCLAIMER_EN}</span>
    </div>
  );
}

export function ShortDisclaimer() {
  return <p className="disclaimer-short" data-testid="disclaimer-short"><InfoGlyph size={16} />{DISCLAIMER_SHORT}</p>;
}
