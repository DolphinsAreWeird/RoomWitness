// Who is using RoomWitness. Every role runs the same agents on the same data;
// the role only changes the framing, a few defaults, and what happens after
// approval (tenants get Agent 04's Thai filings, owners get a deduction statement).
export type Role = 'tenant' | 'landlord' | 'business';

export const ROLES: Role[] = ['tenant', 'landlord', 'business'];

export const ROLE_COPY: Record<Role, { th: string; en: string; blurbTh: string; blurbEn: string; getsTh: string; getsEn: string }> = {
  tenant: {
    th: 'ผู้เช่า', en: 'Tenant',
    blurbTh: 'ถูกหักเงินประกันตอนย้ายออก และอยากตรวจสอบหรือโต้แย้ง',
    blurbEn: 'You were charged at move-out and want to check or dispute it.',
    getsTh: 'ผลตรวจรายข้อ และเอกสารภาษาไทยพร้อมยื่น ใช้ฟรี',
    getsEn: 'A verdict per deduction and ready-to-file Thai documents. Free.',
  },
  landlord: {
    th: 'เจ้าของห้องรายย่อย', en: 'Individual landlord',
    blurbTh: 'ปล่อยเช่า 1–2 ห้อง และอยากหักเงินประกันให้ถูกต้อง',
    blurbEn: 'You rent out 1–2 rooms and want every deduction to hold up.',
    getsTh: 'ใบแจ้งรายการหักเงินประกันพร้อมข้อกฎหมาย ก่อนส่งให้ผู้เช่า',
    getsEn: 'A law-cited deduction statement before you send it.',
  },
  business: {
    th: 'ผู้ประกอบการห้องเช่า', en: 'Property business',
    blurbTh: 'อพาร์ตเมนต์ หอพัก หรือผู้บริหารอาคาร ตั้งแต่ 3 ห้องขึ้นไป',
    blurbEn: 'Apartments, dormitories and property managers with 3 or more units.',
    getsTh: 'มาตรฐานเดียวกันทุกห้อง ตามประกาศ สคบ. 2568',
    getsEn: 'One standard for every unit, under the OCPB 2568 rules.',
  },
};

export const isLandlordSide = (r: Role) => r !== 'tenant';

// Default for the rental-units field, which Agent 03's router turns into the legal route:
// 0 = unknown (a tenant often can't tell), 1–2 = civil claim only, 3+ = OCPB 2568 applies.
export const DEFAULT_UNITS: Record<Role, string> = { tenant: '0', landlord: '1', business: '3' };

export function parseRole(v: string | string[] | null | undefined): Role {
  return v === 'landlord' || v === 'business' ? v : 'tenant';
}

export const roleHref = (r: Role) => (r === 'tenant' ? '/app' : `/app?role=${r}`);

// Property businesses only. A licensed dormitory sits outside the OCPB notification,
// and the corpus has no Dormitory Act rules, so its results are guidance only.
export type BuildingType = 'apartment' | 'dorm';

export const DORM_NOTE = {
  th: 'หอพักที่มีใบอนุญาตอยู่ภายใต้ พ.ร.บ.หอพัก พ.ศ. 2558 ไม่ใช่ประกาศ สคบ. เงินประกันไม่เกินค่าเช่า 1 เดือน และคืนเมื่อสัญญาสิ้นสุด ผลตรวจนี้อิง ป.พ.พ. และประกาศ สคบ. จึงใช้เป็นแนวทางเท่านั้น',
  en: 'Licensed dormitories fall under the Dormitory Act 2015, not the OCPB notification: the deposit is capped at one month’s rent and returned when the lease ends. This check uses the Civil Code and OCPB rules, so treat it as guidance only.',
};
