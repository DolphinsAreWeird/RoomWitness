// Page chrome: SafeArea + NavHeader + keyboard avoidance + optional scroll. Replaces the
// SafeAreaView/KeyboardAvoidingView/ScrollView boilerplate in all 5 screens.
// See DESIGN_SYSTEM.md §3.1.

import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';
import { NavHeader } from '@/components/NavHeader';

export function Screen({
  step,
  label,
  scroll = true,
  bg = 'cream',
  children,
}: {
  step?: 1 | 2 | 3 | 4 | 5;
  label?: string;
  scroll?: boolean;
  bg?: 'white' | 'cream' | 'navy';
  children: ReactNode;
}) {
  const bgClass = bg === 'white' ? 'bg-card' : bg === 'navy' ? 'bg-navy' : 'bg-cream';
  return (
    <SafeAreaView className={`flex-1 ${bgClass}`}>
      {step != null && label != null ? <NavHeader step={step} label={label} /> : null}
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {scroll ? (
          <ScrollView className="flex-1 px-4" keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        ) : (
          <View className="flex-1 px-4">{children}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
