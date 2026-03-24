import { useState, useEffect } from 'react';
import type { Scan } from '../types';

export type FilterKey = 'critical' | 'stressed' | 'healthy' | 'hotspot' | null;

export interface FileFiltersResult {
  // State
  search:         string;
  activeFilter:   FilterKey;
  showZeroScore:  boolean;
  viewMode:       'list' | 'tree';
  ignoredFiles:   string[];
  ignoredSet:     Set<string>;
  // Computed
  sorted:         Scan[];
  visible:        Scan[];
  zeroCount:      number;
  nameCounts:     Map<string, number>;
  // Actions
  setSearch:         (v: string) => void;
  setActiveFilter:   (v: FilterKey) => void;
  setShowZeroScore:  (v: boolean | ((prev: boolean) => boolean)) => void;
  setViewMode:       (v: 'list' | 'tree') => void;
  setIgnoredFiles:   (v: string[]) => void;
  clearFilters:      () => void;
}

export function useFileFilters(scans: Scan[], projectPath: string): FileFiltersResult {
  const [search,        setSearch]        = useState('');
  const [activeFilter,  setActiveFilter]  = useState<FilterKey>(null);
  const [showZeroScore, setShowZeroScore] = useState(false);
  const [viewMode,      setViewMode]      = useState<'list' | 'tree'>('list');
  const [ignoredFiles,  setIgnoredFiles]  = useState<string[]>([]);

  useEffect(() => {
    window.api.getIgnoredFiles().then(setIgnoredFiles);
  }, [projectPath]);

  const sorted = [...scans].sort((a, b) => b.globalScore - a.globalScore);

  const afterFilter =
    activeFilter === 'critical' ? sorted.filter(s => s.globalScore >= 50) :
    activeFilter === 'stressed' ? sorted.filter(s => s.globalScore >= 20 && s.globalScore < 50) :
    activeFilter === 'healthy'  ? sorted.filter(s => s.globalScore < 20) :
    activeFilter === 'hotspot'  ? [...scans].filter(s => s.hotspotScore > 0).sort((a, b) => b.hotspotScore - a.hotspotScore) :
    sorted;

  const afterSearch = search.trim()
    ? afterFilter.filter(s => s.filePath.toLowerCase().includes(search.toLowerCase()))
    : afterFilter;

  const ignoredSet  = new Set(ignoredFiles);
  const afterIgnore = afterSearch.filter(s => !ignoredSet.has(s.filePath));
  const zeroCount   = afterIgnore.filter(s => s.globalScore === 0).length;
  const visible     = afterIgnore.filter(s => showZeroScore || s.globalScore > 0);

  const nameCounts = new Map<string, number>();
  sorted.forEach(s => {
    const n = s.filePath.split('/').pop() ?? '';
    nameCounts.set(n, (nameCounts.get(n) ?? 0) + 1);
  });

  function clearFilters() {
    setSearch('');
    setActiveFilter(null);
  }

  return {
    search, activeFilter, showZeroScore, viewMode, ignoredFiles, ignoredSet,
    sorted, visible, zeroCount, nameCounts,
    setSearch, setActiveFilter, setShowZeroScore, setViewMode, setIgnoredFiles,
    clearFilters,
  };
}
