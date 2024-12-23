import React from "react";
import { ImageDisplay } from "@/utils/evals/selection";
import { LogComparisonProps } from "./types";

const ImageView: React.FC<LogComparisonProps> = ({
  value,
  comparables,
  baseLogIndex,
  comparisonLogsIndex
}) => {
  // Combine original image(s) and comparables into a single array
  const allImages = [value, ...(comparables ?? [])];
  // Combine indices similarly
  const allIndices = [baseLogIndex, ...(comparisonLogsIndex ?? [])];

  // A small helper to check if an item is a valid string URL/path
  const isValidImage = (img: unknown): boolean => typeof img === "string";

  // If there are no images or all are invalid, show an error
  if (allImages.length === 0 || allImages.every((img) => !isValidImage(img))) {
    return <p className="text-destructive">No valid images to display</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {allImages.map((img, idx) => (
        <div key={idx} className="border p-2 rounded bg-background">
          <h4 className="font-bold mb-2">
            Image from Row {allIndices[idx] ?? "N/A"}
          </h4>
          {isValidImage(img) ? (
            <ImageDisplay value={img as string} />
          ) : (
            <p className="text-sm text-destructive">Not a valid image</p>
          )}
        </div>
      ))}
    </div>
  );
};

export default ImageView;