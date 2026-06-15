import { Loader } from '@/components/Common/Loader';

export default function FavouritesLoading() {
  return (
    <div className="flex h-full w-full items-center justify-center p-10">
      <Loader size={32} />
      <span className="text-body-muted ml-3">Loading favourites…</span>
    </div>
  );
}
