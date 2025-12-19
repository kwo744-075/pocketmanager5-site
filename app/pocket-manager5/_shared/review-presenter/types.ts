// Types for the Review Presenter workflow

export type CadenceType = 'daily' | 'weekly' | 'monthly' | 'period';
export type ScopeType = 'DM' | 'RD';
export type ComparatorType = '>=' | '<=' | '=';

export interface ParsedRow {
  [column: string]: string | number | null;
}

export interface ColumnMapping {
  shopNumber?: string;
  shopName?: string;
  [kpiColumn: string]: string | undefined;
}

export interface KPIDefinition {
  name: string;
  goal: number;
  comparator: ComparatorType;
  displayOrder?: number;
}

export interface ReviewPreset {
  id?: string;
  created_by?: string;
  scope: ScopeType;
  cadence: CadenceType;
  preset_name: string;
  selected_kpis: KPIDefinition[];
  created_at?: string;
}

export interface UploadMapping {
  id?: string;
  created_by?: string;
  mapping_name: string;
  mapping_json: ColumnMapping;
  created_at?: string;
}

export interface ShopKPIData {
  shop: string;
  shopNumber?: number;
  shopName?: string;
  score?: number; // Added for ranking purposes
  kpis: {
    name: string;
    value: number | null;
    goal: number;
    comparator: ComparatorType;
    status: 'green' | 'red' | 'neutral';
  }[];
}

export interface HeatGridProps {
  data: ShopKPIData[];
  title?: string;
}

export interface RankingsData {
  districtRankings: { district: string; shops: ShopKPIData[] }[];
  overallRankings: ShopKPIData[];
}

export interface WorkflowState {
  step: number;
  file: File | null;
  parsedData: ParsedRow[];
  mapping: ColumnMapping;
  selectedKPIs: KPIDefinition[];
  preset: ReviewPreset | null;
  results: ShopKPIData[];
  rankings: RankingsData | null;
}

export interface StepComponentProps {
  state: WorkflowState;
  onStateChange: (updates: Partial<WorkflowState>) => void;
  onNext: () => void;
  onPrev: () => void;
}