import { View } from 'react-native';
import { Body } from '@/components/ui';
import { toneFor } from '@/lib/verdict';
import type { Classification } from '@/lib/types';

export function ClassificationBadge({ classification }: { classification: Classification }) {
  const t = toneFor(classification);
  return (
    <View className={`${t.softBgClass} px-2 py-1 rounded-sm`}>
      <Body size="sm" weight="bold" className={`${t.textClass} text-xs`}>
        {t.chip} · {t.chipTh}
      </Body>
    </View>
  );
}
