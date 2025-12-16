import React from 'react';
import styles from './FolderSelector.module.css';

interface FolderSelectorProps {
  destinationFolder: string | null;
  onSelectFolder: () => void;
  onCreateNewFolder: (parentFolder: string | null) => Promise<void>;
}

const FolderSelector: React.FC<FolderSelectorProps> = ({
  destinationFolder,
  onSelectFolder,
  onCreateNewFolder,
}) => {
  const handleCreateNewFolder = async () => {
    await onCreateNewFolder(destinationFolder);
  };

  return (
    <div className={styles.folderSelector}>
      <label className={styles.label}>Destination Folder:</label>
      <div className={styles.folderInfo}>
        <span className={styles.folderPath}>
          {destinationFolder || 'No folder selected'}
        </span>
        <button onClick={handleCreateNewFolder} className={styles.createButton}>
          Create New Folder
        </button>
        <button onClick={onSelectFolder} className={styles.selectButton}>
          {destinationFolder ? 'Change Folder' : 'Select Folder'}
        </button>
      </div>
    </div>
  );
};

export default FolderSelector;

