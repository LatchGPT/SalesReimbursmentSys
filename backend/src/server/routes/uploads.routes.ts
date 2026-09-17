import { Router } from 'express';
import * as path from 'path';
import { UserRole } from '../../serverTypes';
import { state } from '../state';
import { getUser } from '../middleware/auth';
import { upload, uploadDir } from '../middleware/upload';
import { findUploadAccessCheck } from '../services/authorization';

export const uploadsRouter = Router();

uploadsRouter.get('/uploads/:filename', (req, res) => {
  const userId = req.header('X-User-Id') || (req.query.uid as string | undefined);
  const user = state.users.find(u => u.id === userId);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const safeFilename = path.basename(req.params.filename);
  const authorized = findUploadAccessCheck(`/uploads/${safeFilename}`);
  if (!authorized) return res.status(404).json({ error: 'File not found' });
  if (!authorized(user)) return res.status(403).json({ error: 'Forbidden' });

  const filePath = path.join(uploadDir, safeFilename);
  res.sendFile(filePath, (err) => {
    if (err && !res.headersSent) {
      res.status(404).json({ error: 'File not found' });
    }
  });
});

uploadsRouter.post('/api/upload', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (user.role === UserRole.FINANCE) {
    return res.status(403).json({ error: 'Finance access is view-only.' });
  }

  upload.single('file')(req, res, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File is too large. Maximum size is 10MB.' });
      }
      return res.status(400).json({ error: err.message || 'Upload failed.' });
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ url: `/uploads/${req.file.filename}` });
  });
});
