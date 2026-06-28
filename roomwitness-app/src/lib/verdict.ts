// Single source of truth for the verdict→tone mapping. In this design, color means
// "good for the tenant", NOT severity — so UNLAWFUL is GREEN (you recover the money),
// LAWFUL is gray (you owe it). Every badge/card/detail/bar reads from here so they stay
// consistent. The `headline`/`action` strings are presentation copy derived from the
// classification — not backend fields. // ponytail: copy lives here, not in the data.

import type { Classification } from './types';

export type Tone = 'recover' | 'negotiate' | 'valid';

export interface VerdictTone {
  tone: Tone;
  /** hex for things RN can't class (left borders, SVG), matches the tone token */
  color: string;
  /** tailwind class roots, e.g. `${soft}` → "bg-recover-soft" already applied below */
  softBg: string;
  borderClass: string;
  textClass: string;
  softBgClass: string;
  chip: string; // EN verdict word shown in the chip
  chipTh: string;
  headline: string; // TH · EN one-liner for the detail summary box
  action: string; // TH · EN call-to-action shown on the card
}

const MAP: Record<Classification, VerdictTone> = {
  UNLAWFUL: {
    tone: 'recover',
    color: '#1C7A4B',
    softBg: '#E7F1EA',
    borderClass: 'border-recover-border',
    textClass: 'text-recover',
    softBgClass: 'bg-recover-soft',
    chip: 'UNLAWFUL',
    chipTh: 'ผิดกฎหมาย',
    headline: 'การหักเงินนี้ไม่ชอบด้วยกฎหมาย · This deduction is unlawful',
    action: 'ควรเรียกคืน · You should recover this',
  },
  DISPUTED: {
    tone: 'negotiate',
    color: '#A9750F',
    softBg: '#F8F0DA',
    borderClass: 'border-negotiate-border',
    textClass: 'text-negotiate',
    softBgClass: 'bg-negotiate-soft',
    chip: 'DISPUTED',
    chipTh: 'โต้แย้งได้',
    headline: 'รายการนี้ยังโต้แย้งได้ · This one is disputable',
    action: 'ต่อรองได้ · Negotiate this one',
  },
  LAWFUL: {
    tone: 'valid',
    color: '#5A6271',
    softBg: '#ECEAE3',
    borderClass: 'border-valid-border',
    textClass: 'text-valid',
    softBgClass: 'bg-valid-soft',
    chip: 'LAWFUL',
    chipTh: 'ถูกกฎหมาย',
    headline: 'การหักเงินนี้ชอบด้วยกฎหมาย · This deduction is lawful',
    action: 'ค่าใช้จ่ายนี้สมเหตุผล · This charge is valid',
  },
};

export function toneFor(c: Classification): VerdictTone {
  return MAP[c];
}

// The 4 legal dimensions, TH · EN labels — shared by ClaimCard history + the detail screen.
export const DIMS = [
  { key: 'pre_existence', label: 'ก่อนเข้าอยู่ · Pre-existence' },
  { key: 'wear_and_tear', label: 'สึกหรอ · Wear & tear' },
  { key: 'proportionality', label: 'สัดส่วน · Proportionality' },
  { key: 'contractual_clarity', label: 'สัญญา · Contract' },
] as const;

// Photo-verdict (Agent 01 CV) labels.
export const CV_LABEL: Record<string, string> = {
  YES: 'รองรับ (YES)',
  NO: 'ไม่รองรับ (NO)',
  PARTIAL: 'บางส่วน (PARTIAL)',
};

// First sentence of the Thai summary — the one-line teaser on a claim card.
export function firstSentence(s: string): string {
  const m = s.match(/^[^.。\n]*[.。]?/);
  return (m?.[0] ?? s).trim();
}
