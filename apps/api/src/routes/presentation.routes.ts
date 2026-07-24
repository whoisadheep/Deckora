import { Router } from 'express';
import multer from 'multer';
import { createOutline } from '../controllers/presentation.controller';
import { exportPresentation } from '../controllers/presentation.controller';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per file
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif'
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Accepted: PDF, DOCX, TXT, Images.`));
    }
  },
});

const router = Router();

const multiUpload = upload.fields([
  { name: 'document', maxCount: 1 },
  { name: 'images', maxCount: 8 }
]);

router.post('/outline', multiUpload, createOutline);
router.post('/export', multiUpload, exportPresentation);

export default router;