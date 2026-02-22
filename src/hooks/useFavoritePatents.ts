import { useState, useCallback, useEffect } from "react";
import { PatentData } from "@/components/PatentSummary/types";
import { CommercializationDetails } from "@/components/PatentSummary/TechnologyCommercializationScore";

export interface FavoritePatent {
  patentNumber: string;
  patentData: PatentData;
  commercializationScore?: number | null;
  commercializationDetails?: CommercializationDetails | null;
  summary?: string;
  addedAt: string;
}

const STORAGE_KEY = "favorite-patents";

export function useFavoritePatents() {
  const [favorites, setFavorites] = useState<FavoritePatent[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  }, [favorites]);

  const addFavorite = useCallback((patent: FavoritePatent) => {
    setFavorites((prev) => {
      if (prev.some((p) => p.patentNumber === patent.patentNumber)) return prev;
      return [...prev, { ...patent, addedAt: new Date().toISOString() }];
    });
  }, []);

  const removeFavorite = useCallback((patentNumber: string) => {
    setFavorites((prev) => prev.filter((p) => p.patentNumber !== patentNumber));
  }, []);

  const isFavorite = useCallback(
    (patentNumber: string) => favorites.some((p) => p.patentNumber === patentNumber),
    [favorites]
  );

  const toggleFavorite = useCallback(
    (patent: FavoritePatent) => {
      if (isFavorite(patent.patentNumber)) {
        removeFavorite(patent.patentNumber);
      } else {
        addFavorite(patent);
      }
    },
    [isFavorite, addFavorite, removeFavorite]
  );

  return { favorites, addFavorite, removeFavorite, isFavorite, toggleFavorite };
}
