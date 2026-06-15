'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { Camera } from 'lucide-react';
import { toast } from 'sonner';
import { User } from '@/types/user';
import { TeammateCreature } from '@/components/Brand';

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
  onFileSelect: (file: File) => void;
  previewUrl: string | null;
}

const ProfilePhoto = ({ user, onFileSelect, previewUrl }: ProfilePhotoProps) => {
  const [savedPhotoUrl, setSavedPhotoUrl] = useState<string | null>(null);
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
    }
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
    (croppedFile: File) => {
      setIsCropOpen(false);
      if (cropSrc) URL.revokeObjectURL(cropSrc);
      setCropSrc(null);
      setCropSourceType(undefined);
      onFileSelect(croppedFile);
    },
    [cropSrc, onFileSelect]
  );

  const handleCropCancel = useCallback(() => {
    setIsCropOpen(false);
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    setCropSourceType(undefined);
  }, [cropSrc]);

  return (
    <>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className={`hover:border-muted-foreground/40 group relative h-32 w-32 shrink-0 cursor-pointer overflow-visible rounded-xl border border-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${displayUrl ? 'bg-transparent' : 'bg-card'}`}
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
            <TeammateCreature className="h-24 w-24" label="Default profile photo" />
          </span>
        )}

        <div className="absolute inset-0 flex items-center justify-center bg-transparent opacity-0 transition-all group-hover:bg-[color:var(--overlay)] group-hover:opacity-100">
          <Camera className="h-7 w-7 text-[color:var(--cream-white)]" />
        </div>
      </button>

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
