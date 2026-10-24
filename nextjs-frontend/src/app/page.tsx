import Link from 'next/link';
import { CameraIcon, ChevronGlyph, FileTextIcon, ScaleIcon, StackIcon } from '@/components/icons';
import { ROLES, ROLE_COPY, roleHref } from '@/lib/roles';

const PROCESS = [
  { n: '01', th: 'บอกรายการหัก', en: 'List the deductions', text: 'ระบุรายการและจำนวนเงินที่ถูกหัก หรือที่คุณจะหัก', detail: 'Enter what is being charged, or what you plan to charge.' },
  { n: '02', th: 'รวบรวมหลักฐาน', en: 'Add the evidence', text: 'เพิ่มภาพ สัญญา หรือแชทที่เกี่ยวข้อง ถ้ามี', detail: 'Photos, lease terms and messages are optional.' },
  { n: '03', th: 'อ่านผลและทำขั้นต่อไป', en: 'Review and take the next step', text: 'ผลตรวจรายข้อพร้อมเหตุผลและข้อกฎหมาย ผู้เช่าได้เอกสารยื่นเรื่อง ผู้ให้เช่าได้ใบแจ้งรายการหัก', detail: 'Verdicts with legal citations. Tenants get Thai filings; landlords get a deduction statement.' },
];

const EVIDENCE = [
  { Icon: CameraIcon, th: 'ภาพก่อนและหลังเช่า', en: 'Before and after photographs' },
  { Icon: FileTextIcon, th: 'สัญญาและข้อตกลง', en: 'The lease and written agreements' },
  { Icon: ScaleIcon, th: 'ข้อกฎหมายที่เกี่ยวข้อง', en: 'Relevant legal provisions' },
];

export default function LandingPage() {
  return (
    <div className="rw-shell">
      <header className="rw-top"><div className="rw-top-in">
        <Link href="/" className="rw-mark">RoomWitness</Link>
        <Link href="#roles" className="rw-toplink">เริ่มตรวจสอบ · Start a check</Link>
      </div></header>

      <div className="rw-page single">
        <section className="rw-hero">
          <div className="rw-hero-copy">
            <p className="rw-context"><ScaleIcon size={18} /><span>สำหรับผู้เช่าและผู้ให้เช่าในกรุงเทพฯ <span lang="en">· For Bangkok renters and landlords</span></span></p>
            <h1 className="rw-display">เงินประกัน<br />ควรหักอย่างเป็นธรรม</h1>
            <p className="rw-lede-en" lang="en">A fair deduction starts with clear evidence.</p>
            <p className="rw-lede">ตรวจรายการหักเงินประกันทีละข้อ เทียบภาพก่อนและหลังเช่า สัญญา และกฎหมายไทย ไม่ว่าคุณจะเป็นผู้ถูกหักหรือผู้หัก</p>
            <p className="rw-lede-en" lang="en">Check each deposit deduction against the photos, the lease and Thai law, whether you are being charged or doing the charging.</p>
            <Link href="#roles" className="rw-btn start wrap" data-testid="landing-cta">เลือกบทบาทและเริ่มตรวจ <span lang="en">· Choose your role</span></Link>
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
            <div className="rw-row center"><StackIcon size={20} /><div className="rw-rowmain"><div className="rw-rt">ผลตรวจที่ทั้งสองฝ่ายใช้ได้</div><div className="rw-rd" lang="en">One assessment both sides can rely on</div></div></div>
          </div>
        </section>

        <section className="rw-group" id="roles" aria-labelledby="g-roles">
          <h2 id="g-roles" className="rw-gt"><span>คุณคือใคร <span lang="en">· Who are you?</span></span></h2>
          <ul className="rw-roles">
            {ROLES.map(r => {
              const c = ROLE_COPY[r];
              return (
                <li key={r}>
                  <Link href={roleHref(r)} className="rw-role" data-testid={`role-card-${r}`}>
                    <span className="rw-role-title">{c.th} <span className="rw-gloss" lang="en">· {c.en}</span></span>
                    <span className="rw-rd ink">{c.blurbTh}</span>
                    <span className="rw-rd" lang="en">{c.blurbEn}</span>
                    <span className="rw-role-gets"><b>สิ่งที่ได้ · You get</b>{c.getsTh} <span lang="en">· {c.getsEn}</span></span>
                    <span className="rw-role-go">เริ่ม <span lang="en">· Start</span><ChevronGlyph /></span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="rw-short"><span>ช่วยเหลือผู้เช่า เช่น ฝ่ายกิจการนักศึกษา เลือก &quot;ผู้เช่า&quot; <span lang="en">· Helping a tenant, for example from a student affairs office? Choose Tenant.</span></span></p>
        </section>

        <section className="rw-group" aria-labelledby="g-movein">
          <h2 id="g-movein" className="rw-gt"><span>เพิ่งเริ่มสัญญาเช่า? <span lang="en">· Starting a lease?</span></span></h2>
          <div className="rw-list">
            <div className="rw-row center">
              <CameraIcon size={22} />
              <div className="rw-rowmain">
                <div className="rw-rt">เก็บภาพสภาพห้องวันนี้ไว้เปรียบเทียบวันย้ายออก ทั้งผู้เช่าและผู้ให้เช่า</div>
                <div className="rw-rd" lang="en">Tenant or landlord: save the room’s condition today to compare at move-out.</div>
              </div>
            </div>
            <div className="rw-row"><Link href="/move-in" className="rw-btn quiet">บันทึกรูปเข้าอยู่ <span lang="en">· Save move-in photos</span></Link></div>
          </div>
        </section>

        <section className="rw-group" aria-labelledby="g-process">
          <h2 id="g-process" className="rw-gt"><span>จากรายการหักเงิน สู่ข้อยุติที่มีหลักฐาน <span lang="en">· From deductions to a documented outcome</span></span></h2>
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
        <span>หลักฐานชัดเจน เพื่อเงินประกันที่เป็นธรรม <span lang="en">· Clear evidence. Fairer deposit outcomes.</span></span>
      </div></footer>
    </div>
  );
}
