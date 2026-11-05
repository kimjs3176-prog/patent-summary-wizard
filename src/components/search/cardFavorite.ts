import type { PatentData } from "@/components/PatentSummary/types";
import type { FavoritePatent } from "@/hooks/useFavoritePatents";

/** What a search/finder/potential-tech card knows about a patent. */
export interface CardPatentFields {
  /** Number the summary page is opened with (/?patent=…); favorites are keyed by it. */
  patentNumber: string;
  title?: string;
  titleKo?: string;
  assignee?: string;
  applicationNumber?: string;
  registrationNumber?: string | null;
  applicationDate?: string;
  publicationDate?: string;
  registrationDate?: string | null;
  representativeImage?: string;
}

const clean = (v?: string | null, max = 300) => {
  const t = (v ?? "").replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : undefined;
};

/**
 * Minimal favorite built from card fields only. Score/TRL stay empty: the summary
 * screen back-fills them when the user opens the patent.
 */
export function cardToFavorite(card: CardPatentFields): FavoritePatent {
  const title = clean(card.titleKo) || clean(card.title);
  const patentData: PatentData = {
    title: clean(card.title) || title,
    titleKo: title,
    assignee: clean(card.assignee, 120),
    patentNumber: card.patentNumber,
    applicationNumber: clean(card.applicationNumber, 40),
    registrationNumber: clean(card.registrationNumber, 40),
    filingDate: clean(card.applicationDate, 20),
    publicationDate: clean(card.publicationDate, 20),
    registrationDate: clean(card.registrationDate, 20),
    representativeImage: clean(card.representativeImage, 1000),
  };
  for (const k of Object.keys(patentData) as (keyof PatentData)[]) {
    if (patentData[k] === undefined) delete patentData[k];
  }
  return {
    patentNumber: card.patentNumber,
    patentData,
    commercializationScore: null,
    commercializationDetails: null,
    addedAt: new Date().toISOString(),
  };
}
