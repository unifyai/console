/* eslint-disable react-hooks/exhaustive-deps */
'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Checkbox } from '@/components/UI/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/UI/card';
import { IconPicker, Icon } from '@/components/UI/icon-picker';
import { ScrollArea } from '@/components/UI/scroll-area';
import { Button } from '@/components/UI/button';
import { Separator } from '@/components/UI/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/UI/alert';
import {
  AlertCircle,
  Save,
  Check,
  Loader2,
  Trash2,
  Search,
  X,
  Star,
  GripVertical,
  RefreshCcw,
} from 'lucide-react';
import { showErrorToast, showSuccessToast } from '@/components/Common/Toasts/notifications';
import { cn } from '@/lib/utils';
import { Input } from '@/components/UI/input';
import { createFavourite, updateFavourite, deleteFavourite } from '@/lib/interfaces/favourites';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import SuspenseLoader from '@/components/Common/Loaders/SuspenseLoader';
import { Suspense } from 'react';

interface Favourite {
  id: number;
  projectName: string;
  icon: string;
  position: number;
}

interface FavouritesClientProps {
  initialProjects: any;
  initialFavourites: Favourite[];
  apiKey: string;
}

export default function FavouritesClient({
  initialProjects,
  initialFavourites,
  apiKey,
}: FavouritesClientProps) {
  const router = useRouter();
  // Deduplicate favourites once (memoised) to avoid new reference each render
  const uniqueInitialFavourites = useMemo(() => {
    return Array.isArray(initialFavourites)
      ? initialFavourites.filter(
          (fav, index, self) => index === self.findIndex((f) => f.projectName === fav.projectName)
        )
      : [];
  }, [initialFavourites]);

  // Track the full favourite objects including ID and position
  const [favourites, setFavourites] = useState<Favourite[]>(uniqueInitialFavourites);

  // Selected projects set for quick lookups
  const initialSet = useMemo(
    () => new Set<string>(uniqueInitialFavourites.map((f) => f.projectName)),
    [uniqueInitialFavourites]
  );
  const [selected, setSelected] = useState<Set<string>>(initialSet);

  // Icon map for quick access to icons
  const [iconMap, setIconMap] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    uniqueInitialFavourites.forEach((f) => {
      m[f.projectName] = (typeof f.icon === 'string' && f.icon.trim()) || 'folder';
    });
    return m;
  });

  // ID map for looking up favourite IDs by project name
  const [idMap, setIdMap] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    uniqueInitialFavourites.forEach((f) => {
      m[f.projectName] = f.id;
    });
    return m;
  });
  const [isChanged, setIsChanged] = useState(false);
  const [maxLimitReached, setMaxLimitReached] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Store projects list in state so we can overwrite it on refresh
  const initialProjectsArray = useMemo(
    () => (Array.isArray(initialProjects) ? initialProjects : (initialProjects?.projects ?? [])),
    [initialProjects]
  );
  const [projects, setProjects] = useState<any[]>(initialProjectsArray);

  // Check for changes to enable save button
  useEffect(() => {
    // Size / membership change
    if (selected.size !== initialSet.size) {
      setIsChanged(true);
      return;
    }

    selected.forEach((item) => {
      if (!initialSet.has(item)) {
        setIsChanged(true);
        return;
      }
    });

    // Icon change
    for (const fav of uniqueInitialFavourites) {
      if (iconMap[fav.projectName] !== (fav.icon || 'folder')) {
        setIsChanged(true);
        return;
      }
    }

    // Position/order change
    const currentOrder = favourites.map((f) => f.projectName).join('|');
    const initialOrder = uniqueInitialFavourites
      .sort((a, b) => a.position - b.position)
      .map((f) => f.projectName)
      .join('|');
    if (currentOrder !== initialOrder) {
      setIsChanged(true);
      return;
    }

    setIsChanged(false);
  }, [selected, iconMap, favourites, uniqueInitialFavourites, initialSet]);

  // Reset max limit alert after 3 seconds
  useEffect(() => {
    if (maxLimitReached) {
      const timer = setTimeout(() => {
        setMaxLimitReached(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [maxLimitReached]);

  // Sync favourites with selected set to prevent duplicates
  useEffect(() => {
    const newFavs: Favourite[] = Array.from(selected).map((project, index) => {
      const existing =
        favourites.find((f) => f.projectName === project) ||
        uniqueInitialFavourites.find((f) => f.projectName === project);
      return {
        id: existing ? existing.id : -1,
        projectName: project,
        icon: iconMap[project] || 'folder',
        position: index,
      };
    });

    // Only update state if something actually changed (shallow compare length and order)
    if (
      newFavs.length !== favourites.length ||
      newFavs.some(
        (f, i) => f.projectName !== favourites[i]?.projectName || f.icon !== favourites[i]?.icon
      )
    ) {
      setFavourites(newFavs);
    }
  }, [selected, iconMap]);

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);

      if (next.has(name)) {
        // Remove from selected
        next.delete(name);

        // Update favourites array
        setFavourites((current) => current.filter((f) => f.projectName !== name));
      } else {
        // Check limit
        if (next.size === 10) {
          setMaxLimitReached(true);
          return prev; // cap at 10
        }

        // Add to selected
        next.add(name);

        // Set default icon - ensure it's a valid string
        const icon = 'folder';
        setIconMap((m) => ({ ...m, [name]: m[name] ?? icon }));

        // Check if project already exists in favourites to prevent duplicates
        setFavourites((current) => {
          // If project already exists, don't add it again
          if (current.some((f) => f.projectName === name)) {
            return current;
          }

          // Add to favourites array with a new position at the end
          return [
            ...current,
            {
              id: -1, // Temporary ID that will be replaced after API call
              projectName: name,
              icon: icon,
              position: current.length,
            },
          ];
        });
      }

      return next;
    });
  };

  const removeFromSelected = (name: string) => {
    // Remove from selected set
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(name);
      return next;
    });

    // Remove from favourites array
    setFavourites((current) => current.filter((f) => f.projectName !== name));
  };

  const saveFavourites = async () => {
    setIsSaving(true);

    let errorsOccurred = false; // track any individual failures

    try {
      const currentFavourites = [...favourites];
      const initialFavouritesSet = new Set(uniqueInitialFavourites.map((f) => f.projectName));
      const currentFavouritesSet = new Set(currentFavourites.map((f) => f.projectName));

      /* ---------- Handle creations & updates ---------- */
      for (let i = 0; i < currentFavourites.length; i++) {
        const fav = currentFavourites[i];
        const position = i;
        const sanitizedIcon =
          (typeof iconMap[fav.projectName] === 'string'
            ? iconMap[fav.projectName].trim()
            : 'folder') || 'folder';

        try {
          if (!initialFavouritesSet.has(fav.projectName) || fav.id === -1) {
            // create new
            const createFav = await createFavourite(apiKey);
            const ret = await createFav(fav.projectName, sanitizedIcon, position);
            console.log(`Created new favourite for ${fav.projectName}:`, ret);
          } else {
            const initialFav = uniqueInitialFavourites.find(
              (f) => f.projectName === fav.projectName
            );
            if (
              initialFav &&
              (initialFav.icon !== sanitizedIcon || initialFav.position !== position)
            ) {
              const updateFav = await updateFavourite(apiKey);
              const ret = await updateFav(initialFav.id, { icon: sanitizedIcon, position });
              console.log(`Updated favourite for ${fav.projectName}:`, ret);
            }
          }
        } catch (err) {
          errorsOccurred = true;
          console.error(`Save failed for ${fav.projectName}`, err);
          showErrorToast(`Failed to save ${fav.projectName}`);
        }
      }

      /* ---------- Handle deletions ---------- */
      for (const fav of uniqueInitialFavourites.filter(
        (fav) => !currentFavouritesSet.has(fav.projectName)
      )) {
        try {
          const deleteFav = await deleteFavourite(apiKey);
          const ret = await deleteFav(fav.id);

          console.log(`Deleted favourite for ${fav.projectName}:`, ret);
        } catch (err) {
          errorsOccurred = true;
          console.error(`Delete failed for ${fav.projectName}`, err);
          showErrorToast(`Failed to remove ${fav.projectName}`);
        }
      }

      if (errorsOccurred) {
        showErrorToast('Some favourites could not be saved. Please try again.');
        // keep the changed flag so user can retry
        setIsChanged(true);
      } else {
        showSuccessToast('Favourites saved');
        setIsChanged(false);
        setSaveSuccess(true);
        // auto-dismiss banner
        setTimeout(() => setSaveSuccess(false), 4000);
      }
    } catch (error) {
      console.error('Error saving favourites:', error);
      showErrorToast('An unexpected error occurred while saving favourites');
    } finally {
      setIsSaving(false);
    }
  };

  // Filter projects based on search query
  const filteredProjects =
    searchQuery.trim() === ''
      ? projects
      : projects.filter((p: any) => {
          const name = typeof p === 'string' ? p : p.name || p.id || '';
          return name.toLowerCase().includes(searchQuery.toLowerCase());
        });

  /* ---------------- Drag‑and‑drop ordering inside selected list ---------------- */
  const handleFavDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setFavourites((items) => {
      const oldIndex = items.findIndex((f) => f.projectName === active.id);
      const newIndex = items.findIndex((f) => f.projectName === over.id);
      const newArr = arrayMove(items, oldIndex, newIndex).map((f, idx) => ({
        ...f,
        position: idx,
      }));
      return newArr;
    });
  };

  // Sortable row component for selected favourites
  const SortableFavRow = ({ fav }: { fav: Favourite }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: fav.projectName,
    });

    const style: React.CSSProperties = {
      transform: CSS.Transform.toString(transform),
      transition: transition || undefined,
    };

    return (
      <div
        ref={setNodeRef as any}
        style={style}
        className={`hover:bg-muted/30 group grid grid-cols-4 items-center gap-4 rounded-md p-2 ${isDragging ? 'opacity-50' : ''}`}
      >
        <div
          className="flex cursor-grab justify-center text-muted-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </div>
        <div className="flex justify-center">
          <IconPicker
            value={iconMap[fav.projectName] as any}
            onValueChange={(val: any) =>
              setIconMap((m) => ({ ...m, [fav.projectName]: val as string }))
            }
            triggerPlaceholder={iconMap[fav.projectName] || 'Select'}
          >
            <Button
              variant="outline"
              size="sm"
              className="flex h-10 w-10 min-w-0 items-center justify-center p-0 shadow-sm"
            >
              {iconMap[fav.projectName] ? (
                <Icon name={iconMap[fav.projectName] as any} className="h-5 w-5" />
              ) : (
                '+'
              )}
            </Button>
          </IconPicker>
        </div>
        <span className="text-title truncate text-center">{fav.projectName}</span>
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-destructive/10 h-9 w-9 text-muted-foreground hover:text-destructive"
            onClick={() => removeFromSelected(fav.projectName)}
            title="Remove from favourites"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  /** Reset all client‑side state back to defaults using fresh server data */
  const resetFromData = (projData: any[], favData: Favourite[]) => {
    setProjects(projData);

    const dedupFavs: Favourite[] = Array.isArray(favData)
      ? favData.filter(
          (fav, idx, self) => idx === self.findIndex((f) => f.projectName === fav.projectName)
        )
      : [];

    setFavourites(dedupFavs);
    setSelected(new Set(dedupFavs.map((f) => f.projectName)));

    const newIconMap: Record<string, string> = {};
    const newIdMap: Record<string, number> = {};
    dedupFavs.forEach((f) => {
      newIconMap[f.projectName] = (typeof f.icon === 'string' && f.icon.trim()) || 'folder';
      newIdMap[f.projectName] = f.id;
    });
    setIconMap(newIconMap);
    setIdMap(newIdMap);

    // reset UI state flags
    setIsChanged(false);
    setMaxLimitReached(false);
    setSearchQuery('');
  };

  // If the server props change (e.g. after a soft refresh), sync the local state
  useEffect(() => {
    resetFromData(initialProjectsArray, uniqueInitialFavourites);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProjectsArray, uniqueInitialFavourites.length]);

  const refreshData = async () => {
    try {
      setIsRefreshing(true);
      const [projRes, favRes] = await Promise.all([
        fetch('/api/user/projects'),
        fetch('/api/user/favourites'),
      ]);
      if (projRes.ok && favRes.ok) {
        const projData = await projRes.json();
        const favData: Favourite[] = await favRes.json();
        resetFromData(projData, favData);
      } else {
        showErrorToast('Failed to refresh data');
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold text-foreground">Favourites</h1>
        <Button variant="outline" size="sm" onClick={refreshData} disabled={isRefreshing}>
          <RefreshCcw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>
      <p className="text-muted-foreground">
        Select up to 10 projects to display on your dashboard.
      </p>

      {maxLimitReached && (
        <Alert
          variant="destructive"
          className="shadow-md duration-500 animate-in fade-in-0 slide-in-from-top-5"
        >
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Maximum Limit Reached</AlertTitle>
          <AlertDescription>
            You can select a maximum of 10 favourite projects. Please remove a project before adding
            a new one.
          </AlertDescription>
        </Alert>
      )}

      {saveSuccess && (
        <Alert className="border-primary bg-background shadow-md duration-500 animate-in fade-in-0 slide-in-from-top-5">
          <Check className="h-4 w-4 text-foreground" />
          <AlertTitle>Saved</AlertTitle>
          <AlertDescription>
            Your changes have been saved successfully. You may need to refresh your dashboard to see
            the changes.
          </AlertDescription>
        </Alert>
      )}

      {isChanged && (
        <Alert className="bg-primary/10 border-primary/20 shadow-md duration-500 animate-in fade-in-0 slide-in-from-bottom-5">
          <Check className="h-4 w-4 text-primary" />
          <AlertTitle>Changes Detected</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-body">
              Your favourites have been modified. Save changes to update your dashboard.
            </span>
          </AlertDescription>
        </Alert>
      )}

      <SuspenseLoader message="Loading favourites…">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Projects list */}
          <Card className="w-full border border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-h1 text-semibold">Available Projects</CardTitle>
              <p className="text-body-muted">Select projects to add to your favourites (max 10)</p>
            </CardHeader>

            <Separator />

            {/* Search input */}
            <div className="px-6 py-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="text-body h-9 w-full pl-9"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {searchQuery && (
                <p className="text-caption mt-2">
                  Showing {filteredProjects.length} of {projects.length} projects
                </p>
              )}
            </div>

            <Separator />
            <CardContent className="p-0">
              <ScrollArea className="h-[400px] px-6 py-4">
                {projects.length === 0 ? (
                  <div className="flex h-[200px] flex-col items-center justify-center text-muted-foreground">
                    <p>No projects available</p>
                  </div>
                ) : filteredProjects.length === 0 ? (
                  <div className="flex h-[200px] flex-col items-center justify-center text-muted-foreground">
                    <p>No projects match your search</p>
                    <Button
                      variant="link"
                      onClick={() => setSearchQuery('')}
                      className="mt-2 text-primary"
                    >
                      Clear search
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredProjects.map((p: any) => {
                      const name = typeof p === 'string' ? p : p.name || p.id || '';
                      const isChecked = selected.has(name);
                      return (
                        <div
                          key={name}
                          className={cn(
                            'flex items-center gap-3 rounded-md border p-3 transition-colors',
                            isChecked
                              ? 'bg-primary/5 border-primary/20'
                              : 'hover:bg-muted/60 border-transparent'
                          )}
                        >
                          <Checkbox
                            id={`project-${name}`}
                            checked={isChecked}
                            onCheckedChange={() => toggle(name)}
                            className={cn('h-5 w-5 transition-all', isChecked && 'border-primary')}
                          />
                          <label
                            htmlFor={`project-${name}`}
                            className="text-title flex-1 cursor-pointer truncate"
                          >
                            {name}
                          </label>
                          {isChecked && (
                            <div className="text-label flex items-center text-primary">
                              <Star className="mr-1 h-3 w-3 fill-primary text-primary" />
                              Added
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Selected favourites with icon pickers */}
          <Card className="w-full border border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-h1 text-semibold">Selected Favourites</CardTitle>
              <p className="text-body-muted">Customize icons for your favourite projects</p>
            </CardHeader>

            <Separator />

            <CardContent className="pt-5">
              {selected.size > 0 ? (
                <>
                  <div className="text-body mb-3 grid grid-cols-4 gap-4 px-2">
                    <div className="" />
                    <div className="select-none text-center font-medium">Icon</div>
                    <div className="select-none text-center font-medium">Project</div>
                    <div className="select-none text-center font-medium">Actions</div>
                  </div>
                  <Separator className="mb-4" />
                  <DndContext collisionDetection={closestCenter} onDragEnd={handleFavDragEnd}>
                    <SortableContext
                      items={favourites.map((f) => f.projectName)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-4">
                        {favourites.map((fav) => (
                          <SortableFavRow key={fav.projectName} fav={fav} />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </>
              ) : (
                <div className="bg-muted/10 border-muted-foreground/30 flex h-[320px] flex-col items-center justify-center rounded-lg border border-dashed text-muted-foreground">
                  <p className="font-medium">No favourites selected</p>
                  <p className="text-body mt-2">Select projects from the list on the left</p>
                </div>
              )}
            </CardContent>

            <Separator className={selected.size > 0 ? 'visible' : 'invisible'} />

            <div className={cn('flex justify-end p-4', !selected.size && 'hidden')}>
              <Button
                onClick={saveFavourites}
                disabled={isSaving || !isChanged}
                size="lg"
                className={cn(
                  'hover:bg-primary/90 bg-primary text-primary-foreground shadow-md transition-all',
                  isChanged ? 'animate-pulse-gentle' : ''
                )}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-5 w-5" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      </SuspenseLoader>

      {isChanged && (
        <div className="fixed bottom-6 right-6 z-50 duration-500 animate-in fade-in-50 slide-in-from-bottom-10">
          <Button
            onClick={saveFavourites}
            disabled={isSaving}
            size="lg"
            className="hover:bg-primary/90 animate-pulse-gentle bg-primary text-primary-foreground shadow-lg"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-5 w-5" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
