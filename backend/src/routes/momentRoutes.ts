import { Router } from 'express';
import {
  createMoment,
  repostMoment,
  getMoments,
  getUserMoments,
  deleteMoment
} from '../controllers/momentController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.post('/', authMiddleware, createMoment);
router.get('/', authMiddleware, getMoments);
router.get('/user/:userId', getUserMoments);
router.post('/:id/repost', authMiddleware, repostMoment);
router.delete('/:id', authMiddleware, deleteMoment);

export default router;
