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
  folder?: string;
  tags?: string[];
}

export interface FavoriteFolder {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

const STORAGE_KEY = "favorite-patents";
const FOLDERS_KEY = "favorite-folders";
const TAGS_KEY = "favorite-tags";

const DEFAULT_FOLDERS: FavoriteFolder[] = [
  { id: "all", name: "전체", color: "hsl(var(--primary))", createdAt: "" },
];

const DEFAULT_COLORS = [
  "hsl(158 64% 40%)",
  "hsl(220 70% 55%)",
  "hsl(350 65% 55%)",
  "hsl(45 93% 47%)",
  "hsl(280 60% 55%)",
  "hsl(190 70% 45%)",
];

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

export function useFavoritePatents() {
  const [favorites, setFavorites] = useState<FavoritePatent[]>(() => loadJSON(STORAGE_KEY, []));
  const [folders, setFolders] = useState<FavoriteFolder[]>(() => {
    const stored = loadJSON<FavoriteFolder[]>(FOLDERS_KEY, []);
    return stored.length > 0 ? stored : [];
  });
  const [allTags, setAllTags] = useState<string[]>(() => loadJSON(TAGS_KEY, []));

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites)); }, [favorites]);
  useEffect(() => { localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders)); }, [folders]);
  useEffect(() => { localStorage.setItem(TAGS_KEY, JSON.stringify(allTags)); }, [allTags]);

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

  // Folder operations
  const addFolder = useCallback((name: string) => {
    const color = DEFAULT_COLORS[folders.length % DEFAULT_COLORS.length];
    const newFolder: FavoriteFolder = {
      id: `folder-${Date.now()}`,
      name,
      color,
      createdAt: new Date().toISOString(),
    };
    setFolders((prev) => [...prev, newFolder]);
    return newFolder;
  }, [folders.length]);

  const removeFolder = useCallback((folderId: string) => {
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
    // Unassign patents from deleted folder
    setFavorites((prev) => prev.map((p) => p.folder === folderId ? { ...p, folder: undefined } : p));
  }, []);

  const renameFolder = useCallback((folderId: string, newName: string) => {
    setFolders((prev) => prev.map((f) => f.id === folderId ? { ...f, name: newName } : f));
  }, []);

  const assignFolder = useCallback((patentNumber: string, folderId: string | undefined) => {
    setFavorites((prev) => prev.map((p) => p.patentNumber === patentNumber ? { ...p, folder: folderId } : p));
  }, []);

  // Tag operations
  const addTagToPatent = useCallback((patentNumber: string, tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    setFavorites((prev) => prev.map((p) => {
      if (p.patentNumber !== patentNumber) return p;
      const existing = p.tags || [];
      if (existing.includes(trimmed)) return p;
      return { ...p, tags: [...existing, trimmed] };
    }));
    setAllTags((prev) => prev.includes(trimmed) ? prev : [...prev, trimmed]);
  }, []);

  const removeTagFromPatent = useCallback((patentNumber: string, tag: string) => {
    setFavorites((prev) => prev.map((p) => {
      if (p.patentNumber !== patentNumber) return p;
      return { ...p, tags: (p.tags || []).filter((t) => t !== tag) };
    }));
  }, []);

  const removeGlobalTag = useCallback((tag: string) => {
    setAllTags((prev) => prev.filter((t) => t !== tag));
    setFavorites((prev) => prev.map((p) => ({ ...p, tags: (p.tags || []).filter((t) => t !== tag) })));
  }, []);

  return {
    favorites, addFavorite, removeFavorite, isFavorite, toggleFavorite,
    folders, addFolder, removeFolder, renameFolder, assignFolder,
    allTags, addTagToPatent, removeTagFromPatent, removeGlobalTag,
  };
}
