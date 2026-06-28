// A titled block: TH·EN label + consistent mb-6 spacing below. Standardizes the repeated
// `<Text className="text-gray-800 font-semibold mb-2">…</Text>` group headers.
// See DESIGN_SYSTEM.md §3.5.

import { Text, View } from 'react-native';
import type { ReactNode } from 'react';

export function Section({
  title,
  sub,
  required = false,
  className = '',
  children,
}: {
  title: string;
  sub?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <View className={`mb-6 ${className}`}>
      <Text className="font-thai text-ink font-semibold mb-2">
        {title}
        {sub ? (
          <Text className="font-thai font-normal text-xs text-muted">{`  ${sub}`}</Text>
        ) : null}
        {!required ? (
          <Text className="font-thai font-normal text-xs text-faint">{'  (ไม่บังคับ)'}</Text>
        ) : null}
      </Text>
      {children}
    </View>
  );
}
