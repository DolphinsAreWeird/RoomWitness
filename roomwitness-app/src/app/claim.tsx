import { router, useLocalSearchParams } from 'expo-router';
import { Image, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Body, Card, Icon, Screen } from '@/components/ui';
import { DIMS, toneFor } from '@/lib/verdict';
import { useStore } from '@/lib/store';

export default function ClaimDetailScreen() {
  const { i } = useLocalSearchParams<{ i?: string }>();
  const result = useStore((s) => s.result);
  const form = useStore((s) => s.form);
  const index = Number(i ?? 0);
  const item = result?.claims[index];

  if (!item) {
    return (
      <SafeAreaView className="flex-1 bg-cream items-center justify-center px-6">
        <Body tone="caption">ไม่พบรายการ · Claim not found</Body>
        <TouchableOpacity onPress={() => router.back()} className="mt-4" activeOpacity={0.7}>
          <Body className="text-ink" weight="semibold">
            กลับ · Back
          </Body>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const { claim, cv, legal } = item;
  const t = toneFor(legal.classification);

  return (
    <Screen>
      {/* Back to verdict */}
      <TouchableOpacity
        onPress={() => router.back()}
        className="flex-row items-center gap-1 pt-2 mb-4"
        activeOpacity={0.7}
      >
        <Icon name="ArrowLeft" size={16} color="muted" />
        <Body tone="caption" size="sm">
          คำตัดสิน · Verdict
        </Body>
      </TouchableOpacity>

      {/* Verdict chip + confidence */}
      <View className="flex-row items-center gap-2 mb-1">
        <View className={`${t.softBgClass} px-2 py-1 rounded-sm`}>
          <Body size="sm" weight="bold" className={`${t.textClass} text-xs`}>
            {t.chip} · {t.chipTh}
          </Body>
        </View>
        <Body className="font-mono text-faint text-xs">
          {Math.round(legal.confidence * 100)}% confidence
        </Body>
      </View>

      {/* Title + amount */}
      <View className="flex-row items-baseline gap-2 mb-4">
        <Body weight="bold" className="font-display text-2xl text-ink flex-1">
          {claim.item}
        </Body>
        <Body weight="bold" className="font-display text-lg text-ink">
          ฿{claim.amount_thb.toLocaleString()}
        </Body>
      </View>

      {/* Move-in / move-out photos (if the user picked any) + condition captions */}
      {(form?.moveIn || form?.moveOut) && (
        <View className="flex-row gap-2 mb-2">
          <View className="flex-1">
            {form?.moveIn && (
              <Image source={{ uri: form.moveIn.uri }} className="w-full h-24 rounded-md" resizeMode="cover" />
            )}
          </View>
          <View className="flex-1">
            {form?.moveOut && (
              <Image source={{ uri: form.moveOut.uri }} className="w-full h-24 rounded-md" resizeMode="cover" />
            )}
          </View>
        </View>
      )}
      {cv && (
        <View className="flex-row gap-2 mb-5">
          <Card padded={false} className="flex-1 p-3">
            <Body tone="caption" size="sm" className="text-xs leading-5">
              ก่อนเข้าอยู่: {cv.move_in_condition}
            </Body>
          </Card>
          <Card padded={false} className="flex-1 p-3">
            <Body tone="caption" size="sm" className="text-xs leading-5">
              หลังย้ายออก: {cv.move_out_condition}
            </Body>
          </Card>
        </View>
      )}

      {/* Headline + Thai summary, tinted by verdict tone */}
      <View
        className={`${t.softBgClass} ${t.borderClass} border rounded-lg p-4 mb-5`}
      >
        <Body weight="semibold" className={`${t.textClass} mb-1`}>
          {t.headline}
        </Body>
        <Body size="sm" className="text-ink leading-6">
          {legal.summary_th}
        </Body>
      </View>

      {/* How we judged it — 4 dimensions */}
      <Body tone="label" weight="semibold" className="uppercase text-xs tracking-wide mb-2">
        เหตุผล · How we judged it
      </Body>
      <Card padded={false} className="mb-5 overflow-hidden">
        {DIMS.map(({ key, label }, idx) => (
          <View
            key={key}
            className={`p-3 ${idx < DIMS.length - 1 ? 'border-b border-divider' : ''}`}
          >
            <Body weight="semibold" size="sm" className="text-ink text-xs mb-1">
              {label}
            </Body>
            <Body tone="caption" size="sm" className="leading-5">
              {legal.dimensions[key]}
            </Body>
          </View>
        ))}
      </Card>

      {/* Legal basis */}
      <Body tone="label" weight="semibold" className="uppercase text-xs tracking-wide mb-2">
        ฐานทางกฎหมาย · Legal basis
      </Body>
      <View className="pb-8 gap-2">
        {legal.legal_basis.map((b, idx) => {
          const tenant = b.favors === 'TENANT';
          return (
            <Card key={idx} className="p-3">
              <View className="flex-row items-center gap-2 mb-1.5">
                <Body className="font-mono text-ink text-xs" weight="semibold">
                  {b.section} · {b.source}
                </Body>
                <View
                  className={`${tenant ? 'bg-recover-soft' : 'bg-negotiate-soft'} ml-auto rounded-sm px-2 py-0.5`}
                >
                  <Body
                    size="sm"
                    weight="bold"
                    className={`${tenant ? 'text-recover' : 'text-negotiate'} text-xs`}
                  >
                    {tenant ? 'เข้าข้างคุณ · Favors you' : 'เข้าข้างเจ้าของ · Favors landlord'}
                  </Body>
                </View>
              </View>
              <Body tone="caption" size="sm" className="leading-6">
                {b.excerpt}
              </Body>
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}
