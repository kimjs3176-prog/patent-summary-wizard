import { useCallback } from "react";
import { toast } from "sonner";
import { useFavoritePatents } from "@/hooks/useFavoritePatents";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { cardToFavorite, type CardPatentFields } from "./cardFavorite";

/**
 * One favorites hook per list page (not per card) so a long result list does not
 * mount dozens of storage listeners. Respects the feature_favorites site setting
 * the same way the summary screen does.
 */
export function useCardFavorites() {
  const { settings } = useSiteSettings();
  const { isFavorite, addFavorite, removeFavorite } = useFavoritePatents();
  const enabled = settings.feature_favorites !== "false";

  const toggle = useCallback(
    (card: CardPatentFields) => {
      if (!card.patentNumber) return;
      if (isFavorite(card.patentNumber)) {
        removeFavorite(card.patentNumber);
        toast.success("관심특허에서 제거되었습니다");
      } else {
        addFavorite(cardToFavorite(card));
        toast.success("관심특허에 담았습니다", { description: "점수·TRL은 AI 요약을 열면 채워집니다." });
      }
    },
    [isFavorite, addFavorite, removeFavorite],
  );

  return { enabled, isFavorite, toggle };
}
