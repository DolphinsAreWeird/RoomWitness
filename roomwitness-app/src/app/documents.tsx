import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Body, Card, Heading, Icon, Screen } from '@/components/ui';
import type { IconColor, IconName } from '@/components/ui';
import { cardEnter, tapLight, useShimmer } from '@/theme/motion';
import { generateDocuments } from '@/lib/api';
import { useStore } from '@/lib/store';
import type { DocsDetails, GenerateDocsForm } from '@/lib/types';

// Display metadata keyed by the document keys Agent 04 returns.
const DOC_META: Record<
  string,
  { tagBg: string; tagText: string; tagLabel: string; title: string; subtitle: string; icon: IconName; iconColor: IconColor }
> = {
  ocpb_complaint: {
    tagBg: 'bg-recover-soft', tagText: 'text-recover', tagLabel: 'OCPB',
    title: 'คำร้องเรียน สคบ.', subtitle: 'OCPB Formal Complaint Letter', icon: 'ClipboardList', iconColor: 'recover',
  },
  deposit_demand: {
    tagBg: 'bg-negotiate-soft', tagText: 'text-negotiate', tagLabel: 'DEMAND',
    title: 'หนังสือทวงเงินประกัน', subtitle: 'Deposit Demand Letter to Landlord', icon: 'FileText', iconColor: 'negotiate',
  },
  evidence_summary: {
    tagBg: 'bg-valid-soft', tagText: 'text-valid', tagLabel: 'EVIDENCE',
    title: 'สรุปหลักฐานประกอบคำร้อง', subtitle: 'Evidence Summary Document', icon: 'FolderOpen', iconColor: 'valid',
  },
};

const FALLBACK_KEYS = ['ocpb_complaint', 'deposit_demand', 'evidence_summary'] as const;

// Assemble the Agent04Input from the analysis verdicts + PII collected on the Details screen.
// If details are missing (e.g. direct navigation), empty placeholders are sent — fine in mock mode.
// See API_CONTRACT.md "Larger follow-up".
function buildDocsForm(verdicts: GenerateDocsForm['verdicts'], details: DocsDetails | null): GenerateDocsForm {
  const totalUnlawful = verdicts
    .filter((c) => c.legal.classification === 'UNLAWFUL')
    .reduce((sum, c) => sum + c.claim.amount_thb, 0);
  return {
    case_id: `RW-${Date.now()}`,
    routing: details?.routing ?? 'OCPB',
    documents_to_generate: [...FALLBACK_KEYS],
    tenant: details?.tenant ?? { name_th: '', name_en: '', id_number: '', address: '', phone: '' },
    landlord: details?.landlord ?? { name_th: '', address: '', unit_count: 0 },
    lease: details?.lease ?? { property_address: '', start_date: '', end_date: '', deposit_thb: 0, monthly_rent_thb: 0 },
    verdicts,
    total_unlawful_thb: totalUnlawful,
    evidence_photos: [],
    case_summary_th: '',
    case_summary_en: '',
  };
}

function SkeletonCard() {
  const shimmer = useShimmer(); // each card owns its own animated style
  return (
    <Animated.View style={shimmer}>
      <Card className="mb-3">
        <View className="h-4 w-16 bg-gray-200 rounded-sm mb-3" />
        <View className="h-8 w-8 bg-gray-200 rounded-md mb-2" />
        <View className="h-5 w-40 bg-gray-200 rounded-sm mb-2" />
        <View className="h-4 w-32 bg-gray-200 rounded-sm mb-3" />
        <View className="h-9 bg-gray-200 rounded-lg" />
      </Card>
    </Animated.View>
  );
}

export default function DocumentsScreen() {
  const result = useStore((s) => s.result);
  const docsDetails = useStore((s) => s.docsDetails);
  const docsResult = useStore((s) => s.docsResult);
  const setDocsResult = useStore((s) => s.setDocsResult);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!result || docsResult) return;
    setLoading(true);
    generateDocuments(buildDocsForm(result.claims, docsDetails))
      .then((data) => setDocsResult(data))
      .catch((e: Error) => setError(e.message || 'สร้างเอกสารไม่สำเร็จ / Could not generate documents'))
      .finally(() => setLoading(false));
  }, []); // run once on mount

  const docEntries = docsResult ? Object.entries(docsResult.documents) : [];

  return (
    <Screen step={5} label="เอกสาร · Documents">
      <View className="py-4">
        <Heading variant="hero" sub="Your legal documents">
          เอกสารของคุณ
        </Heading>
      </View>

      {loading && [0, 1, 2].map((i) => <SkeletonCard key={i} />)}

      {error && (
        <View className="bg-[#FDECEC] border border-[#F2C4C4] rounded-lg p-4 mb-3">
          <Body size="sm" className="text-[#B42318]">
            {error}
          </Body>
        </View>
      )}

      {/* Generated documents — stagger in */}
      {docEntries.map(([key, doc], i) => {
        const meta = DOC_META[key] ?? {
          tagBg: 'bg-gray-100', tagText: 'text-gray-600', tagLabel: 'DOC',
          title: key, subtitle: '', icon: 'FileText' as IconName, iconColor: 'gray-500' as IconColor,
        };
        return (
          <Animated.View key={key} entering={cardEnter(i)}>
            <Card className="mb-3">
              <View className="flex-row items-start justify-between mb-3">
                <View className={`px-2 py-0.5 rounded-sm ${meta.tagBg}`}>
                  <Body weight="bold" className={`${meta.tagText} text-xs`}>
                    {meta.tagLabel}
                  </Body>
                </View>
                <Body tone="muted" size="sm" className="text-xs">
                  {doc.page_count} หน้า / pages
                </Body>
              </View>
              <View className="mb-2">
                <Icon name={meta.icon} size={28} color={meta.iconColor} />
              </View>
              <Body weight="bold">{meta.title}</Body>
              <Body tone="caption" size="sm" className="mb-3">
                {meta.subtitle}
              </Body>
              <TouchableOpacity
                onPress={() => {
                  tapLight();
                  WebBrowser.openBrowserAsync(doc.download_url);
                }}
                className="bg-recover-soft border border-recover-border rounded-lg py-2 flex-row items-center justify-center gap-1"
                activeOpacity={0.8}
              >
                <Icon name="Download" size={18} color="recover" />
                <Body weight="semibold" size="sm" className="text-recover">
                  ดาวน์โหลด · Get
                </Body>
              </TouchableOpacity>
            </Card>
          </Animated.View>
        );
      })}

      {/* Fallback placeholders when nothing generated yet, not loading, and no error */}
      {!loading && !error && docEntries.length === 0 &&
        FALLBACK_KEYS.map((key) => {
          const doc = DOC_META[key];
          return (
            <Card key={key} className="mb-3">
              <View className="flex-row items-start justify-between mb-3">
                <View className={`px-2 py-0.5 rounded-sm ${doc.tagBg}`}>
                  <Body weight="bold" className={`${doc.tagText} text-xs`}>
                    {doc.tagLabel}
                  </Body>
                </View>
                <View className="bg-gray-100 px-2 py-0.5 rounded-sm">
                  <Body tone="caption" size="sm" className="text-xs">
                    เร็วๆ นี้ / coming soon
                  </Body>
                </View>
              </View>
              <View className="mb-2">
                <Icon name={doc.icon} size={28} color={doc.iconColor} />
              </View>
              <Body weight="bold">{doc.title}</Body>
              <Body tone="caption" size="sm">
                {doc.subtitle}
              </Body>
            </Card>
          );
        })}

      <View className="bg-card border border-dashed border-cream-edge rounded-lg p-4 mb-6">
        <Body weight="semibold" size="sm" className="text-ink mb-1">
          ขั้นตอนต่อไป · Next steps
        </Body>
        <Body size="sm" className="text-muted-2 leading-5">
          ส่งเอกสารยื่นให้ สคบ. ที่ ocpb.go.th หรือโทร 1166{'\n'}
          File documents with OCPB at ocpb.go.th or call 1166
        </Body>
      </View>

      <TouchableOpacity
        onPress={() => {
          tapLight();
          router.replace('/');
        }}
        className="pb-8 flex-row items-center justify-center gap-1"
        activeOpacity={0.7}
      >
        <Icon name="ArrowLeft" size={16} color="faint" />
        <Body tone="muted" size="sm">
          เริ่มใหม่ · Start over
        </Body>
      </TouchableOpacity>
    </Screen>
  );
}
