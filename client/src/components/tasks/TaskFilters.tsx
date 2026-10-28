/**
 * Task Filters Component
 * Search, filter, and sort tasks
 */

import { useState } from 'react';
import { Search, Filter, X } from 'lucide-react';
import { useSprints } from '@/hooks/useSprints';
import { useUsers } from '@/hooks/useUsers';
import type { TaskFilters as TaskFiltersType } from '@/types';

interface TaskFiltersProps {
  filters: TaskFiltersType;
  onFiltersChange: (filters: TaskFiltersType) => void;
}

export default function TaskFilters({
  filters,
  onFiltersChange,
}: TaskFiltersProps) {
  const [showFilters, setShowFilters] = useState(false);

  const { data: sprintsData } = useSprints();
  const { data: usersData } = useUsers();

  const sprints = Array.isArray(sprintsData?.data) ? sprintsData.data : [];
  const users = Array.isArray(usersData?.data?.users) ? usersData.data.users : [];

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({ ...filters, search: e.target.value });
  };

  const handleSprintChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFiltersChange({
      ...filters,
      sprintId: e.target.value || undefined,
    });
  };

  const handleAssigneeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    onFiltersChange({
      ...filters,
      assignedToId: value === 'unassigned' ? 'null' : (value || undefined),
    });
  };

  const handleNestingLevelChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const value = e.target.value;
    onFiltersChange({
      ...filters,
      nestingLevel: value ? parseInt(value) : undefined,
    });
  };

  const handleProgressMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    onFiltersChange({
      ...filters,
      minProgress: value ? parseInt(value) : undefined,
    });
  };

  const handleProgressMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    onFiltersChange({
      ...filters,
      maxProgress: value ? parseInt(value) : undefined,
    });
  };

  const handleClearFilters = () => {
    onFiltersChange({});
  };

  const hasActiveFilters =
    filters.search ||
    filters.sprintId ||
    filters.assignedToId ||
    filters.nestingLevel !== undefined ||
    filters.minProgress !== undefined ||
    filters.maxProgress !== undefined;

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={filters.search || ''}
            onChange={handleSearchChange}
            className="w-full rounded-md border border-input bg-background px-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {filters.search && (
            <button
              onClick={() => onFiltersChange({ ...filters, search: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-accent"
        >
          <Filter className="h-4 w-4" />
          Filters
          {hasActiveFilters && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
              {[
                filters.sprintId,
                filters.assignedToId,
                filters.nestingLevel !== undefined,
                filters.minProgress !== undefined,
                filters.maxProgress !== undefined,
              ].filter(Boolean).length}
            </span>
          )}
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="rounded-md border border-border bg-card p-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">Filters</h3>
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Sprint Filter */}
            <div>
              <label className="mb-1 block text-sm font-medium">Sprint</label>
              <select
                value={filters.sprintId || ''}
                onChange={handleSprintChange}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">All Sprints</option>
                {sprints.map((sprint) => (
                  <option key={sprint.id} value={sprint.id}>
                    {sprint.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Assignee Filter */}
            <div>
              <label className="mb-1 block text-sm font-medium">
                Assigned To
              </label>
              <select
                value={filters.assignedToId === 'null' ? 'unassigned' : (filters.assignedToId || '')}
                onChange={handleAssigneeChange}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">All Tasks</option>
                <option value="unassigned">Unassigned</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Nesting Level Filter */}
            <div>
              <label className="mb-1 block text-sm font-medium">
                Nesting Level
              </label>
              <select
                value={filters.nestingLevel ?? ''}
                onChange={handleNestingLevelChange}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">All Levels</option>
                <option value="0">Level 0 (Top)</option>
                <option value="1">Level 1</option>
                <option value="2">Level 2</option>
                <option value="3">Level 3 (Max)</option>
              </select>
            </div>

            {/* Progress Min Filter */}
            <div>
              <label className="mb-1 block text-sm font-medium">
                Progress Min (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={filters.minProgress ?? ''}
                onChange={handleProgressMinChange}
                placeholder="0"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Progress Max Filter */}
            <div>
              <label className="mb-1 block text-sm font-medium">
                Progress Max (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={filters.maxProgress ?? ''}
                onChange={handleProgressMaxChange}
                placeholder="100"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
