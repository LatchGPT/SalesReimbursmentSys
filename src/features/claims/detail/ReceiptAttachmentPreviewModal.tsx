import { Modal } from '../../../components/shared/Modal';
import { Button } from '../../../components/ui/Button';
import { uploadUrl } from '../../../lib/api';

interface ReceiptAttachmentPreviewModalProps {
  url: string | null;
  fileName?: string;
  fileType?: string;
  onClose: () => void;
}

export function ReceiptAttachmentPreviewModal({ url, fileName, fileType, onClose }: ReceiptAttachmentPreviewModalProps) {
  if (!url) return null;

  const previewUrl = uploadUrl(url);
  const isImage = fileType ? fileType.startsWith('image/') : url.startsWith('blob:') || /\.(jpeg|jpg|gif|png|webp)($|\?)/i.test(url);
  const isPdf = fileType === 'application/pdf' || /\.pdf($|\?)/i.test(url);

  return (
    <Modal isOpen onClose={onClose} titleId="receipt-attachment-preview-title" className="max-w-3xl">
      <div className="bg-surface-container-lowest rounded-xl w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between gap-4 border-b border-outline-variant pb-3">
          <div className="min-w-0">
            <h3 id="receipt-attachment-preview-title" className="font-headline-sm text-on-surface">Receipt Preview</h3>
            {fileName && <p className="truncate text-xs text-outline mt-1">{fileName}</p>}
          </div>
          <button type="button" aria-label="Close receipt preview" onClick={onClose} className="text-outline hover:text-on-surface">
            <span aria-hidden="true" className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex min-h-56 items-center justify-center rounded-lg border border-outline-variant bg-surface-container-low p-4">
          {isImage ? (
            <img src={previewUrl} alt={fileName ? `Preview of ${fileName}` : 'Receipt preview'} className="max-h-[70vh] max-w-full rounded object-contain" />
          ) : isPdf ? (
            <iframe title={fileName || 'Receipt preview'} src={previewUrl} className="h-[70vh] w-full rounded border border-outline-variant bg-white" />
          ) : (
            <div className="py-8 text-center">
              <span className="material-symbols-outlined text-[56px] text-primary">description</span>
              <p className="mt-2 text-sm font-semibold text-on-surface">{fileName || 'Receipt attachment'}</p>
              <p className="mt-1 text-xs text-outline">This file type cannot be previewed in the browser.</p>
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-outline-variant pt-3">
          <Button size="sm" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}
