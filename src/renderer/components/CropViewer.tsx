import React, { useState, useEffect } from "react";
import { Crop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import ReactCrop from "react-image-crop";
import styles from "./CropViewer.module.css";

export interface CropData {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CropViewerProps {
  imagePath: string;
  cropData: CropData | null;
  onCropChange: (crop: CropData | null) => void;
  onImageLoad: (dimensions: { width: number; height: number }) => void;
  disabled?: boolean;
}

const CropViewer: React.FC<CropViewerProps> = ({
  imagePath,
  onCropChange,
  onImageLoad,
  disabled = false,
}) => {
  const [crop, setCrop] = useState<Crop>();

  useEffect(() => {
    // Reset crop when image changes
    setCrop(undefined);
    onCropChange(null);
  }, [imagePath, onCropChange]);

  const handleImageLoaded = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    onImageLoad({ width: img.width, height: img.height });

    // Only set initial crop if not disabled
    if (!disabled) {
      // Set initial crop to center 80% of image
      const initialCrop: Crop = {
        unit: "px",
        x: img.width * 0.1,
        y: img.height * 0.1,
        width: img.width * 0.8,
        height: img.height * 0.8,
      };
      setCrop(initialCrop);

      const cropData: CropData = {
        x: initialCrop.x,
        y: initialCrop.y,
        width: initialCrop.width,
        height: initialCrop.height,
      };
      onCropChange(cropData);
    }
  };

  const handleCropChange = (newCrop: Crop) => {
    setCrop(newCrop);
  };

  const handleCropComplete = (completed: Crop) => {
    if (completed.width && completed.height) {
      const cropData: CropData = {
        x: completed.x || 0,
        y: completed.y || 0,
        width: completed.width,
        height: completed.height,
      };
      onCropChange(cropData);
    }
  };

  return (
    <div className={styles.cropViewer}>
      <ReactCrop
        crop={disabled ? undefined : crop}
        onChange={disabled ? () => {} : handleCropChange}
        onComplete={disabled ? () => {} : handleCropComplete}
        aspect={undefined}
        minWidth={50}
        minHeight={50}
        disabled={disabled}
      >
        <img
          key={imagePath} // Use imagePath as key - it includes cache-busting query param
          src={
            imagePath.startsWith("file://")
              ? imagePath // Keep query params for cache busting
              : `file://${encodeURI(imagePath.replace(/\\/g, "/"))}`
          }
          alt="Crop"
          onLoad={handleImageLoaded}
          className={styles.cropImage}
          style={{ maxHeight: "calc(100vh - 400px)", maxWidth: "100%" }}
          onError={(e) => {
            console.error("Failed to load image:", imagePath);
            const target = e.target as HTMLImageElement;
            target.style.border = "2px solid red";
            target.alt = "Failed to load image";
          }}
        />
      </ReactCrop>
    </div>
  );
};

export default CropViewer;
