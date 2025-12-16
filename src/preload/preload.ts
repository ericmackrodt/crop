import { contextBridge, ipcRenderer } from 'electron';

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

contextBridge.exposeInMainWorld('electronAPI', {
  selectSourceFolder: () => ipcRenderer.invoke('select-source-folder'),
  selectDestinationFolder: () => ipcRenderer.invoke('select-destination-folder'),
  getImages: (folderPath: string) => ipcRenderer.invoke('get-images-from-folder', folderPath),
  saveCroppedImage: (data: SaveImageData) => ipcRenderer.invoke('save-cropped-image', data),
  saveImageFromCanvas: (data: SaveCanvasData) => ipcRenderer.invoke('save-image-from-canvas', data),
  createNewFolder: (parentFolder: string | null) => ipcRenderer.invoke('create-new-folder', parentFolder),
  sendFolderName: (folderName: string | null) => ipcRenderer.send('folder-name-input', folderName),
  sendFolderNameToChannel: (channel: string, folderName: string | null) => ipcRenderer.send(channel, folderName),
  checkCroppedExists: (data: { imagePath: string; destinationFolder: string }) => ipcRenderer.invoke('check-cropped-exists', data),
  deleteCroppedImage: (data: { imagePath: string; destinationFolder: string }) => ipcRenderer.invoke('delete-cropped-image', data),
});

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

