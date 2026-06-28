import { create } from 'zustand';
import type { AnalyzeForm, DocsDetails, FullAnalysis, GenerateDocsResult } from './types';

interface Store {
  form: AnalyzeForm | null;
  result: FullAnalysis | null;
  // Client-only illustrative deposit shown on Upload + Results ("of ฿X deposit").
  // Never sent to the backend (see CLAUDE.md). // ponytail: default 20000, edit on Upload.
  deposit: number;
  docsDetails: DocsDetails | null;
  docsResult: GenerateDocsResult | null;
  setForm: (form: AnalyzeForm) => void;
  setResult: (result: FullAnalysis) => void;
  setDeposit: (deposit: number) => void;
  setDocsDetails: (docsDetails: DocsDetails) => void;
  setDocsResult: (docsResult: GenerateDocsResult) => void;
}

export const useStore = create<Store>((set) => ({
  form: null,
  result: null,
  deposit: 20000,
  docsDetails: null,
  docsResult: null,
  setForm: (form) => set({ form }),
  setDeposit: (deposit) => set({ deposit }),
  setResult: (result) => set({ result }),
  setDocsDetails: (docsDetails) => set({ docsDetails }),
  setDocsResult: (docsResult) => set({ docsResult }),
}));
