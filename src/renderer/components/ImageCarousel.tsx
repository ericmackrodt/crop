import React, { useEffect, useRef } from "react";
import styles from "./ImageCarousel.module.css";

interface ImageCarouselProps {
  imagePaths: string[];
  currentIndex: number;
  onImageClick: (index: number) => void;
  croppedPaths: Map<string, string>;
}

const ImageCarousel: React.FC<ImageCarouselProps> = ({
  imagePaths,
  currentIndex,
  onImageClick,
  croppedPaths,
}) => {
  const carouselRef = useRef<HTMLDivElement>(null);
  const currentImageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentImageRef.current && carouselRef.current) {
      const carousel = carouselRef.current;
      const currentImage = currentImageRef.current;

      // Scroll to center the current image
      const carouselRect = carousel.getBoundingClientRect();
      const imageRect = currentImage.getBoundingClientRect();
      const scrollLeft =
        currentImage.offsetLeft - carouselRect.width / 2 + imageRect.width / 2;

      carousel.scrollTo({
        left: scrollLeft,
        behavior: "smooth",
      });
    }
  }, [currentIndex]);

  return (
    <div className={styles.carousel} ref={carouselRef}>
      <div className={styles.carouselContainer}>
        {imagePaths.map((imagePath, index) => {
          const isCurrent = index === currentIndex;
          // Normalize path for consistent matching
          const normalizedPath = imagePath.replace(/\\/g, '/');
          const croppedPath = croppedPaths.get(normalizedPath);
          // Remove cache-busting query parameter for display
          const displayPath = croppedPath ? croppedPath.split('?')[0] : imagePath;

          return (
            <div
              key={imagePath}
              ref={isCurrent ? currentImageRef : null}
              className={`${styles.imageWrapper} ${
                isCurrent ? styles.current : styles.other
              }`}
              onClick={() => onImageClick(index)}
            >
              <img
                key={`${imagePath}-${croppedPath || 'original'}-${croppedPath ? croppedPath.split('?t=')[1] || Date.now() : ''}`} // Force remount with timestamp when cropped version changes
                src={
                  displayPath.startsWith("file://")
                    ? displayPath
                    : `file://${encodeURI(displayPath.replace(/\\/g, "/"))}`
                }
                alt={`Image ${index + 1}`}
                className={styles.carouselImage}
                onError={(e) => {
                  console.error("Failed to load image:", displayPath);
                  const target = e.target as HTMLImageElement;
                  target.style.display = "none";
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ImageCarousel;
