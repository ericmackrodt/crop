import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

let mainWindow: BrowserWindow | null = null;

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Allow loading local files
    },
  });

  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
    
    // Disable cache in development
    mainWindow.webContents.session.clearCache();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('select-source-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Select folder with images',
  });

  if (result.canceled) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle('select-destination-folder', async () => {
  // On macOS, openDirectory with createDirectory shows a "New Folder" button
  // On Windows/Linux, users can right-click to create folders
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select or create destination folder',
    buttonLabel: 'Select',
  });

  if (result.canceled) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle('create-new-folder', async (_event, parentFolder: string | null) => {
  try {
    // If no parent folder is selected, first ask for a parent folder
    let parentPath = parentFolder;
    
    if (!parentPath) {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Select parent folder for new folder',
      });
      
      if (result.canceled) {
        return { success: false, error: 'No parent folder selected' };
      }
      
      parentPath = result.filePaths[0];
    }

    // Prompt for folder name using a simple input dialog
    let finalFolderName: string | null = null;
    {
      // Create a simple input dialog window
      const inputWindow = new BrowserWindow({
        width: 400,
        height: 180,
        parent: mainWindow ?? undefined,
        modal: true,
        resizable: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: path.join(__dirname, '../preload/preload.js'),
        },
      });

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>Create New Folder</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                padding: 20px;
                background: #1a1a1a;
                color: #fff;
                margin: 0;
              }
              label {
                display: block;
                margin-bottom: 8px;
                font-size: 14px;
              }
              input {
                width: calc(100% - 16px);
                padding: 8px;
                font-size: 14px;
                border: 1px solid #444;
                border-radius: 4px;
                background: #2a2a2a;
                color: #fff;
                box-sizing: border-box;
              }
              input:focus {
                outline: none;
                border-color: #4a9eff;
              }
              .buttons {
                display: flex;
                gap: 10px;
                margin-top: 20px;
                justify-content: flex-end;
              }
              button {
                padding: 8px 16px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
              }
              .cancel {
                background: #444;
                color: #fff;
              }
              .create {
                background: #4a9eff;
                color: #fff;
              }
              button:hover {
                opacity: 0.9;
              }
            </style>
          </head>
          <body>
            <label for="folderName">Enter folder name:</label>
            <input type="text" id="folderName" autofocus />
            <div class="buttons">
              <button class="cancel" id="cancelBtn">Cancel</button>
              <button class="create" id="createBtn">Create</button>
            </div>
            <script>
              const input = document.getElementById('folderName');
              const cancelBtn = document.getElementById('cancelBtn');
              const createBtn = document.getElementById('createBtn');
              
              input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                  createBtn.click();
                } else if (e.key === 'Escape') {
                  cancelBtn.click();
                }
              });
              
              cancelBtn.addEventListener('click', () => {
                window.electronAPI.sendFolderName(null);
              });
              
              createBtn.addEventListener('click', () => {
                const value = input.value.trim();
                window.electronAPI.sendFolderName(value || null);
              });
              
              input.focus();
            </script>
          </body>
        </html>
      `;

      // Wait for user input via IPC
      const channel = `folder-name-input-${Date.now()}-${Math.random()}`;
      
      // Update HTML to use the specific channel before loading
      const htmlWithChannel = htmlContent.replace(
        /window\.electronAPI\.sendFolderName\(/g,
        `window.electronAPI.sendFolderNameToChannel('${channel}',`
      );

      inputWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlWithChannel)}`);

      finalFolderName = await new Promise<string | null>((resolve) => {
        const handler = (_event: Electron.IpcMainEvent, ...args: any[]) => {
          const name = args[0] as string | null | undefined;
          ipcMain.removeListener(channel, handler);
          inputWindow.close();
          resolve(name ?? null);
        };
        ipcMain.on(channel, handler);

        inputWindow.on('closed', () => {
          ipcMain.removeListener(channel, handler);
          resolve(null);
        });
      });

      if (!finalFolderName) {
        return { success: false, error: 'Folder creation cancelled' };
      }
    }

    if (!finalFolderName.trim()) {
      return { success: false, error: 'Folder name cannot be empty' };
    }

    // Create the folder
    const newFolderPath = path.join(parentPath, finalFolderName.trim());
    
    if (fs.existsSync(newFolderPath)) {
      return { success: false, error: 'Folder already exists' };
    }

    fs.mkdirSync(newFolderPath, { recursive: true });
    return { success: true, path: newFolderPath };
  } catch (error) {
    console.error('Error creating folder:', error);
    return { success: false, error: String(error) };
  }
});


ipcMain.handle('get-images-from-folder', async (_event, folderPath: string) => {
  try {
    const files = fs.readdirSync(folderPath);
    const imageFiles = files
      .filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return IMAGE_EXTENSIONS.includes(ext);
      })
      .map((file) => path.join(folderPath, file));

    return imageFiles;
  } catch (error) {
    console.error('Error reading folder:', error);
    return [];
  }
});

ipcMain.handle('save-cropped-image', async (_event, data: {
  imagePath: string;
  destinationFolder: string;
  cropData: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  displayWidth: number;
  displayHeight: number;
}) => {
  // Always use canvas approach in renderer process
  // This handler is kept for API consistency but always returns needsCanvas
  return { success: false, needsCanvas: true };
});

ipcMain.handle('save-image-from-canvas', async (_event, data: {
  imagePath: string;
  destinationFolder: string;
  imageData: string; // base64 data URL
}) => {
  try {
    const { imagePath, destinationFolder, imageData } = data;
    
    // Extract base64 data
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    const originalName = path.basename(imagePath);
    const ext = path.extname(originalName);
    const nameWithoutExt = path.basename(originalName, ext);
    const outputPath = path.join(destinationFolder, `${nameWithoutExt}_cropped${ext}`);
    
    fs.writeFileSync(outputPath, buffer);
    return { success: true, path: outputPath };
  } catch (error) {
    console.error('Error saving image from canvas:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('check-cropped-exists', async (_event, data: {
  imagePath: string;
  destinationFolder: string;
}) => {
  try {
    const { imagePath, destinationFolder } = data;
    const originalName = path.basename(imagePath);
    const ext = path.extname(originalName);
    const nameWithoutExt = path.basename(originalName, ext);
    const croppedPath = path.join(destinationFolder, `${nameWithoutExt}_cropped${ext}`);
    
    const exists = fs.existsSync(croppedPath);
    return { exists, path: exists ? croppedPath : null };
  } catch (error) {
    console.error('Error checking cropped image:', error);
    return { exists: false, path: null };
  }
});

ipcMain.handle('delete-cropped-image', async (_event, data: {
  imagePath: string;
  destinationFolder: string;
}) => {
  try {
    const { imagePath, destinationFolder } = data;
    const originalName = path.basename(imagePath);
    const ext = path.extname(originalName);
    const nameWithoutExt = path.basename(originalName, ext);
    const croppedPath = path.join(destinationFolder, `${nameWithoutExt}_cropped${ext}`);
    
    if (fs.existsSync(croppedPath)) {
      fs.unlinkSync(croppedPath);
      return { success: true };
    }
    return { success: false, error: 'Cropped image not found' };
  } catch (error) {
    console.error('Error deleting cropped image:', error);
    return { success: false, error: String(error) };
  }
});

