const LoadingElement = ({ height = 150, width = 150 }: { height?: number; width?: number }) => {
  return (
    <div className="flex flex-col gap-6 py-10">
      <object
        type="image/svg+xml"
        data="/icons/unify-loading.svg"
        height={height}
        width={width}
        className="bg-transparent"
      />
    </div>
  );
};

export default LoadingElement;
