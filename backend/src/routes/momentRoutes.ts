import { Router } from 'express';
import {
  createMoment,
  createRepost,
  getMoments,
  getUserMoments,
  deleteMoment
} from '../controllers/momentController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.post('/', authMiddleware, createMoment);
router.get('/', authMiddleware, getMoments);
router.get('/user/:userId', authMiddleware, getUserMoments);
router.post('/:id/repost', authMiddleware, createRepost);
router.delete('/:id', authMiddleware, deleteMoment);

export default router;
