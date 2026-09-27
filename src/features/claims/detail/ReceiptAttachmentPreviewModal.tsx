import { useState, useEffect } from 'react';
import { Modal } from '../../../components/shared/Modal';
import { Button } from '../../../components/ui/Button';
import { uploadUrl } from '../../../lib/api';

interface ReceiptAttachmentPreviewModalProps {
  url: string | null;
  fileName?: string;
  fileType?: string;
  pdfOnly?: boolean;
  onClose: () => void;
}

export function ReceiptAttachmentPreviewModal({
  url,
  fileName,
  fileType,
  pdfOnly = false,
  onClose,
}: ReceiptAttachmentPreviewModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const previewUrl = uploadUrl(url ?? undefined) ?? '';

  useEffect(() => {
    if (url) {
      setIsLoading(true);
      setHasError(false);
    }
  }, [url]);

  useEffect(() => {
    if (!url || !pdfOnly) {
      setPdfBlobUrl(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    setPdfBlobUrl(null);
    setIsLoading(true);
    setHasError(false);

    fetch(previewUrl)
      .then(async response => {
        const contentType = response.headers.get('content-type')?.toLowerCase() || '';
        if (!response.ok || !contentType.includes('application/pdf')) {
          throw new Error('Receipt is unavailable or is not a PDF.');
        }
        return response.blob();
      })
      .then(blob => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPdfBlobUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) {
          setIsLoading(false);
          setHasError(true);
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [pdfOnly, previewUrl, url]);

  if (!url) return null;

  const cleanUrl = url.split('?')[0].split('#')[0];
  const detectedExt = (fileName || cleanUrl).split('.').pop()?.toLowerCase();

  const isPdf =
    fileType === 'application/pdf' ||
    detectedExt === 'pdf' ||
    /\.pdf($|\?)/i.test(url);

  const isImage =
    !isPdf &&
    (fileType?.startsWith('image/') ||
      ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(detectedExt || '') ||
      /\.(jpeg|jpg|gif|png|webp|svg)($|\?)/i.test(url) ||
      url.startsWith('data:image/') ||
      (url.startsWith('blob:') && !isPdf));

  const displayName = fileName || 'Receipt Attachment';

  return (
    <Modal
      isOpen
      onClose={onClose}
      titleId="receipt-attachment-preview-title"
      className="max-w-4xl"
    >
      <div className="bg-surface-container-lowest rounded-xl w-full p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-outline-variant pb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3
                id="receipt-attachment-preview-title"
                className="font-headline-sm text-on-surface truncate"
              >
                Receipt Preview
              </h3>
              {isPdf ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-red-100 text-red-700">
                  PDF
                </span>
              ) : isImage ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-primary/10 text-primary">
                  IMAGE
                </span>
              ) : null}
            </div>
            {fileName && (
              <p className="truncate text-xs text-outline mt-0.5">{displayName}</p>
            )}
          </div>
          <button
            type="button"
            aria-label="Close receipt preview"
            onClick={onClose}
            className="text-outline hover:text-on-surface p-1 rounded-md hover:bg-surface-container-high transition-colors"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
              close
            </span>
          </button>
        </div>

        {/* Preview Container / Lightbox Body */}
        <div className="relative flex min-h-[300px] max-h-[75vh] items-center justify-center rounded-lg border border-outline-variant bg-surface-container-low p-2 sm:p-4 overflow-hidden">
          {/* Loading Spinner */}
          {isLoading && !hasError && (
            <div
              data-testid="receipt-loading-indicator"
              className="absolute inset-0 flex flex-col items-center justify-center bg-surface-container-low/80 backdrop-blur-2xs z-10 space-y-2"
            >
              <span className="material-symbols-outlined text-[36px] text-primary animate-spin">
                progress_activity
              </span>
              <p className="text-xs font-medium text-on-surface-variant">
                Loading receipt preview…
              </p>
            </div>
          )}

          {/* Error State */}
          {hasError ? (
            <div
              data-testid="receipt-error-state"
              className="py-12 px-4 text-center max-w-md space-y-3"
            >
              <span className="material-symbols-outlined text-[56px] text-error">
                error_outline
              </span>
              <div>
                <p className="font-semibold text-sm text-on-surface">
                  Unable to display receipt
                </p>
                <p className="text-xs text-outline mt-1">
                  The file could not be loaded in the previewer. It may be corrupt or in an unsupported format.
                </p>
              </div>
              {previewUrl && (
                <div className="pt-2">
                  <a
                    href={previewUrl}
                    download={displayName}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary hover:underline rounded-md bg-primary/10"
                  >
                    <span className="material-symbols-outlined text-[16px]">download</span>
                    Download file instead
                  </a>
                </div>
              )}
            </div>
          ) : isImage && !pdfOnly ? (
            <img
              src={previewUrl}
              alt={displayName ? `Preview of ${displayName}` : 'Receipt preview'}
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setHasError(true);
              }}
              className="max-h-[70vh] max-w-full rounded object-contain transition-opacity duration-200"
            />
          ) : isPdf ? (
            (!pdfOnly || pdfBlobUrl) && (
              <iframe
                title={displayName}
                src={pdfOnly ? pdfBlobUrl! : previewUrl}
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false);
                  setHasError(true);
                }}
                className="h-[70vh] w-full rounded border border-outline-variant bg-white"
              />
            )
          ) : (
            <div className="py-10 text-center max-w-sm space-y-2">
              <span className="material-symbols-outlined text-[56px] text-primary">
                description
              </span>
              <p className="font-semibold text-sm text-on-surface">{displayName}</p>
              <p className="text-xs text-outline">
                {pdfOnly
                  ? 'Only PDF receipts can be previewed here.'
                  : 'This document format cannot be rendered inline within the browser.'}
              </p>
              {previewUrl && !pdfOnly && (
                <a
                  href={previewUrl}
                  download={displayName}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary hover:underline"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  Download Attachment
                </a>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-outline-variant pt-3">
          <div className="text-xs text-on-surface-variant truncate max-w-xs">
            {previewUrl ? (
              <a
                href={previewUrl}
                download={displayName}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-primary hover:underline font-semibold"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                Download receipt
              </a>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
