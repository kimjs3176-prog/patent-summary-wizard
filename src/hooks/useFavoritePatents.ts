import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
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
/** Fired after this tab writes favorites so every mounted hook instance (header count, compare page…) reloads. */
const CHANGE_EVENT = "ais:favorites-change";

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

let quotaWarned = false;
/** Writes to localStorage without ever throwing into React's commit phase (quota, private mode, blocked storage). */
function saveJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.warn(`[favorites] failed to persist ${key}:`, e instanceof Error ? e.message : String(e));
    if (!quotaWarned) {
      quotaWarned = true;
      toast.error("브라우저 저장 공간이 부족해 관심특허를 저장하지 못했습니다. 일부 항목을 정리해 주세요.");
    }
    return false;
  }
}

/**
 * Only what the favorites/compare screens display is persisted. Full claims, the
 * description and every drawing of a patent are several hundred KB each, so a
 * handful of favorites could exceed the 5MB localStorage quota.
 */
export function slimPatentData(data: PatentData): PatentData {
  const { description: _description, claims: _claims, images: _images, ...rest } = data;
  return rest;
}

export function useFavoritePatents() {
  const [favorites, setFavorites] = useState<FavoritePatent[]>(() => loadJSON(STORAGE_KEY, []));
  const [folders, setFolders] = useState<FavoriteFolder[]>(() => {
    const stored = loadJSON<FavoriteFolder[]>(FOLDERS_KEY, []);
    return stored.length > 0 ? stored : [];
  });
  const [allTags, setAllTags] = useState<string[]>(() => loadJSON(TAGS_KEY, []));
  // Serialized value this instance wrote last, so a change event echoing our own write is ignored.
  const lastWritten = useRef<Record<string, string>>({});

  const persist = useCallback((key: string, value: unknown) => {
    const serialized = JSON.stringify(value);
    if (lastWritten.current[key] === serialized) return;
    lastWritten.current[key] = serialized;
    if (saveJSON(key, value)) window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: key }));
  }, []);

  useEffect(() => { persist(STORAGE_KEY, favorites); }, [favorites, persist]);
  useEffect(() => { persist(FOLDERS_KEY, folders); }, [folders, persist]);
  useEffect(() => { persist(TAGS_KEY, allTags); }, [allTags, persist]);

  // Keep every instance in sync (same tab via CHANGE_EVENT, other tabs via the storage event).
  useEffect(() => {
    const reload = (key: string | null) => {
      const apply = <T,>(k: string, setter: (v: T) => void, fallback: T) => {
        if (key && key !== k) return;
        let raw: string | null = null;
        try { raw = localStorage.getItem(k); } catch { return; }
        if (raw === null || raw === lastWritten.current[k]) return;
        lastWritten.current[k] = raw;
        try { setter(JSON.parse(raw) as T); } catch { setter(fallback); }
      };
      apply<FavoritePatent[]>(STORAGE_KEY, setFavorites, []);
      apply<FavoriteFolder[]>(FOLDERS_KEY, setFolders, []);
      apply<string[]>(TAGS_KEY, setAllTags, []);
    };
    const onChange = (e: Event) => reload(typeof (e as CustomEvent).detail === "string" ? (e as CustomEvent<string>).detail : null);
    const onStorage = (e: StorageEvent) => { if (!e.key || [STORAGE_KEY, FOLDERS_KEY, TAGS_KEY].includes(e.key)) reload(e.key); };
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const addFavorite = useCallback((patent: FavoritePatent) => {
    setFavorites((prev) => {
      if (prev.some((p) => p.patentNumber === patent.patentNumber)) return prev;
      const { summary: _summary, ...rest } = patent;
      return [...prev, { ...rest, patentData: slimPatentData(patent.patentData), addedAt: new Date().toISOString() }];
    });
  }, []);

  const removeFavorite = useCallback((patentNumber: string) => {
    setFavorites((prev) => prev.filter((p) => p.patentNumber !== patentNumber));
  }, []);

  /** Patches a stored favorite (e.g. fills in the score that arrived after it was added). */
  const updateFavorite = useCallback((patentNumber: string, patch: Partial<Omit<FavoritePatent, "patentNumber">>) => {
    setFavorites((prev) => prev.map((p) => {
      if (p.patentNumber !== patentNumber) return p;
      const next = { ...p, ...patch };
      if (patch.patentData) next.patentData = slimPatentData(patch.patentData);
      delete (next as { summary?: string }).summary;
      return next;
    }));
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
    favorites, addFavorite, removeFavorite, updateFavorite, isFavorite, toggleFavorite,
    folders, addFolder, removeFolder, renameFolder, assignFolder,
    allTags, addTagToPatent, removeTagFromPatent, removeGlobalTag,
  };
}
