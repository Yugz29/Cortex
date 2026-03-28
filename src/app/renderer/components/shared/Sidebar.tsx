import { useEffect } from 'react';
import type { Scan } from '../../types';
import { useFileFilters } from '../../hooks/useFileFilters';
import type { FilterKey } from '../../hooks/useFileFilters';
import FilterBar from './FilterBar';
import FileList from './FileList';
import FileTree from './FileTree';
import ActivityPanel from './ActivityPanel';

interface Props {
  scans:            Scan[];
  projectPath:      string;
  selected:         Scan | null;
  events:           { message: string; level: string; type: string; ts: number; filePath?: string | null }[];
  width:            number;
  isOpen:           boolean;
  externalFilter?:  FilterKey;
  excludedFiles:    string[];
  onSelect:         (scan: Scan | null) => void;
  onFilterChange:   (filter: FilterKey) => void;
  onExcludedChange: (list: string[]) => void;
}

export default function Sidebar({
  scans, projectPath, selected, events, width, isOpen, externalFilter,
  excludedFiles, onSelect, onFilterChange, onExcludedChange,
}: Props) {
  const filters = useFileFilters(scans, projectPath, excludedFiles);

  // Remonte le filtre actif vers CortexView (pour OverviewView)
  useEffect(() => { onFilterChange(filters.activeFilter); }, [filters.activeFilter]);

  // Applique un filtre externe (depuis les badges de l'OverviewView)
  useEffect(() => {
    if (externalFilter !== undefined) filters.setActiveFilter(externalFilter);
  }, [externalFilter]);

  return (
    <div style={{
      width: isOpen ? width : 0,
      minWidth: isOpen ? width : 0,
      display: 'flex', flexDirection: 'column', flexShrink: 0,
      overflow: 'hidden', background: 'var(--bg-surface)',
      backdropFilter: 'blur(20px) saturate(160%)',
      WebkitBackdropFilter: 'blur(20px) saturate(160%)',
      borderRight: '0.5px solid var(--border)',
      transition: 'width 0.2s, min-width 0.2s',
    }}>
      <FilterBar
        scans={scans}
        search={filters.search}
        activeFilter={filters.activeFilter}
        showZeroScore={filters.showZeroScore}
        viewMode={filters.viewMode}
        ignoredFiles={filters.ignoredFiles}
        visible={filters.visible}
        zeroCount={filters.zeroCount}
        setSearch={filters.setSearch}
        setActiveFilter={filters.setActiveFilter}
        setShowZeroScore={filters.setShowZeroScore}
        setViewMode={filters.setViewMode}
        clearFilters={filters.clearFilters}
      />

      {filters.viewMode === 'tree' && (
        <FileTree
          scans={scans}
          projectPath={projectPath}
          selected={selected}
          ignoredSet={filters.ignoredSet}
          onSelect={onSelect}
          onIgnore={fp => window.api.ignoreFile(fp).then(list => {
            filters.setIgnoredFiles(list);
            if (selected?.filePath === fp) onSelect(null);
          })}
          showZero={filters.showZeroScore}
        />
      )}

      {filters.viewMode === 'list' && (
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          <FileList
            visible={filters.visible}
            selected={selected}
            nameCounts={filters.nameCounts}
            search={filters.search}
            ignoredSet={filters.excludedSet}
            onSelect={onSelect}
            onIgnore={fp => window.api.excludeFile(fp).then(list => {
              onExcludedChange(list);
              if (selected?.filePath === fp) onSelect(null);
            })}
            onUnignore={fp => window.api.includeFile(fp).then(list => {
              onExcludedChange(list);
            })}
          />
        </div>
      )}

      <ActivityPanel events={events} scans={scans} onSelectScan={onSelect} />
    </div>
  );
}
