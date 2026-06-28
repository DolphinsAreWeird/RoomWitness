import { router } from 'expo-router';
import { useEffect } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { ClaimCard } from '@/components/ClaimCard';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Body, Card, Icon, Screen } from '@/components/ui';
import { cardEnter, tapSuccess, useCountUp } from '@/theme/motion';
import { toneFor } from '@/lib/verdict';
import { useStore } from '@/lib/store';
import type { Classification } from '@/lib/types';

export default function ResultsScreen() {
  const result = useStore((s) => s.result);
  const deposit = useStore((s) => s.deposit);

  // Bucket the deducted ฿ by verdict tone (color = good-for-tenant, see lib/verdict.ts).
  const sumBy = (cls: Classification) =>
    result?.claims
      .filter((c) => c.legal.classification === cls)
      .reduce((s, c) => s + c.claim.amount_thb, 0) ?? 0;
  const recoverSum = sumBy('UNLAWFUL');
  const negotiateSum = sumBy('DISPUTED');
  const validSum = sumBy('LAWFUL');
  const totalCharged = recoverSum + negotiateSum + validSum;
  // Client-side recoverable estimate — UNLAWFUL + DISPUTED only (CLAUDE.md note).
  const recoverableTotal = recoverSum + negotiateSum;

  const recovered = useCountUp(recoverableTotal);
  useEffect(() => {
    if (recoverableTotal > 0) tapSuccess();
  }, [recoverableTotal]);

  if (!result) {
    return (
      <SafeAreaView className="flex-1 bg-cream items-center justify-center px-6">
        <Body tone="caption" className="text-center">
          ไม่พบผลลัพธ์ · No results
        </Body>
        <TouchableOpacity
          onPress={() => router.replace('/')}
          className="mt-4 flex-row items-center gap-1"
          activeOpacity={0.7}
        >
          <Icon name="ArrowLeft" size={16} color="ink" />
          <Body className="text-ink" weight="semibold">
            กลับหน้าแรก
          </Body>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const seg = (amount: number, color: string) =>
    amount > 0 ? <View style={{ flex: amount, backgroundColor: color }} /> : null;

  const legendItem = (label: string, amount: number, color: string) =>
    amount > 0 ? (
      <View className="flex-row items-center gap-1.5">
        <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color }} />
        <Body tone="caption" className="text-xs">
          {label} ฿{amount.toLocaleString()}
        </Body>
      </View>
    ) : null;

  return (
    <Screen>
      {/* Header: back + case id */}
      <View className="flex-row items-center pt-2 mb-5">
        <TouchableOpacity
          onPress={() => router.back()}
          className="flex-row items-center gap-1"
          activeOpacity={0.7}
        >
          <Icon name="ArrowLeft" size={16} color="muted" />
          <Body tone="caption" size="sm">
            กลับ · Back
          </Body>
        </TouchableOpacity>
        <Body tone="caption" size="sm" className="ml-auto text-xs">
          Case RW-0001
        </Body>
      </View>

      {/* Hero: recoverable count-up + segmented bar */}
      <Card className="rounded-xl mb-5">
        <Body tone="caption" size="sm" className="mb-1">
          เรียกคืนได้ · You could recover
        </Body>
        <Body className="font-display text-5xl tracking-tight text-recover leading-none">
          ฿{recovered.toLocaleString()}
        </Body>
        <Body tone="caption" size="sm" className="mt-2">
          จาก ฿{totalCharged.toLocaleString()} ที่ถูกหัก · of ฿{totalCharged.toLocaleString()}{' '}
          deducted from your ฿{deposit.toLocaleString()} deposit
        </Body>

        {/* Segmented bar: recover / negotiate / valid proportional to ฿ */}
        <View className="flex-row h-3 rounded-md overflow-hidden mt-4 gap-0.5">
          {seg(recoverSum, '#1C7A4B')}
          {seg(negotiateSum, '#C99A2E')}
          {seg(validSum, '#9AA0AC')}
        </View>
        <View className="flex-row flex-wrap gap-x-4 gap-y-1 mt-3">
          {legendItem('Recover', recoverSum, '#1C7A4B')}
          {legendItem('Negotiate', negotiateSum, '#C99A2E')}
          {legendItem('Valid', validSum, '#9AA0AC')}
        </View>

        <Body tone="muted" size="sm" className="text-xs mt-3">
          * ประมาณการจากรายการ UNLAWFUL + DISPUTED ไม่ใช่ตัวเลขจากระบบ · estimate
        </Body>
      </Card>

      {/* Evidence pills */}
      {result.evidence_summary && (
        <View className="mb-5">
          <Body tone="label" weight="semibold" className="mb-2">
            หลักฐานที่พบ · Evidence found
          </Body>
          <View className="flex-row flex-wrap gap-2">
            {result.evidence_summary.platforms.map((p, i) => (
              <View key={i} className="bg-recover-soft rounded-sm px-2 py-1">
                <Body className="text-recover text-xs" weight="semibold">
                  {p}
                </Body>
              </View>
            ))}
            {result.evidence_summary.landlord_promises.map((p, i) => (
              <View key={`lp${i}`} className="bg-valid-soft rounded-sm px-2 py-1 max-w-[220px]">
                <Body tone="label" className="text-xs" numberOfLines={1}>
                  {p}
                </Body>
              </View>
            ))}
            {result.evidence_summary.deposit_mentions.map((d, i) => (
              <View key={`dm${i}`} className="bg-negotiate-soft rounded-sm px-2 py-1 max-w-[220px]">
                <Body className="text-negotiate text-xs" numberOfLines={1}>
                  {d}
                </Body>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Per-claim verdict cards → tap into detail */}
      <Body tone="label" weight="semibold" className="mb-3 uppercase text-xs tracking-wide">
        คำตัดสินรายรายการ · The verdict on each charge
      </Body>
      {result.claims.map((item, i) => (
        <Animated.View key={i} entering={cardEnter(i)}>
          <ClaimCard item={item} index={i} />
        </Animated.View>
      ))}

      <View className="pb-8 mt-2">
        <PrimaryButton
          title="สร้างเอกสารกฎหมาย · Generate documents"
          onPress={() => router.push('/details')}
        />
      </View>
    </Screen>
  );
}
