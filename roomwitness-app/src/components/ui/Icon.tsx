// lucide wrapper — fixes size + weight + color in one place. See DESIGN_SYSTEM.md §3.6.
// Re-exports only the icons in the emoji→lucide replacement map; one weight (strokeWidth 2),
// sized to text (22). Color is a §1 token key resolved to hex (RN SVG needs a real color).

import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  ChevronDown,
  Circle,
  CircleDot,
  ClipboardList,
  Download,
  FileText,
  FolderOpen,
  Loader,
  Plus,
  X,
} from 'lucide-react-native';

// The only icons the app draws — matches the §3.6 swap map.
const ICONS = {
  Camera,
  Loader,
  Check,
  CircleDot,
  Circle,
  ChevronDown,
  X,
  Plus,
  ArrowRight,
  ArrowLeft,
  ClipboardList,
  FileText,
  FolderOpen,
  Download,
} as const;

export type IconName = keyof typeof ICONS;

// §1 token keys → hex. RN SVG can't read Tailwind classes, so resolve here.
const COLORS = {
  ink: '#16243D',
  navy: '#101D33',
  muted: '#6B7283',
  'muted-2': '#5A6271',
  faint: '#9AA0AC',
  recover: '#1C7A4B',
  negotiate: '#A9750F',
  valid: '#5A6271',
  white: '#FFFFFF',
  'gray-900': '#111827',
  'gray-800': '#1F2937',
  'gray-600': '#4B5563',
  'gray-500': '#6B7280',
  'gray-400': '#9CA3AF',
  'gray-300': '#D1D5DB',
} as const;

export type IconColor = keyof typeof COLORS;

export function Icon({
  name,
  size = 22,
  color = 'gray-500',
  strokeWidth = 2,
}: {
  name: IconName;
  size?: number;
  color?: IconColor;
  strokeWidth?: number;
}) {
  const Cmp = ICONS[name];
  return <Cmp size={size} color={COLORS[color]} strokeWidth={strokeWidth} />;
}
