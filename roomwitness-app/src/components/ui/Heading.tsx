// Hero / title heading: font-display + tracking-tight, with optional English secondary line.
// Encodes the §1.5 type rules so heroes stay consistent. See DESIGN_SYSTEM.md §3.3.

import { Text, View } from 'react-native';
import type { ReactNode } from 'react';

export function Heading({
  variant = 'title',
  sub,
  className = '',
  children,
}: {
  variant?: 'hero' | 'title';
  sub?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <View>
      <Text
        className={`font-display tracking-tight leading-tight text-ink ${
          variant === 'hero' ? 'text-2xl' : 'text-xl'
        } ${className}`}
      >
        {children}
      </Text>
      {sub ? <Text className="font-body text-base text-muted-2">{sub}</Text> : null}
    </View>
  );
}
