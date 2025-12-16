// Type definitions for window.electronAPI exposed by preload script

export interface CropData {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SaveImageData {
  imagePath: string;
  destinationFolder: string;
  cropData: CropData;
  displayWidth: number;
  displayHeight: number;
}

export interface SaveCanvasData {
  imagePath: string;
  destinationFolder: string;
  imageData: string;
}

declare global {
  interface Window {
    electronAPI: {
      selectSourceFolder: () => Promise<string | null>;
      selectDestinationFolder: () => Promise<string | null>;
      getImages: (folderPath: string) => Promise<string[]>;
      saveCroppedImage: (data: SaveImageData) => Promise<{ success: boolean; path?: string; error?: string; needsCanvas?: boolean }>;
      saveImageFromCanvas: (data: SaveCanvasData) => Promise<{ success: boolean; path?: string; error?: string }>;
      createNewFolder: (parentFolder: string | null) => Promise<{ success: boolean; path?: string; error?: string }>;
      sendFolderName: (folderName: string | null) => void;
      sendFolderNameToChannel: (channel: string, folderName: string | null) => void;
      checkCroppedExists: (data: { imagePath: string; destinationFolder: string }) => Promise<{ exists: boolean; path: string | null }>;
      deleteCroppedImage: (data: { imagePath: string; destinationFolder: string }) => Promise<{ success: boolean; error?: string }>;
    };
  }
}

export {};

