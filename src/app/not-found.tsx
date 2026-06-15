import { BrandFallback } from '@/components/Common/Misc/BrandFallback';

export default function NotFound() {
  return (
    <BrandFallback
      description="The route you opened does not exist anymore. Return to the console and pick up from a known place."
      eyebrow="404"
      title="This page wandered off"
    />
  );
}
