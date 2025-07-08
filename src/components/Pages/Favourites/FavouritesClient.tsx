/* eslint-disable react-hooks/exhaustive-deps */
"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/UI/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/UI/card";
import { IconPicker, Icon } from "@/components/UI/icon-picker";
import { ScrollArea } from "@/components/UI/scroll-area";
import { Button } from "@/components/UI/button";
import { Separator } from "@/components/UI/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/UI/alert";
import { AlertCircle, Save, Check, Loader2, Trash2, Search, X, Star, GripVertical, RefreshCcw } from "lucide-react";
import { showErrorToast, showSuccessToast } from "@/components/Common/Toasts/notifications";
import { cn } from "@/lib/utils";
import { Input } from "@/components/UI/input";
import {
  createFavourite,
  updateFavourite,
  deleteFavourite
} from "@/app/(home)/favourites/actions";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import SuspenseLoader from "@/components/Common/Loaders/SuspenseLoader";
import { Suspense } from "react";

interface Favourite {
  id: number;
  project: string;
  icon: string;
  position: number;
}

interface FavouritesClientProps {
  initialProjects: any;
  initialFavourites: Favourite[];
  apiKey: string;
}

export default function FavouritesClient({ initialProjects, initialFavourites, apiKey }: FavouritesClientProps) {
  const router = useRouter();
  // Deduplicate favourites once (memoised) to avoid new reference each render
  const uniqueInitialFavourites = useMemo(() => {
    return Array.isArray(initialFavourites)
      ? initialFavourites.filter((fav, index, self) =>
          index === self.findIndex(f => f.project === fav.project))
      : [];
  }, [initialFavourites]);

  // Track the full favourite objects including ID and position
  const [favourites, setFavourites] = useState<Favourite[]>(uniqueInitialFavourites);
  
  // Selected projects set for quick lookups
  const initialSet = useMemo(() => new Set<string>(uniqueInitialFavourites.map(f => f.project)), [uniqueInitialFavourites]);
  const [selected, setSelected] = useState<Set<string>>(initialSet);
  
  // Icon map for quick access to icons
  const [iconMap, setIconMap] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    uniqueInitialFavourites.forEach(f => {
      m[f.project] = (typeof f.icon === "string" && f.icon.trim()) || "folder";
    });
    return m;
  });
  
  // ID map for looking up favourite IDs by project name
  const [idMap, setIdMap] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    uniqueInitialFavourites.forEach(f => {
      m[f.project] = f.id;
    });
    return m;
  });
  const [isChanged, setIsChanged] = useState(false);
  const [maxLimitReached, setMaxLimitReached] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Store projects list in state so we can overwrite it on refresh
  const initialProjectsArray = useMemo(
    () => (Array.isArray(initialProjects) ? initialProjects : initialProjects?.projects ?? []),
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

    selected.forEach(item => {
      if (!initialSet.has(item)) {
        setIsChanged(true);
        return;
      }
    });

    // Icon change
    for (const fav of uniqueInitialFavourites) {
      if (iconMap[fav.project] !== (fav.icon || "folder")) {
        setIsChanged(true);
        return;
      }
    }

    // Position/order change
    const currentOrder = favourites.map((f) => f.project).join("|");
    const initialOrder = uniqueInitialFavourites
      .sort((a, b) => a.position - b.position)
      .map((f) => f.project)
      .join("|");
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
      const existing = favourites.find(f => f.project === project) || uniqueInitialFavourites.find(f => f.project === project);
      return {
        id: existing ? existing.id : -1,
        project,
        icon: iconMap[project] || "folder",
        position: index,
      };
    });

    // Only update state if something actually changed (shallow compare length and order)
    if (newFavs.length !== favourites.length || newFavs.some((f, i) => f.project !== favourites[i]?.project || f.icon !== favourites[i]?.icon)) {
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
        setFavourites(current => current.filter(f => f.project !== name));
      } else {
        // Check limit
        if (next.size === 10) {
          setMaxLimitReached(true);
          return prev; // cap at 10
        }
        
        // Add to selected
        next.add(name);
        
        // Set default icon - ensure it's a valid string
        const icon = "folder";
        setIconMap((m) => ({ ...m, [name]: m[name] ?? icon }));
        
        // Check if project already exists in favourites to prevent duplicates
        setFavourites(current => {
          // If project already exists, don't add it again
          if (current.some(f => f.project === name)) {
            return current;
          }
          
          // Add to favourites array with a new position at the end
          return [
            ...current,
            {
              id: -1, // Temporary ID that will be replaced after API call
              project: name,
              icon: icon,
              position: current.length
            }
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
    setFavourites(current => current.filter(f => f.project !== name));
  };

  const saveFavourites = async () => {
    setIsSaving(true);

    let errorsOccurred = false; // track any individual failures

    try {
      const currentFavourites = [...favourites];
      const initialFavouritesSet = new Set(uniqueInitialFavourites.map(f => f.project));
      const currentFavouritesSet = new Set(currentFavourites.map(f => f.project));

      /* ---------- Handle creations & updates ---------- */
      for (let i = 0; i < currentFavourites.length; i++) {
        const fav = currentFavourites[i];
        const position = i;
        const sanitizedIcon = (typeof (iconMap[fav.project]) === 'string' ? iconMap[fav.project].trim() : "folder") || "folder";

        try {
          if (!initialFavouritesSet.has(fav.project) || fav.id === -1) {
            // create new
            const ret = await createFavourite(apiKey, fav.project, sanitizedIcon, position);
            console.log(`Created new favourite for ${fav.project}:`, ret);
          } else {
            const initialFav = uniqueInitialFavourites.find(f => f.project === fav.project);
            if (initialFav && (initialFav.icon !== sanitizedIcon || initialFav.position !== position)) {
              const ret = await updateFavourite(apiKey, initialFav.id, { icon: sanitizedIcon, position });
              console.log(`Updated favourite for ${fav.project}:`, ret);
            }
          }
        } catch (err) {
          errorsOccurred = true;
          console.error(`Save failed for ${fav.project}`, err);
                              showErrorToast(`Failed to save ${fav.project}`);
        }
      }

      /* ---------- Handle deletions ---------- */
      for (const fav of uniqueInitialFavourites.filter(fav => !currentFavouritesSet.has(fav.project))) {
        try {
          const ret = await deleteFavourite(apiKey, fav.id);
          console.log(`Deleted favourite for ${fav.project}:`, ret);
        } catch (err) {
          errorsOccurred = true;
          console.error(`Delete failed for ${fav.project}`, err);
                              showErrorToast(`Failed to remove ${fav.project}`);
        }
      }

      if (errorsOccurred) {
                        showErrorToast("Some favourites could not be saved. Please try again.");
        // keep the changed flag so user can retry
        setIsChanged(true);
      } else {
                        showSuccessToast("Favourites saved");
        setIsChanged(false);
        setSaveSuccess(true);
        // auto-dismiss banner
        setTimeout(() => setSaveSuccess(false), 4000);
      }
    } catch (error) {
      console.error("Error saving favourites:", error);
                  showErrorToast("An unexpected error occurred while saving favourites");
    } finally {
      setIsSaving(false);
    }
  };

  // Filter projects based on search query
  const filteredProjects = searchQuery.trim() === "" 
    ? projects 
    : projects.filter((p: any) => {
        const name = typeof p === "string" ? p : p.name || p.id || "";
        return name.toLowerCase().includes(searchQuery.toLowerCase());
      });

  /* ---------------- Drag‑and‑drop ordering inside selected list ---------------- */
  const handleFavDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setFavourites((items) => {
      const oldIndex = items.findIndex((f) => f.project === active.id);
      const newIndex = items.findIndex((f) => f.project === over.id);
      const newArr = arrayMove(items, oldIndex, newIndex).map((f, idx) => ({
        ...f,
        position: idx,
      }));
      return newArr;
    });
  };

  // Sortable row component for selected favourites
  const SortableFavRow = ({ fav }: { fav: Favourite }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: fav.project });

    const style: React.CSSProperties = {
      transform: CSS.Transform.toString(transform),
      transition: transition || undefined,
    };

    return (
      <div
        ref={setNodeRef as any}
        style={style}
        className={`grid grid-cols-4 gap-4 items-center group hover:bg-muted/30 rounded-md p-2 ${isDragging ? "opacity-50" : ""}`}
      >
        <div className="flex justify-center text-muted-foreground cursor-grab" {...attributes} {...listeners}>
          <GripVertical className="h-4 w-4" />
        </div>
        <div className="flex justify-center">
          <IconPicker
            value={iconMap[fav.project] as any}
            onValueChange={(val: any) => setIconMap((m) => ({ ...m, [fav.project]: val as string }))}
            triggerPlaceholder={iconMap[fav.project] || "Select"}
          >
            <Button
              variant="outline"
              size="sm"
              className="h-10 w-10 p-0 min-w-0 flex items-center justify-center shadow-sm"
            >
              {iconMap[fav.project] ? (
                <Icon name={iconMap[fav.project] as any} className="h-5 w-5" />
              ) : (
                "+"
              )}
            </Button>
          </IconPicker>
        </div>
        <span className="truncate text-sm font-medium text-center">{fav.project}</span>
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={() => removeFromSelected(fav.project)}
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
      ? favData.filter((fav, idx, self) => idx === self.findIndex((f) => f.project === fav.project))
      : [];

    setFavourites(dedupFavs);
    setSelected(new Set(dedupFavs.map((f) => f.project)));

    const newIconMap: Record<string, string> = {};
    const newIdMap: Record<string, number> = {};
    dedupFavs.forEach((f) => {
      newIconMap[f.project] = (typeof f.icon === "string" && f.icon.trim()) || "folder";
      newIdMap[f.project] = f.id;
    });
    setIconMap(newIconMap);
    setIdMap(newIdMap);

    // reset UI state flags
    setIsChanged(false);
    setMaxLimitReached(false);
    setSearchQuery("");
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
        fetch("/api/user/projects"),
        fetch("/api/user/favourites"),
      ]);
      if (projRes.ok && favRes.ok) {
        const projData = await projRes.json();
        const favData: Favourite[] = await favRes.json();
        resetFromData(projData, favData);
      } else {
        showErrorToast("Failed to refresh data");
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="space-y-6 p-8 w-full max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold text-foreground">Favourites</h1>
        <Button variant="outline" size="sm" onClick={refreshData} disabled={isRefreshing}>
          <RefreshCcw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>
      <p className="text-muted-foreground">
        Select up to 10 projects to display on your dashboard.
      </p>

      {maxLimitReached && (
        <Alert 
          variant="destructive" 
          className="animate-in fade-in-0 slide-in-from-top-5 duration-500 shadow-md"
        >
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Maximum Limit Reached</AlertTitle>
          <AlertDescription>
            You can select a maximum of 10 favourite projects. Please remove a project before adding a new one.
          </AlertDescription>
        </Alert>
      )}

      {saveSuccess && (
        <Alert 
          className="bg-background border-primary shadow-md animate-in fade-in-0 slide-in-from-top-5 duration-500">
          <Check className="h-4 w-4 text-foreground" />
          <AlertTitle>Saved</AlertTitle>
          <AlertDescription>Your changes have been saved successfully. You may need to refresh your dashboard to see the changes.</AlertDescription>
        </Alert>
      )}

      {isChanged && (
        <Alert 
          className="bg-primary/10 border-primary/20 shadow-md animate-in fade-in-0 slide-in-from-bottom-5 duration-500"
        >
          <Check className="h-4 w-4 text-primary" />
          <AlertTitle>Changes Detected</AlertTitle>
          <AlertDescription className="flex justify-between items-center flex-wrap gap-2">
            <span className="text-sm">Your favourites have been modified. Save changes to update your dashboard.</span>
          </AlertDescription>
        </Alert>
      )}

      <SuspenseLoader message="Loading favourites…">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Projects list */}
          <Card className="w-full shadow-sm border border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl font-semibold">Available Projects</CardTitle>
              <p className="text-sm text-muted-foreground">
                Select projects to add to your favourites (max 10)
              </p>
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
                  className="pl-9 h-9 text-sm w-full"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {searchQuery && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Showing {filteredProjects.length} of {projects.length} projects
                </p>
              )}
            </div>
            
            <Separator />
            <CardContent className="p-0">
              <ScrollArea className="h-[400px] px-6 py-4">
                {projects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                    <p>No projects available</p>
                  </div>
                ) : filteredProjects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                    <p>No projects match your search</p>
                    <Button 
                      variant="link" 
                      onClick={() => setSearchQuery("")}
                      className="mt-2 text-primary"
                    >
                      Clear search
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredProjects.map((p: any) => {
                      const name = typeof p === "string" ? p : p.name || p.id || "";
                      const isChecked = selected.has(name);
                      return (
                        <div 
                          key={name} 
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-md transition-colors border",
                            isChecked 
                              ? "bg-primary/5 border-primary/20" 
                              : "hover:bg-muted/60 border-transparent"
                          )}
                        >
                          <Checkbox 
                            id={`project-${name}`} 
                            checked={isChecked} 
                            onCheckedChange={() => toggle(name)}
                            className={cn(
                              "h-5 w-5 transition-all",
                              isChecked && "border-primary"
                            )}
                          />
                          <label 
                            htmlFor={`project-${name}`} 
                            className="truncate flex-1 cursor-pointer text-sm font-medium"
                          >
                            {name}
                          </label>
                          {isChecked && (
                            <div className="text-xs text-primary flex items-center">
                              <Star className="h-3 w-3 mr-1 fill-primary text-primary" />
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
          <Card className="w-full shadow-sm border border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl font-semibold">Selected Favourites</CardTitle>
              <p className="text-sm text-muted-foreground">
                Customize icons for your favourite projects
              </p>
            </CardHeader>
            
            <Separator />
            
            <CardContent className="pt-5">
              {selected.size > 0 ? (
                <>
                  <div className="mb-3 grid grid-cols-4 gap-4 text-sm px-2">
                    <div className="" />
                    <div className="font-medium text-center">Icon</div>
                    <div className="font-medium text-center">Project</div>
                    <div className="font-medium text-center">Actions</div>
                  </div>
                  <Separator className="mb-4" />
                  <DndContext collisionDetection={closestCenter} onDragEnd={handleFavDragEnd}>
                    <SortableContext items={favourites.map(f=>f.project)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-4">
                        {favourites.map((fav) => (
                          <SortableFavRow key={fav.project} fav={fav} />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-[320px] text-muted-foreground bg-muted/10 rounded-lg border border-dashed border-muted-foreground/30">
                  <p className="font-medium">No favourites selected</p>
                  <p className="text-sm mt-2">Select projects from the list on the left</p>
                </div>
              )}
            </CardContent>
            
            <Separator className={selected.size > 0 ? "visible" : "invisible"} />
            
            <div className={cn("p-4 flex justify-end", !selected.size && "hidden")}>
              <Button 
                onClick={saveFavourites} 
                disabled={isSaving || !isChanged}
                size="lg"
                className={cn(
                  "bg-primary hover:bg-primary/90 text-white shadow-md transition-all",
                  isChanged ? "animate-pulse-gentle" : ""
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
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in-50 slide-in-from-bottom-10 duration-500">
          <Button 
            onClick={saveFavourites} 
            disabled={isSaving}
            size="lg"
            className="bg-primary hover:bg-primary/90 text-white shadow-lg animate-pulse-gentle"
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