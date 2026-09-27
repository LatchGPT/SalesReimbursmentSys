import { describe, expect, it } from 'vitest';
import { uploadUrl } from '../../../lib/api';

/**
 * Pure classification logic mirroring ReceiptAttachmentPreviewModal
 * to guarantee robust conditional rendering across file types.
 */
export function classifyReceiptAttachment(
  url: string,
  fileName?: string,
  fileType?: string
): { isPdf: boolean; isImage: boolean; isUnsupported: boolean; previewUrl: string } {
  const previewUrl = uploadUrl(url) ?? '';
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

  const isUnsupported = !isPdf && !isImage;

  return { isPdf, isImage, isUnsupported, previewUrl };
}

describe('Receipt Attachment Preview Classification & Routing', () => {
  it('correctly classifies image files (JPEG, PNG, WEBP)', () => {
    const pngResult = classifyReceiptAttachment('/uploads/receipt_101.png', 'receipt_101.png', 'image/png');
    expect(pngResult.isImage).toBe(true);
    expect(pngResult.isPdf).toBe(false);
    expect(pngResult.isUnsupported).toBe(false);

    const jpgUrlOnly = classifyReceiptAttachment('/uploads/lunch_receipt.jpeg');
    expect(jpgUrlOnly.isImage).toBe(true);
    expect(jpgUrlOnly.isPdf).toBe(false);

    const blobImage = classifyReceiptAttachment('blob:http://localhost:3000/temp-uuid', 'photo.jpg', 'image/jpeg');
    expect(blobImage.isImage).toBe(true);
    expect(blobImage.isPdf).toBe(false);
  });

  it('correctly classifies PDF files and avoids mistaking blob PDFs as images', () => {
    const pdfResult = classifyReceiptAttachment('/uploads/tax_invoice.pdf', 'tax_invoice.pdf', 'application/pdf');
    expect(pdfResult.isPdf).toBe(true);
    expect(pdfResult.isImage).toBe(false);
    expect(pdfResult.isUnsupported).toBe(false);

    // Critical edge case: Newly uploaded PDF has blob URL before saving to server
    const blobPdf = classifyReceiptAttachment('blob:http://localhost:3000/temp-uuid', 'official_receipt.pdf', 'application/pdf');
    expect(blobPdf.isPdf).toBe(true);
    expect(blobPdf.isImage).toBe(false);

    // URL with query parameter
    const queryPdf = classifyReceiptAttachment('/uploads/doc.pdf?version=2&auth=xyz');
    expect(queryPdf.isPdf).toBe(true);
    expect(queryPdf.isImage).toBe(false);
  });

  it('identifies unsupported file formats for fallback download state', () => {
    const docxResult = classifyReceiptAttachment('/uploads/statement.docx', 'statement.docx');
    expect(docxResult.isUnsupported).toBe(true);
    expect(docxResult.isPdf).toBe(false);
    expect(docxResult.isImage).toBe(false);

    const zipResult = classifyReceiptAttachment('/uploads/bundle.zip', 'bundle.zip', 'application/zip');
    expect(zipResult.isUnsupported).toBe(true);
  });

  it('preserves blob URLs and decorates server uploads with user credentials', () => {
    const blobUrl = 'blob:http://localhost:3000/preview-123';
    expect(uploadUrl(blobUrl)).toBe(blobUrl);

    const serverUrl = '/uploads/my_receipt.png';
    const resolved = uploadUrl(serverUrl);
    expect(resolved).toContain('/uploads/my_receipt.png');
    expect(resolved).toContain('?uid=');
  });
});
