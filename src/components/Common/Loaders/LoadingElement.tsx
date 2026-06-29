import { BrandLoader } from '@unity/brand/components';

const LoadingElement = ({ height = 150, width = 150 }: { height?: number; width?: number }) => {
  return (
    <div className="flex flex-col gap-6 py-10">
      <BrandLoader size={Math.min(height, width)} />
    </div>
  );
};

export default LoadingElement;
