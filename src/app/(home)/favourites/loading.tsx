import { Loader2 } from 'lucide-react';

export default function FavouritesLoading() {
  return (
    <div className="flex h-full w-full items-center justify-center p-10">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <span className="text-body-muted ml-3">Loading favourites…</span>
    </div>
  );
}
