import { useMemo } from "react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { DEFAULT_TRL_CONFIG, type TrlConfig } from "@/components/admin/ScoreTrlSettings";
import { resolveTrlLevels } from "@/lib/trlPresentation";

export interface CommercializationDetails {
  technologyScore: number;
  marketScore: number;
  businessScore: number;
  analysis: string;
  trl?: number;
  trlReason?: string;
  technologyReason?: string;
  marketReason?: string;
  businessReason?: string;
}

/** Site TRL settings merged over the shared defaults (custom labels are kept as saved). */
export function useTrlConfig(): TrlConfig {
  const { settings } = useSiteSettings();
  return useMemo(() => {
    if (settings.trl_settings) {
      try {
        const saved = JSON.parse(settings.trl_settings);
        return { ...DEFAULT_TRL_CONFIG, ...saved, levels: resolveTrlLevels(saved?.levels) };
      } catch {
        // Malformed settings fall back to the defaults below.
      }
    }
    return DEFAULT_TRL_CONFIG;
  }, [settings.trl_settings]);
}
