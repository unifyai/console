import React from "react"
import { Span } from "@/types/evals/traces"

export const MatrixDisplay = ({value}:{value: number[][]}) => {
    return (
    <p className="font-normal whitespace-pre-wrap px-3">
        <code className="font-mono">
          {value.map((row, rowIndex) => (
            <React.Fragment key={rowIndex}>
              {row.map((number, numberIndex) => (
                <React.Fragment key={numberIndex}>
                  {number.toString().padStart(2, ' ')}{numberIndex < row.length - 1 ? ', ' : ''}
                </React.Fragment>
              ))}
              {rowIndex < value.length - 1 ? '\n' : ''}
            </React.Fragment>
          ))}
        </code>
    </p>
    )
}

export const ImageDisplay = ({value, className}: {value: string, className?: string}) => {
  const url = isBase64Image(value) ? `data:image/png;base64,${value}` : value;
  return <img src={url} className={className}/>;
}

export const isDict = (value: any) => typeof value === "object" && !Array.isArray(value) && !(value instanceof RegExp) && !(value instanceof Date) && !(value instanceof Function) && value != null;
export const isList = (value: any) => Array.isArray(value);
export const isMatrix = (value: any) => isList(value) && value.every(row => Array.isArray(row) && row.every(number => typeof number === "number"));

export const isURLImage = (value: string) => {
  /* Check if URL image string 
     Example value: "https://oaidalleapiprodscus.blob.core.windows.net/private/org-D1OIs5ffDVTBSBpNWJyXxFfN/user-vlZW2XKHDiNPzwT4Xv6wlzgv/img-9mgiKpSrAV1p1iqZ9C0Nw2iq.png?st=2024-11-20T11%3A18%3A20Z&se=2024-11-20T13%3A18%3A20Z&sp=r&sv=2024-08-04&sr=b&rscd=inline&rsct=image/png&skoid=d505667d-d6c1-4a0a-bac7-5c84a87759f8&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2024-11-20T00%3A40%3A43Z&ske=2024-11-21T00%3A40%3A43Z&sks=b&skv=2024-08-04&sig=9aNFotmijRyhe8JwkzMGX5WZWGxLIPSSXx6nigR02Y4%3D"
  */
  try {
    const url = new URL(value);
    const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'svg', 'webp'].map(type => `image${type}`);
    if (imageTypes.map(imageType => url.pathname.includes(imageType)).some(check => check)) return true;
  } catch (e) {
    return false
  }
}
export const isBase64Image = (value: string) => {
  /* Check if it's a Base64 image 
     Example value: "iVBORw0KGgoAAAANSUhEUgAABAAAAAQACAIAAADwf7zUAAA552NhQlgAADnnanVtYgAAAB5qdW1kYzJwYQARABCAAACqADibcQNjMnBhAAAAOcFqdW1iAAAAR2p1bWRjMm1hABEAEIAAAKoAOJtxA3Vybjp1dWlkOjE1ZDQ0YjJlLTUxMGUtNGUyMC1iMWJiLTJhNDA2NTMyOWFlMAAAAAGhanVtYgAAAClqdW1kYzJhcwARABCAAACqADibcQNjMnBhLmFzc2VydGlvbnMAAAAAxWp1bWIAAAAmanVtZGNib3IAEQAQgAAAqgA4m3EDYzJwYS5hY3Rpb25zAAAAAJdjYm9yoWdhY3Rpb25zgaNmYWN0aW9ubGMycGEuY3JlYXRlZG1zb2Z0d2FyZUFnZW50Z0RBTEzCt0VxZGlnaXRhbFNvdXJjZVR5cGV4Rmh0dHA6Ly9jdi5pcHRjLm9yZy9uZXdzY29kZXMvZGlnaXRhbHNvdXJ...."
  */
  try {
    const decoded = atob(value);
    return decoded.includes('\x89\x50\x4E\x47') || decoded.includes('\xFF\xD8\xFF'); // Checks for PNG and JPEG headers
  } catch (e) {
    return false;
  }
}
export const isImage = (value: any) => {
  if (typeof value !== "string") return false;
  return isBase64Image(value) || isURLImage(value);
}

/**
   * Quick type‐guard to see if an unknown object looks like a Span.
   * Returns true if the shape seems correct.
   */
  export function isSpan(obj: any): obj is Span {
    return (
      obj &&
      typeof obj === "object" &&
      typeof obj.id === "string" &&
      typeof obj.span_name === "string" &&
      Array.isArray(obj.child_spans)
    );
  }