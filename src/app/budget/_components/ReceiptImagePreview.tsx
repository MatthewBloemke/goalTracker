'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import RotateLeftRounded from '@mui/icons-material/RotateLeftRounded';
import RotateRightRounded from '@mui/icons-material/RotateRightRounded';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { prepareReceiptImage } from '../_lib/receipt-image';
import type { PreparedReceiptImage } from '../_lib/receipt';

export function ReceiptImagePreview({
  file,
  onAnalyze,
  onCancel,
}: {
  file: File;
  onAnalyze: (image: PreparedReceiptImage) => void;
  onCancel: () => void;
}) {
  const [quarterTurns, setQuarterTurns] = useState(0);
  const [preview, setPreview] = useState<{
    file: File;
    quarterTurns: number;
    image?: PreparedReceiptImage;
    error?: string;
  } | null>(null);
  const currentPreview = preview?.file === file
    && preview.quarterTurns === quarterTurns ? preview : null;

  useEffect(() => {
    let active = true;
    prepareReceiptImage(file, quarterTurns).then(
      (image) => {
        if (active) setPreview({ file, quarterTurns, image });
      },
      (error: unknown) => {
        if (active) setPreview({
          file,
          quarterTurns,
          error: error instanceof Error ? error.message : 'This photo could not be opened.',
        });
      },
    );
    return () => { active = false; };
  }, [file, quarterTurns]);

  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-(--border) pt-3">
      <p className="text-sm font-medium text-(--text-primary)">
        Check the photo before scanning
      </p>
      <p className="text-xs text-(--text-secondary)">
        Turn the receipt upright so the merchant and total are readable.
      </p>
      {!currentPreview && (
        <div className="flex h-48 items-center justify-center" role="status">
          <CircularProgress size={24} aria-label="Preparing receipt photo" />
        </div>
      )}
      {currentPreview?.error && (
        <Alert severity="error">{currentPreview.error}</Alert>
      )}
      {currentPreview?.image && (
        <Image
          src={`data:${currentPreview.image.mimeType};base64,${currentPreview.image.data}`}
          width={currentPreview.image.width}
          height={currentPreview.image.height}
          unoptimized
          alt="Receipt photo to be analyzed"
          style={{ width: '100%', height: 'auto', maxHeight: 400, objectFit: 'contain' }}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <IconButton
            aria-label="Rotate receipt left"
            onClick={() => setQuarterTurns((turns) => (turns + 3) % 4)}
          >
            <RotateLeftRounded />
          </IconButton>
          <IconButton
            aria-label="Rotate receipt right"
            onClick={() => setQuarterTurns((turns) => (turns + 1) % 4)}
          >
            <RotateRightRounded />
          </IconButton>
        </div>
        <div className="flex gap-2">
          <SecondaryButton type="button" size="small" onClick={onCancel}>
            Cancel photo
          </SecondaryButton>
          <PrimaryButton
            type="button"
            size="small"
            disabled={!currentPreview?.image}
            onClick={() => {
              if (currentPreview?.image) onAnalyze(currentPreview.image);
            }}
          >
            Analyze photo
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
