export interface PatentData {
  title?: string;
  titleKo?: string;
  abstract?: string;
  inventors?: string[];
  assignee?: string;
  filingDate?: string;
  publicationDate?: string;
  claims?: string[];
  patentNumber?: string;
  applicationNumber?: string;
  registrationNumber?: string;
  displayNumber?: string;
  searchType?: 'registration' | 'application';
  classifications?: string[];
  description?: string;
  representativeImage?: string;
  images?: string[];
  citationCount?: number;
  citedByCount?: number;
}

export interface RelatedPatent {
  patentId: string;
  title: string;
  assignee?: string;
  publicationDate?: string;
  snippet?: string;
  link?: string;
}

export interface FeatureFlags {
  pdfEnabled: boolean;
  pptEnabled: boolean;
}

export interface PatentSummaryProps {
  content: string;
  patentNumber: string;
  isStreaming: boolean;
  patentData?: PatentData | null;
  relatedPatents?: RelatedPatent[];
  onRelatedPatentClick?: (patentNumber: string) => void;
  featureFlags?: FeatureFlags;
}

export interface PatentIndices {
  innovationIndex: number;
  marketDominanceIndex: number;
  innovationFactors: {
    claimsCount: number;
    classificationsCount: number;
    descriptionLength: number;
    hasCitations: boolean;
  };
  marketFactors: {
    assigneeType: 'corporate' | 'individual' | 'research' | 'unknown';
    inventorsCount: number;
    ipcBreadth: number;
    citedByCount: number;
  };
}

export interface KeywordSearchResult {
  patentId: string;
  title: string;
  titleKo?: string;
  assignee?: string;
  publicationDate?: string;
  snippet?: string;
  thumbnail?: string;
}
