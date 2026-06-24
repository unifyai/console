'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { Camera, Loader2, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { User } from '@/types/user';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/UI/dropdown-menu';

// `PhotoCropDialog` pulls in `react-easy-crop` and only renders
// after the user picks a file. Lazy-load it so it doesn't bloat
// the account page's initial JS.
const PhotoCropDialog = dynamic(
  () => import('@/components/UI/PhotoCropDialog').then((m) => m.PhotoCropDialog),
  { ssr: false }
);

async function resolvePhotoUrl(image: string): Promise<string> {
  if (!image.startsWith('gs://')) return image;
  const res = await fetch('/api/storage/signed-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // eslint-disable-next-line @typescript-eslint/naming-convention -- API expects snake_case
    body: JSON.stringify({ gs_url: image }),
  });
  if (!res.ok) throw new Error('Failed to resolve photo URL');
  const data = await res.json();
  return data.signed_url;
}

interface ProfilePhotoProps {
  user: User;
}

const ProfilePhoto = ({ user }: ProfilePhotoProps) => {
  const router = useRouter();
  const [savedPhotoUrl, setSavedPhotoUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Crop dialog state
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropSourceType, setCropSourceType] = useState<string | undefined>();
  const [isCropOpen, setIsCropOpen] = useState(false);

  useEffect(() => {
    if (user.image) {
      resolvePhotoUrl(user.image)
        .then(setSavedPhotoUrl)
        .catch(() => setSavedPhotoUrl(user.image));
    } else {
      setSavedPhotoUrl(null);
    }
    // The server-resolved image is now authoritative; drop any local preview
    // left over from an eager upload so we don't mask server-side reprocessing.
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, [user.image]);

  const displayUrl = previewUrl ?? savedPhotoUrl;

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Please select a JPEG, PNG, WebP, or GIF image.');
      return;
    }

    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast.error('Image must be under 5MB.');
      return;
    }

    // Open the crop dialog instead of directly calling onFileSelect
    const objectUrl = URL.createObjectURL(file);
    setCropSrc(objectUrl);
    setCropSourceType(file.type);
    setIsCropOpen(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleCropConfirm = useCallback(
    async (croppedFile: File) => {
      setIsCropOpen(false);
      if (cropSrc) URL.revokeObjectURL(cropSrc);
      setCropSrc(null);
      setCropSourceType(undefined);

      // Show the cropped result immediately, then persist. `router.refresh()`
      // swaps in the server asset and the `user.image` effect clears the preview.
      const preview = URL.createObjectURL(croppedFile);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return preview;
      });
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', croppedFile);
        const response = await fetch('/api/user/photo/upload', {
          method: 'POST',
          body: formData,
        });
        if (!response.ok) {
          toast.error('Could not update profile photo. Please try again.');
          setPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
          });
          return;
        }
        router.refresh();
      } catch (error) {
        console.error('Failed to upload profile photo', error);
        toast.error('Could not update profile photo. Please try again.');
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
      } finally {
        setIsUploading(false);
      }
    },
    [cropSrc, router]
  );

  const handleCropCancel = useCallback(() => {
    setIsCropOpen(false);
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    setCropSourceType(undefined);
  }, [cropSrc]);

  const handleRemovePhoto = useCallback(async () => {
    if (!displayUrl || isRemoving) return;

    setIsRemoving(true);
    try {
      const response = await fetch('/api/user/photo', { method: 'DELETE' });
      if (!response.ok) {
        toast.error('Could not remove profile photo. Please try again.');
        return;
      }

      setSavedPhotoUrl(null);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      router.refresh();
      toast.success('Profile photo removed.');
    } catch (error) {
      console.error('Failed to remove profile photo', error);
      toast.error('Could not remove profile photo. Please try again.');
    } finally {
      setIsRemoving(false);
    }
  }, [displayUrl, isRemoving, router]);

  const isBusy = isRemoving || isUploading;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={`hover:border-muted-foreground/40 group relative h-32 w-32 shrink-0 cursor-pointer overflow-visible rounded-xl border border-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${displayUrl ? 'bg-transparent' : 'bg-muted'}`}
          >
            {displayUrl ? (
              <Image
                src={displayUrl}
                alt="Profile photo"
                fill
                className="rounded-xl object-cover"
                unoptimized
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center">
                <Camera className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
              </span>
            )}

            {isUploading ? (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-[color:var(--overlay)]">
                <Loader2 className="h-7 w-7 animate-spin text-[color:var(--cream-white)]" />
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-transparent opacity-0 transition-all group-hover:bg-[color:var(--overlay)] group-hover:opacity-100">
                <Camera className="h-7 w-7 text-[color:var(--cream-white)]" />
              </div>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="right" className="w-36">
          <DropdownMenuItem disabled={isBusy} onSelect={() => fileInputRef.current?.click()}>
            <Pencil className="h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!displayUrl || isBusy}
            onSelect={() => {
              void handleRemovePhoto();
            }}
            className="text-destructive focus:text-destructive"
          >
            {isRemoving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFileChange}
      />

      <PhotoCropDialog
        imageSrc={cropSrc}
        open={isCropOpen}
        onConfirm={handleCropConfirm}
        onCancel={handleCropCancel}
        sourceType={cropSourceType}
      />
    </>
  );
};

export default ProfilePhoto;
