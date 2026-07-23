import { Router } from 'express';
import { createOutline } from '../controllers/presentation.controller';
import { exportPresentation } from '../controllers/presentation.controller';

const router = Router();

router.post('/outline', createOutline);
router.post('/export', exportPresentation);

export default router;