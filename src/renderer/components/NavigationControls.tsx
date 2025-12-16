import React from 'react';
import styles from './NavigationControls.module.css';

interface NavigationControlsProps {
  onPrevious: () => void;
  onNext: () => void;
  onSave: () => void;
  onReset: () => void;
  canGoPrevious: boolean;
  canGoNext: boolean;
  canSave: boolean;
  hasCropped: boolean;
}

const NavigationControls: React.FC<NavigationControlsProps> = ({
  onPrevious,
  onNext,
  onSave,
  onReset,
  canGoPrevious,
  canGoNext,
  canSave,
  hasCropped,
}) => {
  return (
    <div className={styles.controls}>
      <button
        className={`${styles.button} ${styles.prevButton}`}
        onClick={onPrevious}
        disabled={!canGoPrevious}
      >
        ← Previous
      </button>
      {hasCropped ? (
        <button
          className={`${styles.button} ${styles.resetButton}`}
          onClick={onReset}
        >
          Reset
        </button>
      ) : (
        <button
          className={`${styles.button} ${styles.saveButton}`}
          onClick={onSave}
          disabled={!canSave}
        >
          Save & Next
        </button>
      )}
      <button
        className={`${styles.button} ${styles.nextButton}`}
        onClick={onNext}
        disabled={!canGoNext}
      >
        Next →
      </button>
    </div>
  );
};

export default NavigationControls;


