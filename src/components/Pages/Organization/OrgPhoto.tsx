'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { Camera } from 'lucide-react';
import { toast } from 'sonner';

// `PhotoCropDialog` pulls in `react-easy-crop` and only renders
// after the user picks a file. Lazy-load it so it doesn't bloat
// every page that just shows the org avatar.
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

interface OrgPhotoProps {
  orgName: string;
  currentImage?: string | null;
  onFileSelect: (file: File) => void;
  previewUrl: string | null;
}

const OrgPhoto = ({ orgName, currentImage, onFileSelect, previewUrl }: OrgPhotoProps) => {
  const [savedPhotoUrl, setSavedPhotoUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Crop dialog state
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropSourceType, setCropSourceType] = useState<string | undefined>();
  const [isCropOpen, setIsCropOpen] = useState(false);

  useEffect(() => {
    if (currentImage) {
      resolvePhotoUrl(currentImage)
        .then(setSavedPhotoUrl)
        .catch(() => setSavedPhotoUrl(currentImage));
    }
  }, [currentImage]);

  const displayUrl = previewUrl ?? savedPhotoUrl;

  const initials = orgName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');

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
        className={`hover:border-muted-foreground/40 group relative h-32 w-32 shrink-0 cursor-pointer overflow-hidden rounded-full border border-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${displayUrl ? 'bg-transparent' : 'bg-muted'}`}
      >
        {displayUrl ? (
          <Image
            src={displayUrl}
            alt="Organization photo"
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <span className="text-h1 flex h-full w-full items-center justify-center text-muted-foreground">
            {initials || '?'}
          </span>
        )}

        <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
          <Camera className="h-7 w-7 text-white" />
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

export default OrgPhoto;
