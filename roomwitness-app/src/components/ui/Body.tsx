// Default text primitive. THIS is the font fix — sets `font-thai` so Thai stops falling back
// to the system font. Use everywhere instead of bare <Text>. See DESIGN_SYSTEM.md §3.4.

import { Text, type TextProps } from 'react-native';

const TONE = {
  default: 'text-ink',
  label: 'text-muted',
  caption: 'text-muted-2',
  muted: 'text-faint',
} as const;

const SIZE = { sm: 'text-sm', base: 'text-base' } as const;
const WEIGHT = { normal: '', semibold: 'font-semibold', bold: 'font-bold' } as const;

export function Body({
  tone = 'default',
  size = 'base',
  weight = 'normal',
  className = '',
  children,
  ...rest
}: TextProps & {
  tone?: keyof typeof TONE;
  size?: keyof typeof SIZE;
  weight?: keyof typeof WEIGHT;
}) {
  // className last so caller overrides win (NativeWind merges last-wins).
  return (
    <Text
      className={`font-thai ${TONE[tone]} ${SIZE[size]} ${WEIGHT[weight]} ${className}`}
      {...rest}
    >
      {children}
    </Text>
  );
}
