import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Body, Icon } from '@/components/ui';
import { checkPop, tapSuccess, tapWarn, useAnalyzingProgress, useSpin } from '@/theme/motion';
import { analyze } from '@/lib/api';
import { useStore } from '@/lib/store';

const STEPS = [
  { label: 'Comparing your photos', th: 'เปรียบเทียบภาพก่อน–หลัง' },
  { label: 'Reading your LINE chats', th: 'อ่านหลักฐานแชท LINE' },
  { label: 'Checking Thai rental law', th: 'ตรวจสอบกฎหมายเช่าไทย' },
  { label: 'Building your case', th: 'สรุปคดีของคุณ' },
];

function Logo() {
  return (
    <View className="flex-row items-center gap-2">
      <View className="w-7 h-7 rounded-md bg-white items-center justify-center">
        <View className="w-2.5 h-2.5 rounded-sm border-2 border-navy" />
      </View>
      <Text className="font-display text-white text-base">RoomWitness</Text>
    </View>
  );
}

export default function AnalyzingScreen() {
  const form = useStore((s) => s.form);
  const setResult = useStore((s) => s.setResult);
  const [error, setError] = useState<string | null>(null);
  const spin = useSpin();
  const { step, complete } = useAnalyzingProgress(STEPS.length);

  useEffect(() => {
    if (!form) {
      router.replace('/');
      return;
    }
    let cancelled = false;
    analyze(form)
      .then((data) => {
        if (cancelled) return;
        setResult(data);
        tapSuccess();
        complete(() => {
          if (!cancelled) router.replace('/results');
        });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message || 'เกิดข้อผิดพลาด / Something went wrong');
        tapWarn();
      });
    return () => {
      cancelled = true;
    };
  }, []); // ponytail: run once on mount

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-navy px-6 items-center justify-center">
        <View className="bg-[#3A1B1B] border border-[#7A3B3B] rounded-lg p-4 w-full mb-6">
          <Text className="font-display text-[#FF9B9B] text-center">เกิดข้อผิดพลาด · Error</Text>
          <Text className="font-thai text-[#FF9B9B] text-center text-sm mt-1">{error}</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-white/10 rounded-lg px-6 py-3 flex-row items-center gap-1"
          activeOpacity={0.7}
        >
          <Icon name="ArrowLeft" size={18} color="white" />
          <Text className="font-thai text-white font-semibold">กลับ · Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-navy">
      <View className="flex-1 px-6 pt-6 pb-10">
        <Logo />

        <View className="flex-1 justify-center">
          <Text className="font-display text-[#8FA0BC] text-xs uppercase tracking-wide mb-1">
            Analyzing
          </Text>
          <Text className="font-display text-white text-2xl leading-8 mb-8">
            Building your case{'\n'}กำลังตรวจสอบคดีของคุณ
          </Text>

          <View>
            {STEPS.map((s, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <View key={i} className="flex-row items-center gap-3.5 py-3">
                  <View
                    className="w-8 h-8 rounded-full items-center justify-center border"
                    style={{
                      backgroundColor: done
                        ? 'rgba(123,224,168,0.12)'
                        : active
                        ? 'rgba(255,255,255,0.10)'
                        : 'transparent',
                      borderColor: done
                        ? 'rgba(123,224,168,0.45)'
                        : active
                        ? 'rgba(255,255,255,0.5)'
                        : 'rgba(255,255,255,0.16)',
                    }}
                  >
                    {done ? (
                      <Animated.View entering={checkPop}>
                        <Text className="text-[#7BE0A8] font-bold text-sm">✓</Text>
                      </Animated.View>
                    ) : active ? (
                      <Animated.View style={spin}>
                        <Icon name="Loader" size={16} color="white" />
                      </Animated.View>
                    ) : (
                      <Text className="font-display text-[#5B6B86] text-xs">{i + 1}</Text>
                    )}
                  </View>
                  <View style={{ opacity: active || done ? 1 : 0.4 }}>
                    <Text className="font-display text-white text-sm">{s.label}</Text>
                    <Text className="font-thai text-[#8FA0BC] text-xs mt-0.5">{s.th}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <Body className="text-[#6B7A95] text-xs text-center">
          CCC · OCPB 2568 · Consumer Protection Act
        </Body>
      </View>
    </SafeAreaView>
  );
}
