import Link from 'next/link';
import { CameraIcon, FileTextIcon, ScaleIcon, StackIcon } from '@/components/icons';

const PROCESS = [
  { n: '01', th: 'บอกรายการที่ถูกหัก', en: 'List the deductions', text: 'ระบุรายการและจำนวนเงินตามที่เจ้าของบ้านแจ้ง', detail: 'Enter what your landlord is charging for.' },
  { n: '02', th: 'รวบรวมหลักฐาน', en: 'Add your evidence', text: 'เพิ่มภาพ สัญญา หรือแชทที่เกี่ยวข้อง ถ้ามี', detail: 'Photos, lease terms and messages are optional.' },
  { n: '03', th: 'อ่านผลและเตรียมเอกสาร', en: 'Review and take the next step', text: 'ดูผลวิเคราะห์รายข้อ พร้อมเหตุผล ข้อกฎหมาย และเอกสาร', detail: 'Get claim verdicts, legal citations and Thai documents.' },
];

const EVIDENCE = [
  { Icon: CameraIcon, th: 'ภาพก่อนและหลังเช่า', en: 'Before and after photographs' },
  { Icon: FileTextIcon, th: 'สัญญาและข้อตกลง', en: 'Your lease and written agreements' },
  { Icon: ScaleIcon, th: 'ข้อกฎหมายที่เกี่ยวข้อง', en: 'Relevant legal provisions' },
];

export default function LandingPage() {
  return (
    <div className="rw-shell">
      <header className="rw-top"><div className="rw-top-in">
        <Link href="/" className="rw-mark">RoomWitness</Link>
        <Link href="/app" className="rw-toplink">เริ่มตรวจสอบ · Start a case</Link>
      </div></header>

      <div className="rw-page single">
        <section className="rw-hero">
          <div className="rw-hero-copy">
            <p className="rw-context"><ScaleIcon size={18} /><span>สำหรับผู้เช่าในกรุงเทพฯ <span lang="en">· For Bangkok renters</span></span></p>
            <h1 className="rw-display">เงินประกันของคุณ<br />ควรหักอย่างเป็นธรรม</h1>
            <p className="rw-lede-en" lang="en">A fair deduction starts with clear evidence.</p>
            <p className="rw-lede">ตรวจสอบรายการหักเงิน เทียบภาพก่อนและหลังเช่า และทำความเข้าใจข้อกฎหมาย พร้อมเอกสารสำหรับโต้แย้ง</p>
            <p className="rw-lede-en" lang="en">Review deductions against your photos, lease and Thai law. Turn your evidence into a documented dispute.</p>
            <Link href="/app" className="rw-btn start wrap" data-testid="landing-cta">ตรวจสอบรายการหักเงิน <span lang="en">· Review my deductions</span></Link>
          </div>
          <div className="rw-evidence-card" aria-hidden="true">
            <div className="rw-row center"><ScaleIcon size={22} /><div className="rw-rowmain"><div className="rw-rt">เริ่มจากหลักฐาน</div><div className="rw-rd" lang="en">Build a clearer case</div></div></div>
            {EVIDENCE.map(({ Icon, th, en }, i) => (
              <div key={th} className="rw-row">
                <span className="rw-index">{String(i + 1).padStart(2, '0')}</span>
                <div className="rw-rowmain"><div className="rw-rt">{th}</div><div className="rw-rd" lang="en">{en}</div></div>
                <Icon size={20} />
              </div>
            ))}
            <div className="rw-row center"><StackIcon size={20} /><div className="rw-rowmain"><div className="rw-rt">หลักฐานที่จัดระเบียบแล้ว</div><div className="rw-rd" lang="en">A documented basis for your dispute</div></div></div>
          </div>
        </section>

        <section className="rw-group" aria-labelledby="g-movein">
          <h2 id="g-movein" className="rw-gt"><span>เพิ่งย้ายเข้า? <span lang="en">· Just moved in?</span></span></h2>
          <div className="rw-list">
            <div className="rw-row center">
              <CameraIcon size={22} />
              <div className="rw-rowmain">
                <div className="rw-rt">เก็บภาพสภาพห้องวันนี้ไว้เปรียบเทียบวันย้ายออก</div>
                <div className="rw-rd" lang="en">Save your room photos now to compare when you move out.</div>
              </div>
            </div>
            <div className="rw-row"><Link href="/move-in" className="rw-btn quiet">บันทึกรูปเข้าอยู่ <span lang="en">· Save move-in photos</span></Link></div>
          </div>
        </section>

        <section className="rw-group" aria-labelledby="g-process">
          <h2 id="g-process" className="rw-gt"><span>จากรายการหักเงิน สู่ข้อโต้แย้งที่มีหลักฐาน <span lang="en">· From deductions to a documented dispute</span></span></h2>
          <ol className="rw-steps3">
            {PROCESS.map(s => (
              <li key={s.n}>
                <span className="rw-index">{s.n}</span>
                <h3 className="rw-rt">{s.th} <span className="rw-gloss" lang="en">· {s.en}</span></h3>
                <p className="rw-rd ink">{s.text}</p>
                <p className="rw-rd" lang="en">{s.detail}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <footer className="rw-footer"><div className="rw-footer-in">
        <b>RoomWitness</b>
        <span>หลักฐานชัดเจน เพื่อเงินประกันที่เป็นธรรม <span lang="en">· Clear evidence. Fairer deposit disputes.</span></span>
      </div></footer>
    </div>
  );
}
