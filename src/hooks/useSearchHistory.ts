import { useState, useEffect, useCallback } from "react";
import { PatentData, RelatedPatent } from "@/components/PatentSummary/types";

export interface SearchHistoryItem {
  patentNumber: string;
  patentData: PatentData;
  summary: string;
  relatedPatents: RelatedPatent[];
  searchedAt: string;
  commercializationScore?: number | null;
}

const STORAGE_KEY = "patent-search-history";
const MAX_HISTORY_ITEMS = 6;

export function useSearchHistory() {
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setHistory(parsed);
        }
      }
    } catch (error) {
      console.error("Failed to load search history:", error);
    }
  }, []);

  // Save to localStorage whenever history changes
  const saveToStorage = useCallback((items: SearchHistoryItem[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      console.error("Failed to save search history:", error);
    }
  }, []);

  // Add a new item to history
  const addToHistory = useCallback((item: Omit<SearchHistoryItem, "searchedAt">) => {
    setHistory((prev) => {
      // Remove existing item with same patent number if exists
      const filtered = prev.filter(
        (h) => h.patentNumber !== item.patentNumber
      );
      
      // Add new item at the beginning
      const newItem: SearchHistoryItem = {
        ...item,
        searchedAt: new Date().toISOString(),
      };
      
      const updated = [newItem, ...filtered].slice(0, MAX_HISTORY_ITEMS);
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  // Remove an item from history
  const removeFromHistory = useCallback((patentNumber: string) => {
    setHistory((prev) => {
      const updated = prev.filter((h) => h.patentNumber !== patentNumber);
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  // Clear all history
  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    history,
    addToHistory,
    removeFromHistory,
    clearHistory,
  };
}
