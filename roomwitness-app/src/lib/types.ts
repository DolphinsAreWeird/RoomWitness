export interface LandlordClaim {
  item: string;
  description: string;
  amount_thb: number;
}

export interface CV {
  move_in_condition: string;
  move_out_condition: string;
  wear_and_tear: boolean;
  likely_tenant_caused: boolean;
  low_visibility: boolean;
  supports_landlord_claim: 'YES' | 'NO' | 'PARTIAL';
  confidence: number;
}

export interface Dimensions {
  pre_existence: string;
  wear_and_tear: string;
  proportionality: string;
  contractual_clarity: string;
}

export interface LegalBasis {
  section: string;
  source: 'CCC' | 'OCPB';
  excerpt: string;
  favors: 'TENANT' | 'LANDLORD';
}

export type Classification = 'LAWFUL' | 'DISPUTED' | 'UNLAWFUL';

export interface Legal {
  classification: Classification;
  confidence: number;
  dimensions: Dimensions;
  legal_basis: LegalBasis[];
  summary_th: string;
}

export interface ClaimResult {
  claim: LandlordClaim;
  // Backend returns null (preferred) or `{}` when no photos were provided for this claim.
  cv: CV | null;
  legal: Legal;
}

export interface CVSummary {
  total_claims: number;
  supported_claims: number;
  disputed_claims: number;
  partial_claims: number;
  total_disputed_amount: number;
}

export interface EvidenceSummary {
  landlord_promises: string[];
  tenant_promises: string[];
  deposit_mentions: string[];
  platforms: string[];
}

export interface FullAnalysis {
  claims: ClaimResult[];
  cv_summary: CVSummary | null;
  evidence_summary: EvidenceSummary | null;
  images_used: { move_in: string | null; move_out: string | null };
}

export interface AnalyzeForm {
  claims: LandlordClaim[];
  moveIn?: { uri: string };
  moveOut?: { uri: string };
  screenshots?: { uri: string }[];
  contractClause?: string;
  landlordPromises?: string;
  tenantPromises?: string;
}

/** Error envelope returned by every portal route on failure: `{ error: string }`. */
export interface ApiError {
  error: string;
}

// ── Document generation (Agent 04) ─────────────────────────────────
// Mirrors roomwitness-rag/agent04_doc_generator/models.py.

export interface TenantInfo {
  name_th: string;
  name_en: string;
  id_number: string;
  address: string;
  phone: string;
}

export interface LandlordInfo {
  name_th: string;
  address: string;
  unit_count: number;
}

export interface LeaseInfo {
  property_address: string;
  start_date: string;
  end_date: string;
  deposit_thb: number;
  monthly_rent_thb: number;
}

export interface EvidencePhoto {
  item: string;
  movein_url: string;
  moveout_url: string;
  caption_th: string;
}

/** Request body for POST /generate-documents (Agent04Input). */
export interface GenerateDocsForm {
  case_id: string;
  routing: 'OCPB' | 'CIVIL' | 'BOTH';
  documents_to_generate: string[];
  tenant: TenantInfo;
  landlord: LandlordInfo;
  lease: LeaseInfo;
  verdicts: ClaimResult[];
  total_unlawful_thb: number;
  evidence_photos: EvidencePhoto[];
  case_summary_th: string;
  case_summary_en: string;
}

/** The PII the Details screen collects to assemble a GenerateDocsForm. */
export interface DocsDetails {
  routing: 'OCPB' | 'CIVIL' | 'BOTH';
  tenant: TenantInfo;
  landlord: LandlordInfo;
  lease: LeaseInfo;
}

export interface DocumentResult {
  s3_url: string;
  download_url: string;
  generated_at: string;
  page_count: number;
}

/** Response from POST /generate-documents (Agent04Output). */
export interface GenerateDocsResult {
  case_id: string;
  documents: Record<string, DocumentResult>;
  generation_time_seconds: number;
  total_unlawful_amount_thb: number;
}
