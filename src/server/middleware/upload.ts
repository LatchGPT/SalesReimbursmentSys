import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';

export const uploadDir = config.uploadDir;

try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch (err) {
  console.error(`Could not create upload dir at ${uploadDir}:`, err);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_UPLOAD_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error('Unsupported file type. Please upload an image (JPG, PNG, GIF, WEBP), a PDF, or a Word document (DOC, DOCX).'));
    }
    cb(null, true);
  }
});
