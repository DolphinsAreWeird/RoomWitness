import Link from 'next/link';
import { CameraIcon, FileTextIcon, ScaleIcon, StackIcon } from '@/components/icons';

const LINE_ITEMS = [
  { Icon: CameraIcon, label: 'เปรียบเทียบภาพถ่าย', sub: 'Move-in and move-out comparison', price: 25 },
  { Icon: FileTextIcon, label: 'ตรวจข้อสัญญาเช่า', sub: 'Rental contract review', price: 20 },
  { Icon: ScaleIcon, label: 'วิเคราะห์ข้อกฎหมาย', sub: 'Claim assessment with legal citations', price: 24 },
  { Icon: StackIcon, label: 'จัดทำเอกสารภาษาไทย', sub: 'Demand letter, evidence summary & OCPB complaint', price: 30 },
];
const TOTAL_PRICE = LINE_ITEMS.reduce((s, i) => s + i.price, 0);

export default function LandingPage() {
  return (
    <div className="landing">
      <header><div className="header-inner">
        <Link href="/" className="analysis-brand">RoomWitness</Link>
        <Link href="/app" className="text-button">เริ่มตรวจสอบเงินประกัน · Start a case</Link>
      </div></header>
      <main className="landing-main">
        <section className="landing-hero">
          <div className="landing-intro">
            <div className="landing-context"><ScaleIcon size={20} />สำหรับผู้เช่าในกรุงเทพฯ <span>For Bangkok renters</span></div>
            <h1>เงินประกันของคุณ<br />ควรหักอย่างเป็นธรรม</h1>
            <p className="landing-english">A fair deduction starts with clear evidence.</p>
            <p className="landing-description">ตรวจสอบรายการหักเงิน เทียบภาพก่อนและหลังเช่า และทำความเข้าใจข้อกฎหมาย พร้อมเอกสารสำหรับโต้แย้ง</p>
            <p className="landing-description-en">Review deductions against your photos, lease and Thai law. Turn your evidence into a documented dispute.</p>
            <Link href="/app" className="primary-link">ตรวจสอบรายการหักเงิน <span>Review my deductions →</span></Link>
            <p className="landing-cost">กรอกข้อมูลฟรี · วิเคราะห์และจัดทำเอกสาร ฿{TOTAL_PRICE}<small>Free to prepare · Pay once when you analyze</small></p>
          </div>
          <div className="evidence-illustration" aria-hidden="true">
            <div className="illustration-tab">RoomWitness <span>แฟ้มหลักฐาน · Evidence file</span></div>
            <div className="illustration-paper">
              <div className="illustration-title"><ScaleIcon size={26} /><div>เริ่มจากหลักฐาน<small>Build a clearer case</small></div></div>
              <div className="illustration-row"><span className="illustration-index">01</span><div>ภาพก่อนและหลังเช่า<small>Before & after photographs</small></div><CameraIcon size={20} /></div>
              <div className="illustration-row"><span className="illustration-index">02</span><div>สัญญาและข้อตกลง<small>Your lease & written agreements</small></div><FileTextIcon size={20} /></div>
              <div className="illustration-row"><span className="illustration-index">03</span><div>ข้อกฎหมายที่เกี่ยวข้อง<small>Relevant legal provisions</small></div><ScaleIcon size={20} /></div>
              <div className="illustration-outcome"><StackIcon size={20} /><div>หลักฐานที่จัดระเบียบแล้ว<small>A documented basis for your dispute</small></div></div>
            </div>
          </div>
        </section>
        <section className="landing-paths">
          <div><CameraIcon size={24} /><div><h2>เพิ่งย้ายเข้า?</h2><p>เก็บภาพสภาพห้องวันนี้ไว้เปรียบเทียบวันย้ายออก</p><small>Just moved in? Save your room photos for later.</small></div></div>
          <Link href="/move-in" className="btn-secondary">บันทึกรูปเข้าอยู่ฟรี · Save move-in photos</Link>
        </section>
        <section className="landing-process">
          <div className="landing-section-title"><h2>จากรายการหักเงิน สู่ข้อโต้แย้งที่มีหลักฐาน</h2><p>From deductions to a documented dispute</p></div>
          <div className="landing-process-grid">
            {[
              { n: '01', th: 'บอกรายการที่ถูกหัก', en: 'List the deductions', text: 'ระบุรายการและจำนวนเงินตามที่เจ้าของบ้านแจ้ง', detail: 'Enter what your landlord is charging for.' },
              { n: '02', th: 'รวบรวมหลักฐาน', en: 'Add your evidence', text: 'เพิ่มภาพ สัญญา หรือแชทที่เกี่ยวข้อง ถ้ามี', detail: 'Photos, lease terms and messages are optional.' },
              { n: '03', th: 'อ่านผลและเตรียมเอกสาร', en: 'Review & take the next step', text: 'ดูผลวิเคราะห์รายข้อ พร้อมเหตุผล ข้อกฎหมาย และเอกสาร', detail: 'Get claim verdicts, legal citations and Thai documents.' },
            ].map(s => <div key={s.n} className="landing-process-step"><span>{s.n}</span><h3>{s.th}</h3><p className="h2-en">{s.en}</p><p>{s.text}</p><small>{s.detail}</small></div>)}
          </div>
        </section>
        <section className="landing-pricing">
          <div><h2>เตรียมเรื่องฟรี<br />ชำระเมื่อพร้อมวิเคราะห์</h2><p className="landing-english">Prepare for free. Analyze when you’re ready.</p><p>ไม่มีค่าสมาชิก ชำระครั้งเดียวสำหรับการวิเคราะห์และจัดทำเอกสาร</p><small>No subscription. One payment for your case analysis and documents.</small><Link href="/app" className="text-button">เริ่มเตรียมข้อมูล · Prepare my case →</Link></div>
          <div className="invoice-card">
            <div className="invoice-meta"><span>วิเคราะห์และจัดทำเอกสาร<small className="h2-en">Case analysis & documents</small></span><em>ชำระครั้งเดียว<br />One-time</em></div>
            <div className="invoice-total">฿{TOTAL_PRICE}</div>
            {LINE_ITEMS.map(f => <div key={f.label} className="invoice-line"><div className="invoice-line-icon"><f.Icon size={16} color="var(--green)" /></div><div className="invoice-line-text"><b>{f.label}</b><span>{f.sub}</span></div><div className="invoice-line-price">฿{f.price}</div></div>)}
          </div>
        </section>
      </main>
      <footer className="landing-footer"><b>RoomWitness</b><span>หลักฐานชัดเจน เพื่อเงินประกันที่เป็นธรรม<small>Clear evidence. Fairer deposit disputes.</small></span></footer>
    </div>
  );
}
