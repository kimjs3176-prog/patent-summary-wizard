export interface UsageStats {
  totalSummaries: number;
  totalScores: number;
  totalSearches: number;
  totalDataCache: number;
  recentSummaries: { date: string; count: number }[];
  recentSearches: { date: string; count: number }[];
  topSearched: { patent_number: string; patent_title: string | null; search_count: number }[];
  currentModel: string;
}

export interface VisitorStats {
  total: number;
  today: number;
  thisMonth: number;
  thisQuarter: number;
  thisYear: number;
  last30: { date: string; count: number }[];
  daily: { date: string; count: number }[];
  monthly: { month: string; count: number }[];
  quarterly: { quarter: string; count: number }[];
  yearly: { year: string; count: number }[];
}

export interface SatisfactionRow {
  bucket: string;
  period: string;
  responses: number;
  avg_rating: number | null;
  r1: number;
  r2: number;
  r3: number;
  r4: number;
  r5: number;
}

export interface SatisfactionComment {
  rating: number;
  comment: string;
  patent_number: string | null;
  created_at: string;
}
