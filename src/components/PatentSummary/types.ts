export interface PatentData {
  title?: string;
  abstract?: string;
  inventors?: string[];
  assignee?: string;
  filingDate?: string;
  publicationDate?: string;
  claims?: string[];
  patentNumber?: string;
  applicationNumber?: string;
  classifications?: string[];
}

export interface RelatedPatent {
  patentId: string;
  title: string;
  assignee?: string;
  publicationDate?: string;
  snippet?: string;
  link?: string;
}

export interface PatentSummaryProps {
  content: string;
  patentNumber: string;
  isStreaming: boolean;
  patentData?: PatentData | null;
  relatedPatents?: RelatedPatent[];
}
