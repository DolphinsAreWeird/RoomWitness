// Small hand-rolled SVG icon set — vector, not emoji, so it renders consistently
// and can be themed with currentColor (per the "no emoji as icons" UX guideline).
type IconProps = { size?: number; color?: string };
const base = (size = 16, color = 'currentColor') => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
  stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
});

export function CameraIcon({ size, color }: IconProps) {
  return (
    <svg {...base(size, color)}>
      <path d="M4 8h3l2-2h6l2 2h3v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8Z" />
      <circle cx="12" cy="13.5" r="3.5" />
    </svg>
  );
}

export function FileTextIcon({ size, color }: IconProps) {
  return (
    <svg {...base(size, color)}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M8 13h8M8 17h5" />
    </svg>
  );
}

export function ScaleIcon({ size, color }: IconProps) {
  return (
    <svg {...base(size, color)}>
      <path d="M12 3v18M7 21h10" />
      <path d="M4 7l4-2 4 2M4 7l-2 6a3 3 0 0 0 4 0Z" />
      <path d="M16 7l4-2 4 2M16 7l-2 6a3 3 0 0 0 4 0Z" transform="translate(-2 0)" />
    </svg>
  );
}

export function StackIcon({ size, color }: IconProps) {
  return (
    <svg {...base(size, color)}>
      <path d="M12 2 2 7l10 5 10-5-10-5Z" />
      <path d="M2 12l10 5 10-5" />
      <path d="M2 17l10 5 10-5" />
    </svg>
  );
}

export function LockIcon({ size, color }: IconProps) {
  return (
    <svg {...base(size, color)}>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

// Glyphs from the redesign sketches (16px or 24px grid). They carry meaning next to
// words, so they are aria-hidden; tokens fall back to the light theme values.
type GlyphProps = { size?: number };
const glyph = (size: number, vb: number) => ({
  width: size, height: size, viewBox: `0 0 ${vb} ${vb}`, 'aria-hidden': true as const, focusable: 'false' as const,
});
const SURFACE = 'var(--surface, #FFFFFF)';
const INK = 'var(--ink, #14212E)';

export function UnlawfulGlyph({ size = 16 }: GlyphProps) {
  return (
    <svg {...glyph(size, 16)}>
      <circle cx="8" cy="8" r="7" fill="currentColor" />
      <path d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8" stroke={SURFACE} strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function DisputedGlyph({ size = 16 }: GlyphProps) {
  return (
    <svg {...glyph(size, 16)}>
      <path d="M8 1.3l7 12.9H1z" fill="currentColor" stroke="currentColor" strokeLinejoin="round" />
      <path d="M8 6v3.6" stroke={SURFACE} strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="8" cy="11.8" r="1" fill={SURFACE} />
    </svg>
  );
}

export function LawfulGlyph({ size = 16 }: GlyphProps) {
  return (
    <svg {...glyph(size, 16)}>
      <circle cx="8" cy="8" r="7" fill="currentColor" />
      <path d="M5 8.2l2 2 4-4.2" fill="none" stroke={SURFACE} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function StepDoneGlyph({ size = 24 }: GlyphProps) {
  return (
    <svg {...glyph(size, 24)}>
      <circle cx="12" cy="12" r="10" fill={INK} />
      <path d="M7.5 12.3l3 3 6-6.3" fill="none" stroke={SURFACE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function StepNowGlyph({ size = 24 }: GlyphProps) {
  return (
    <svg {...glyph(size, 24)}>
      <circle cx="12" cy="12" r="9.5" fill="none" stroke="var(--tint, #2D50C8)" strokeWidth="2" />
      <circle cx="12" cy="12" r="4" fill="var(--tint, #2D50C8)" />
    </svg>
  );
}

export function StepIdleGlyph({ size = 24 }: GlyphProps) {
  return (
    <svg {...glyph(size, 24)}>
      <circle cx="12" cy="12" r="9.5" fill="none" stroke="var(--edge, #7D8792)" strokeWidth="1" />
    </svg>
  );
}

// System and field errors: ink with an outlined "!", never verdict red.
export function StepFailGlyph({ size = 24 }: GlyphProps) {
  return (
    <svg {...glyph(size, 24)}>
      <circle cx="12" cy="12" r="9.25" fill="none" stroke={INK} strokeWidth="2" />
      <path d="M12 7.2v5.6" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="16.4" r="1.25" fill={INK} />
    </svg>
  );
}

export function StepSkipGlyph({ size = 24 }: GlyphProps) {
  return (
    <svg {...glyph(size, 24)}>
      <circle cx="12" cy="12" r="9.5" fill="none" stroke="var(--edge, #7D8792)" strokeWidth="1" />
      <path d="M8 12h8" stroke="var(--ink2, #56616C)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function DocGlyph({ size = 24 }: GlyphProps) {
  return (
    <svg {...glyph(size, 24)}>
      <path d="M6 2.75h8l4.25 4.25v13a1.25 1.25 0 0 1-1.25 1.25H6A1.25 1.25 0 0 1 4.75 20V4A1.25 1.25 0 0 1 6 2.75z M14 2.75V7h4.25 M8 12h8M8 15.5h8"
        fill="none" stroke="var(--ink2, #56616C)" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export function DownloadGlyph({ size = 16 }: GlyphProps) {
  return (
    <svg {...glyph(size, 16)}>
      <path d="M8 2.5v8M4.8 7.6L8 10.8l3.2-3.2M3 13.5h10" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronGlyph({ size = 16 }: GlyphProps) {
  return (
    <svg {...glyph(size, 16)}>
      <path d="M6 3.5l4.5 4.5L6 12.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function InfoGlyph({ size = 16 }: GlyphProps) {
  return (
    <svg {...glyph(size, 16)}>
      <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.25" />
      <path d="M8 7.2v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="4.9" r=".9" fill="currentColor" />
    </svg>
  );
}

export function LockGlyph({ size = 16 }: GlyphProps) {
  return (
    <svg {...glyph(size, 16)}>
      <rect x="3" y="7" width="10" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.25" />
      <path d="M5.2 7V5a2.8 2.8 0 0 1 5.6 0v2" fill="none" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

export function PlusGlyph({ size = 16 }: GlyphProps) {
  return (
    <svg {...glyph(size, 16)}>
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function CloseGlyph({ size = 16 }: GlyphProps) {
  return (
    <svg {...glyph(size, 16)}>
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}
