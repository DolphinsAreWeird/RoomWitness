import { z } from 'zod';

const claimSchema = z.object({
  claim_id:    z.string(),
  item:        z.string(),
  description: z.string(),
  amount_thb:  z.number(),
});

// Agent 01 — multipart body (claims is JSON-encoded string)
export const agent01BodySchema = z.object({
  claims: z.string().default('[]'),
});

// Agent 02 — multipart body
export const agent02BodySchema = z.object({
  claims:                   z.string().default('[]'),
  contract_clause:          z.string().default(''),
  lease_start:              z.string().default(''),
  lease_end:                z.string().default(''),
  deposit_amount:           z.string().default('0'),
  monthly_rent:             z.string().default('0'),
  manual_landlord_promises: z.string().default(''),
  manual_tenant_promises:   z.string().default(''),
});

// Agent 03 — JSON body
export const agent03BodySchema = z.object({
  claims:              z.array(claimSchema),
  damage_map:          z.array(z.unknown()).default([]),
  contract_clause:     z.string().default(''),
  landlord_unit_count: z.number().default(0),
  has_void_clause:     z.boolean().default(false),
});

// Agent 04 — JSON body
export const agent04BodySchema = z.object({
  documents_to_generate: z.array(z.string()),
  total_unlawful_thb:    z.number(),
  // Optional rich context from Agent 03 (used for richer document content)
  verdicts:              z.array(z.unknown()).optional().default([]),
  case_summary_th:       z.string().optional().default(''),
  case_summary_en:       z.string().optional().default(''),
  claims:                z.array(z.unknown()).optional().default([]),
  // Responsible AI: tenant must explicitly approve before documents are
  // generated. Agent 04 itself enforces this (400 if missing) — this schema
  // just has to stop zod from silently stripping the field before it forwards.
  approved_by_tenant:    z.boolean().optional().default(false),
});

// POST /generate-documents — JSON body (extra client fields like tenant/landlord
// PII are stripped; only what Agent 04 consumes is forwarded)
export const generateDocumentsBodySchema = z.object({
  documents_to_generate: z.array(z.string())
    .default(['demand_letter', 'evidence_summary', 'ocpb_complaint']),
  total_unlawful_thb:    z.number().default(0),
  verdicts:              z.array(z.unknown()).optional().default([]),
  case_summary_th:       z.string().optional().default(''),
  case_summary_en:       z.string().optional().default(''),
  claims:                z.array(z.unknown()).optional().default([]),
});

export type Agent01Body = z.infer<typeof agent01BodySchema>;
export type Agent02Body = z.infer<typeof agent02BodySchema>;
export type Agent03Body = z.infer<typeof agent03BodySchema>;
export type Agent04Body = z.infer<typeof agent04BodySchema>;
