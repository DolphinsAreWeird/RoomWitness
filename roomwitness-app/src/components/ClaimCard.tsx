import { router, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { ClassificationBadge } from './ClassificationBadge';
import { Body, Icon } from '@/components/ui';
import { tapLight, usePressScale } from '@/theme/motion';
import { firstSentence, toneFor } from '@/lib/verdict';
import type { ClaimResult } from '@/lib/types';

// A claim card is now a navigation button into the per-claim detail screen — the 4 dimensions
// and legal basis live there, not inline. Left border + action color come from the verdict tone.
export function ClaimCard({ item, index }: { item: ClaimResult; index: number }) {
  const { claim, legal } = item;
  const t = toneFor(legal.classification);
  const press = usePressScale();

  function open() {
    tapLight();
    // ponytail: typed-routes union regenerates on `expo start`; cast bridges the new /claim route.
    router.push({ pathname: '/claim', params: { i: String(index) } } as unknown as Href);
  }

  return (
    <Animated.View style={press.style}>
      <Pressable
        onPress={open}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        className="bg-card rounded-lg border border-card-border mb-3 p-4"
        style={{ borderLeftWidth: 4, borderLeftColor: t.color }}
      >
        {/* Verdict chip · confidence · amount */}
        <View className="flex-row items-center gap-2 mb-2 flex-wrap">
          <ClassificationBadge classification={legal.classification} />
          <Body className="font-mono text-faint text-xs">
            {Math.round(legal.confidence * 100)}% conf.
          </Body>
          <Body weight="bold" className="ml-auto text-ink">
            ฿{claim.amount_thb.toLocaleString()}
          </Body>
        </View>

        {/* Item + one-line teaser */}
        <Body weight="semibold" className="text-ink">
          {claim.item}
        </Body>
        <Body tone="caption" size="sm" className="mt-1 leading-5">
          {firstSentence(legal.summary_th)}
        </Body>

        {/* Action row */}
        <View className="flex-row items-center gap-1 mt-3">
          <Body weight="semibold" size="sm" className={t.textClass}>
            {t.action}
          </Body>
          <Icon name="ArrowRight" size={15} color={t.tone} />
        </View>
      </Pressable>
    </Animated.View>
  );
}
