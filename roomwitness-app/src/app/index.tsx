import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, TextInput, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { ImagePickerTile } from '@/components/ImagePickerTile';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Body, Heading, Icon, Screen, Section } from '@/components/ui';
import { cardEnter, fadeOut, layout, tapLight, useChevronRotate } from '@/theme/motion';
import { useStore } from '@/lib/store';
import type { LandlordClaim } from '@/lib/types';

let nextId = 1;
type ClaimRow = LandlordClaim & { id: number };

function emptyRow(): ClaimRow {
  return { id: nextId++, item: '', description: '', amount_thb: 0 };
}

const INPUT = 'bg-card border border-card-border rounded-md px-3 py-2 text-ink text-sm font-thai';
const MULTILINE = 'bg-card border border-card-border rounded-lg px-3 py-2 text-ink text-sm font-thai';

export default function UploadScreen() {
  const setForm = useStore((s) => s.setForm);
  const deposit = useStore((s) => s.deposit);
  const setDeposit = useStore((s) => s.setDeposit);
  const [claims, setClaims] = useState<ClaimRow[]>([emptyRow()]);
  const [moveInUri, setMoveInUri] = useState<string>();
  const [moveOutUri, setMoveOutUri] = useState<string>();
  const [screenshotUris, setScreenshotUris] = useState<string[]>([]);
  const [contractClause, setContractClause] = useState('');
  const [landlordPromises, setLandlordPromises] = useState('');
  const [tenantPromises, setTenantPromises] = useState('');
  const [showOptional, setShowOptional] = useState(false);
  const optChevron = useChevronRotate(showOptional);

  function updateClaim(id: number, patch: Partial<LandlordClaim>) {
    setClaims((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function removeClaim(id: number) {
    tapLight();
    setClaims((prev) => prev.filter((c) => c.id !== id));
  }

  function addClaim() {
    tapLight();
    setClaims((prev) => [...prev, emptyRow()]);
  }

  function toggleOptional() {
    tapLight();
    setShowOptional((v) => !v);
  }

  function handleSubmit() {
    const valid = claims.filter((c) => c.item.trim());
    if (valid.length === 0) {
      Alert.alert('ต้องระบุรายการ', 'กรุณาเพิ่มรายการที่ถูกหักเงินอย่างน้อย 1 รายการ');
      return;
    }
    setForm({
      claims: valid.map(({ item, description, amount_thb }) => ({ item, description, amount_thb })),
      moveIn: moveInUri ? { uri: moveInUri } : undefined,
      moveOut: moveOutUri ? { uri: moveOutUri } : undefined,
      screenshots: screenshotUris.map((uri) => ({ uri })),
      contractClause: contractClause || undefined,
      landlordPromises: landlordPromises || undefined,
      tenantPromises: tenantPromises || undefined,
    });
    router.push('/analyzing');
  }

  const hasValidClaim = claims.some((c) => c.item.trim().length > 0);

  return (
    <Screen step={1} label="อัปโหลด · Upload">
      {/* Hero */}
      <View className="py-4">
        <Heading variant="hero" sub="Get your deposit back.">
          ทวงเงินประกันคืน
        </Heading>
      </View>

      {/* Deposit — illustrative client-side figure (never sent to backend) */}
      <View className="bg-card border border-card-border rounded-lg p-4 mb-4 flex-row items-center justify-between">
        <Body tone="label" size="sm" weight="semibold" className="text-xs">
          เงินประกัน · Your deposit
        </Body>
        <View className="flex-row items-baseline">
          <Body weight="bold" className="font-display text-xl text-ink">฿</Body>
          <TextInput
            value={deposit > 0 ? String(deposit) : ''}
            onChangeText={(t) => setDeposit(Number(t.replace(/[^0-9]/g, '')) || 0)}
            keyboardType="numeric"
            className="font-display text-xl text-ink min-w-[90px] text-right p-0"
            placeholder="20000"
            placeholderTextColor="#9AA0AC"
          />
        </View>
      </View>

      {/* Claims */}
      <Section
        title="รายการ · Required"
        sub="เจ้าของบ้านหักอะไรบ้าง / What is the landlord deducting for?"
        required
      >
        {claims.map((claim, idx) => (
          <Animated.View
            key={claim.id}
            layout={layout}
            entering={cardEnter(0)}
            exiting={fadeOut}
            className="bg-card border border-card-border rounded-lg p-3 mb-3"
          >
            <View className="flex-row items-center justify-between mb-2">
              <Body tone="caption" size="sm" weight="semibold" className="text-xs">
                รายการที่ {idx + 1}
              </Body>
              {claims.length > 1 && (
                <TouchableOpacity onPress={() => removeClaim(claim.id)} hitSlop={8}>
                  <Icon name="X" size={18} color="faint" />
                </TouchableOpacity>
              )}
            </View>
            <TextInput
              placeholder="รายการ · Item (เช่น สีผนัง)"
              value={claim.item}
              onChangeText={(t) => updateClaim(claim.id, { item: t })}
              className={`${INPUT} mb-2`}
              placeholderTextColor="#9CA3AF"
            />
            <TextInput
              placeholder="เหตุผลเจ้าของบ้าน · Their reason"
              value={claim.description}
              onChangeText={(t) => updateClaim(claim.id, { description: t })}
              className={`${INPUT} mb-2`}
              placeholderTextColor="#9CA3AF"
            />
            <TextInput
              placeholder="จำนวนเงิน · Amount (฿)"
              value={claim.amount_thb > 0 ? String(claim.amount_thb) : ''}
              onChangeText={(t) => updateClaim(claim.id, { amount_thb: Number(t) || 0 })}
              keyboardType="numeric"
              className={INPUT}
              placeholderTextColor="#9CA3AF"
            />
          </Animated.View>
        ))}

        <TouchableOpacity
          onPress={addClaim}
          className="border border-dashed border-navy rounded-lg py-3 flex-row items-center justify-center gap-1"
          activeOpacity={0.7}
        >
          <Icon name="Plus" size={18} color="navy" />
          <Body weight="semibold" size="sm" className="text-navy">
            เพิ่มรายการ · Add item
          </Body>
        </TouchableOpacity>
      </Section>

      {/* Evidence */}
      <Section title="หลักฐาน · Supporting evidence">
        <View className="flex-row gap-3 mb-3">
          <View className="flex-1">
            <Body tone="label" size="sm" className="text-xs mb-1">
              รูปก่อนเข้าอยู่ · Move-in
            </Body>
            <ImagePickerTile
              label="รูปถ่ายก่อนเข้า"
              sublabel="Move-in photos"
              onPick={setMoveInUri}
              uri={moveInUri}
            />
          </View>
          <View className="flex-1">
            <Body tone="label" size="sm" className="text-xs mb-1">
              รูปก่อนออก · Move-out
            </Body>
            <ImagePickerTile
              label="รูปถ่ายก่อนออก"
              sublabel="Move-out photos"
              onPick={setMoveOutUri}
              uri={moveOutUri}
            />
          </View>
        </View>

        <View>
          <Body tone="label" size="sm" className="text-xs mb-1">
            แชทกับเจ้าของบ้าน · Screenshots (LINE/WhatsApp)
          </Body>
          <ImagePickerTile
            label="แชทสกรีนช็อต"
            sublabel="Chat screenshots — optional"
            onPick={(uri) => setScreenshotUris((prev) => [...prev, uri])}
            multiple
          />
          {screenshotUris.length > 0 && (
            <Body tone="caption" size="sm" className="text-xs mt-1">
              {screenshotUris.length} ไฟล์ · files selected
            </Body>
          )}
        </View>
      </Section>

      {/* Optional text inputs */}
      <TouchableOpacity
        onPress={toggleOptional}
        className="flex-row items-center gap-1 mb-3"
        activeOpacity={0.7}
      >
        <Animated.View style={optChevron}>
          <Icon name="ChevronDown" size={18} color="navy" />
        </Animated.View>
        <Body weight="semibold" size="sm" className="text-navy">
          ข้อความเพิ่มเติม · More details (optional)
        </Body>
      </TouchableOpacity>

      {showOptional && (
        <Animated.View entering={cardEnter(0)} exiting={fadeOut} className="gap-3 mb-4">
          <View>
            <Body tone="label" size="sm" className="text-xs mb-1">
              ข้อความในสัญญา · Contract clause
            </Body>
            <TextInput
              placeholder="วางข้อความจากสัญญาเช่า..."
              value={contractClause}
              onChangeText={setContractClause}
              multiline
              numberOfLines={3}
              className={MULTILINE}
              placeholderTextColor="#9CA3AF"
              textAlignVertical="top"
            />
          </View>
          <View>
            <Body tone="label" size="sm" className="text-xs mb-1">
              คำสัญญาจากเจ้าของบ้าน · Landlord promises
            </Body>
            <TextInput
              placeholder="สัญญาที่เจ้าของบ้านเคยพูด..."
              value={landlordPromises}
              onChangeText={setLandlordPromises}
              multiline
              numberOfLines={3}
              className={MULTILINE}
              placeholderTextColor="#9CA3AF"
              textAlignVertical="top"
            />
          </View>
          <View>
            <Body tone="label" size="sm" className="text-xs mb-1">
              คำสัญญาจากผู้เช่า · Tenant promises
            </Body>
            <TextInput
              placeholder="สัญญาที่คุณเคยพูด..."
              value={tenantPromises}
              onChangeText={setTenantPromises}
              multiline
              numberOfLines={3}
              className={MULTILINE}
              placeholderTextColor="#9CA3AF"
              textAlignVertical="top"
            />
          </View>
        </Animated.View>
      )}

      <View className="pb-8">
        <PrimaryButton title="วิเคราะห์ / Analyze" onPress={handleSubmit} disabled={!hasValidClaim} />
        {!hasValidClaim && (
          <Body tone="muted" size="sm" className="text-xs text-center mt-2">
            กรุณาเพิ่มอย่างน้อย 1 รายการ · Add at least 1 claim
          </Body>
        )}
      </View>
    </Screen>
  );
}
