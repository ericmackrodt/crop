import { useState, useEffect } from "react";
import ImageCarousel from "./components/ImageCarousel";
import CropViewer from "./components/CropViewer";
import NavigationControls from "./components/NavigationControls";
import styles from "./styles/App.module.css";

export interface CropData {
  x: number;
  y: number;
  width: number;
  height: number;
}

function App() {
  const [sourceFolder, setSourceFolder] = useState<string | null>(null);
  const [destinationFolder, setDestinationFolder] = useState<string | null>(
    null
  );
  const [imagePaths, setImagePaths] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cropData, setCropData] = useState<CropData | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [croppedPaths, setCroppedPaths] = useState<Map<string, string>>(
    new Map()
  );

  const handleSelectSourceFolder = async () => {
    const folder = await window.electronAPI.selectSourceFolder();
    if (folder) {
      setSourceFolder(folder);
      const images = await window.electronAPI.getImages(folder);
      setImagePaths(images);
      setCurrentIndex(0);
      setCropData(null);
    }
  };

  const handleSelectDestinationFolder = async () => {
    const folder = await window.electronAPI.selectDestinationFolder();
    if (folder) {
      setDestinationFolder(folder);
      // Always check for existing cropped images if we have image paths
      // This will be called again by useEffect, but calling it here ensures
      // it happens immediately even if useEffect hasn't run yet
      if (imagePaths.length > 0) {
        await checkAllCroppedImages(folder);
      }
    }
  };

  const checkAllCroppedImages = async (destFolder: string) => {
    if (!destFolder || imagePaths.length === 0) {
      return;
    }

    console.log(
      "checkAllCroppedImages: Starting check for",
      imagePaths.length,
      "images"
    );
    const newCroppedPaths = new Map<string, string>();
    for (const imagePath of imagePaths) {
      // Normalize path for consistent matching - use the original path format
      // but normalize for the Map key
      const normalizedPath = imagePath.replace(/\\/g, "/");
      const result = await window.electronAPI.checkCroppedExists({
        imagePath: imagePath, // Send original path to backend
        destinationFolder: destFolder,
      });
      console.log(
        "checkAllCroppedImages: Checked",
        imagePath,
        "- exists:",
        result.exists,
        "path:",
        result.path
      );
      if (result.exists && result.path) {
        // Use normalized path as key for consistent lookup
        newCroppedPaths.set(normalizedPath, result.path);
      }
    }
    console.log(
      "checkAllCroppedImages: Found",
      newCroppedPaths.size,
      "cropped images. Map keys:",
      Array.from(newCroppedPaths.keys())
    );
    // Create a completely new Map to ensure React detects the change
    setCroppedPaths(() => {
      const newMap = new Map(newCroppedPaths);
      console.log(
        "checkAllCroppedImages: Setting new croppedPaths map with",
        newMap.size,
        "entries"
      );
      return newMap;
    });
    // Force image reload after updating cropped paths
    setImageLoaded(false);
  };

  const checkCurrentCroppedImage = async (imagePath: string) => {
    if (!destinationFolder || !imagePath) return;

    // Normalize path for consistent matching
    const normalizedPath = imagePath.replace(/\\/g, "/");
    const result = await window.electronAPI.checkCroppedExists({
      imagePath: normalizedPath,
      destinationFolder,
    });

    if (result.exists && result.path) {
      setCroppedPaths((prev) => {
        const newMap = new Map(prev);
        newMap.set(normalizedPath, result.path!);
        return newMap;
      });
    } else {
      setCroppedPaths((prev) => {
        const newMap = new Map(prev);
        newMap.delete(normalizedPath);
        return newMap;
      });
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setCropData(null);
      setImageLoaded(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < imagePaths.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setCropData(null);
      setImageLoaded(false);
    }
  };

  const currentImagePath = imagePaths[currentIndex] || null;
  const normalizedCurrentImagePath = currentImagePath
    ? currentImagePath.replace(/\\/g, "/")
    : null;

  const handleReset = async () => {
    if (!destinationFolder || !normalizedCurrentImagePath) {
      return;
    }

    const result = await window.electronAPI.deleteCroppedImage({
      imagePath: normalizedCurrentImagePath,
      destinationFolder,
    });

    if (result.success) {
      // Remove from cropped paths map using normalized path
      setCroppedPaths((prev) => {
        const newMap = new Map(prev);
        newMap.delete(normalizedCurrentImagePath);
        console.log(
          "handleReset: Removed cropped path, Map size now:",
          newMap.size
        );
        return newMap;
      });
      setCropData(null);
      setImageLoaded(false);
      // Force a re-check to ensure state is updated and confirm file is deleted
      await checkCurrentCroppedImage(normalizedCurrentImagePath);
    } else {
      console.error("Error deleting cropped image:", result.error);
    }
  };

  const handleSave = async () => {
    if (
      !cropData ||
      !destinationFolder ||
      !imageDimensions ||
      !currentImagePath
    ) {
      return;
    }

    try {
      // Use canvas to crop the image
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const img = new Image();
      img.src = `file://${encodeURI(currentImagePath.replace(/\\/g, "/"))}`;

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          try {
            // Scale crop coordinates from display size to actual image size
            const scaleX = img.naturalWidth / imageDimensions.width;
            const scaleY = img.naturalHeight / imageDimensions.height;

            const actualX = cropData.x * scaleX;
            const actualY = cropData.y * scaleY;
            const actualWidth = cropData.width * scaleX;
            const actualHeight = cropData.height * scaleY;

            canvas.width = actualWidth;
            canvas.height = actualHeight;

            ctx.drawImage(
              img,
              actualX,
              actualY,
              actualWidth,
              actualHeight,
              0,
              0,
              actualWidth,
              actualHeight
            );

            // Get the original file extension to preserve format
            const ext =
              currentImagePath.split(".").pop()?.toLowerCase() || "png";
            const mimeType =
              ext === "jpg" || ext === "jpeg"
                ? "image/jpeg"
                : ext === "png"
                ? "image/png"
                : ext === "webp"
                ? "image/webp"
                : "image/png";

            const dataUrl = canvas.toDataURL(mimeType);
            window.electronAPI
              .saveImageFromCanvas({
                imagePath: currentImagePath,
                destinationFolder,
                imageData: dataUrl,
              })
              .then(async (saveResult) => {
                if (saveResult.success && saveResult.path) {
                  // Normalize path for consistent matching
                  const normalizedPath = currentImagePath.replace(/\\/g, "/");
                  // Generate a fresh timestamp to ensure cache busting and force remount
                  // Use a small delay to ensure file is fully written
                  await new Promise((resolve) => setTimeout(resolve, 100));
                  const timestamp = Date.now();
                  const croppedPathWithCacheBust = `${saveResult.path}?t=${timestamp}`;
                  console.log(
                    "handleSave: Saving cropped image with timestamp:",
                    timestamp
                  );
                  // Update state - this will trigger a re-render with new key
                  setCroppedPaths((prev) => {
                    const newMap = new Map(prev);
                    newMap.set(normalizedPath, croppedPathWithCacheBust);
                    console.log(
                      "handleSave: Updated croppedPaths, Map size:",
                      newMap.size
                    );
                    return newMap;
                  });
                  // Force image reload by clearing loaded state
                  setImageLoaded(false);
                  setCropData(null);
                  // Don't automatically move to next - let user see the cropped version
                } else {
                  console.error("Error saving image:", saveResult.error);
                }
                resolve();
              })
              .catch(reject);
          } catch (error) {
            reject(error);
          }
        };

        img.onerror = () => {
          reject(new Error("Failed to load image"));
        };
      });
    } catch (error) {
      console.error("Error saving image:", error);
    }
  };

  const currentCroppedPath = normalizedCurrentImagePath
    ? croppedPaths.get(normalizedCurrentImagePath)
    : null;
  // Keep the full path with cache-busting query parameter
  // The timestamp in the key will force remount, and the query param helps with cache busting
  const displayImagePath = currentCroppedPath || currentImagePath || "";
  const hasCropped = !!currentCroppedPath;

  // Debug: Log current state
  useEffect(() => {
    if (currentImagePath) {
      console.log("Current image state:", {
        currentImagePath,
        normalizedCurrentImagePath,
        currentCroppedPath,
        displayImagePath,
        hasCropped,
        croppedPathsSize: croppedPaths.size,
        croppedPathsKeys: Array.from(croppedPaths.keys()),
      });
    }
  }, [
    currentImagePath,
    normalizedCurrentImagePath,
    currentCroppedPath,
    displayImagePath,
    hasCropped,
    croppedPaths,
  ]);
  // Force remount when cropped path changes for current image
  // Include timestamp from cache-busting query param to force reload
  const croppedTimestamp = currentCroppedPath
    ? currentCroppedPath.split("?t=")[1] || ""
    : "";
  const imageKey = `${normalizedCurrentImagePath}-${
    currentCroppedPath ? `cropped-${croppedTimestamp}` : "original"
  }`;

  // Check for cropped image when current image or destination changes
  useEffect(() => {
    if (destinationFolder && normalizedCurrentImagePath) {
      checkCurrentCroppedImage(normalizedCurrentImagePath);
    }
  }, [normalizedCurrentImagePath, destinationFolder]);

  // Check all cropped images when destination folder is set or image paths change
  useEffect(() => {
    if (destinationFolder && imagePaths.length > 0) {
      console.log(
        "useEffect: Triggering checkAllCroppedImages for destination:",
        destinationFolder
      );
      checkAllCroppedImages(destinationFolder).catch((error) => {
        console.error("Error in checkAllCroppedImages:", error);
      });
    }
  }, [destinationFolder, imagePaths.length]);

  return (
    <div className={styles.app}>
      <div className={styles.header}>
        <button
          onClick={handleSelectSourceFolder}
          className={styles.folderButton}
        >
          {sourceFolder
            ? `Source: ${sourceFolder.split("/").pop()}`
            : "Select Source Folder"}
        </button>
        <button
          onClick={handleSelectDestinationFolder}
          className={styles.folderButton}
        >
          {destinationFolder
            ? `Dest: ${destinationFolder.split("/").pop()}`
            : "Select Destination Folder"}
        </button>
      </div>

      {currentImagePath && (
        <>
          <div className={styles.carouselSection}>
            <ImageCarousel
              imagePaths={imagePaths}
              currentIndex={currentIndex}
              onImageClick={(index) => setCurrentIndex(index)}
              croppedPaths={croppedPaths}
            />
          </div>

          <div className={styles.cropSection}>
            <CropViewer
              key={imageKey}
              imagePath={displayImagePath}
              cropData={hasCropped ? null : cropData}
              onCropChange={hasCropped ? () => {} : setCropData}
              onImageLoad={(dimensions) => {
                setImageDimensions(dimensions);
                setImageLoaded(true);
              }}
              disabled={hasCropped}
            />
          </div>

          <div className={styles.controlsSection}>
            <NavigationControls
              onPrevious={handlePrevious}
              onNext={handleNext}
              onSave={handleSave}
              onReset={handleReset}
              canGoPrevious={currentIndex > 0}
              canGoNext={currentIndex < imagePaths.length - 1}
              canSave={
                !!(cropData && destinationFolder && imageLoaded && !hasCropped)
              }
              hasCropped={hasCropped}
            />
          </div>
        </>
      )}
    </div>
  );
}

export default App;
