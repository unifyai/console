'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

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
  orgId: number;
  orgName: string;
  currentImage?: string | null;
}

const OrgPhoto = ({ orgId, orgName, currentImage }: OrgPhotoProps) => {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentImage) {
      resolvePhotoUrl(currentImage)
        .then(setPhotoUrl)
        .catch(() => setPhotoUrl(currentImage));
    }
  }, [currentImage]);

  const initials = orgName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
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

      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch(`/api/organization/photo/upload?orgId=${orgId}`, {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || 'Upload failed');
        }

        const data = await res.json();
        const url = await resolvePhotoUrl(data.gcs_url);
        setPhotoUrl(url);
        toast.success('Organization photo updated.');
      } catch (err: any) {
        toast.error(err.message || 'Failed to upload photo.');
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [orgId]
  );

  return (
    <>
      <button
        type="button"
        disabled={isUploading}
        onClick={() => fileInputRef.current?.click()}
        className="hover:border-muted-foreground/40 group relative h-32 w-32 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-border bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait"
      >
        {photoUrl ? (
          <Image
            src={photoUrl}
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

        {isUploading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Loader2 className="h-7 w-7 animate-spin text-white" />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
            <Camera className="h-7 w-7 text-white" />
          </div>
        )}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFileSelect}
      />
    </>
  );
};

export default OrgPhoto;
