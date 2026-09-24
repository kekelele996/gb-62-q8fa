import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/prisma';
import { addPoints } from './authController';

const AUTHOR_SELECT = {
  id: true,
  username: true,
  avatar: true,
  level: true
} as const;

// 为转发动态标注来源原动态是否已撤下（快照内容始终保留）
const attachSourceStatus = async (moments: any[]) => {
  const sourceIds = Array.from(
    new Set(
      moments
        .filter(m => m.repostOfId)
        .map(m => m.repostOfId as string)
    )
  );

  if (sourceIds.length === 0) {
    moments.forEach(m => { if (m.repostOfId) m.sourceDeleted = false; });
    return moments;
  }

  const existing = await prisma.moment.findMany({
    where: { id: { in: sourceIds } },
    select: { id: true }
  });
  const existingIds = new Set(existing.map(m => m.id));

  moments.forEach(m => {
    if (m.repostOfId) {
      m.sourceDeleted = !existingIds.has(m.repostOfId);
    }
  });

  return moments;
};

export const createMoment = async (req: AuthRequest, res: Response) => {
  const { content, images } = req.body;

  try {
    const moment = await prisma.moment.create({
      data: {
        content,
        images: images || [],
        authorId: req.userId!
      }
    });

    const momentWithAuthor = await prisma.moment.findUnique({
      where: { id: moment.id },
      include: {
        author: {
          select: AUTHOR_SELECT
        }
      }
    });

    await addPoints(req.userId!, 10);

    res.status(201).json({ message: '动态发布成功', moment: momentWithAuthor });
  } catch (error) {
    res.status(500).json({ error: '发布失败' });
  }
};

export const repostMoment = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { comment } = req.body;
  const userId = req.userId!;

  if (comment !== undefined && comment !== null) {
    if (typeof comment !== 'string') {
      return res.status(400).json({ error: '转发看法格式不正确' });
    }
    // 按 Unicode 码点计数，最多 80 字
    if (Array.from(comment.trim()).length > 80) {
      return res.status(400).json({ error: '转发看法不能超过80个字' });
    }
  }

  try {
    const target = await prisma.moment.findUnique({ where: { id } });

    if (!target) {
      return res.status(404).json({ error: '原动态不存在或已撤下' });
    }

    // 转发只能针对原始动态，转发内容不能二次转发（保证来源归属清晰）
    if (target.repostOfId) {
      return res.status(400).json({ error: '不能转发一条转发动态' });
    }

    // 转发自己的内容没有意义
    if (target.authorId === userId) {
      return res.status(400).json({ error: '不能转发自己的动态' });
    }

    // 同一条动态每位用户只能转发一次
    const existing = await prisma.moment.findFirst({
      where: { authorId: userId, repostOfId: target.id }
    });

    if (existing) {
      return res.status(409).json({ error: '你已经转发过这条动态了' });
    }

    // 快照原作者昵称、头像、原正文与原图
    const sourceAuthor = await prisma.user.findUnique({
      where: { id: target.authorId },
      select: { id: true, username: true, avatar: true }
    });

    const repost = await prisma.moment.create({
      data: {
        content: '',
        images: [],
        authorId: userId,
        repostOfId: target.id,
        repostComment: comment?.trim() ? comment.trim() : null,
        sourceAuthorId: target.authorId,
        sourceAuthorName: sourceAuthor?.username ?? '未知用户',
        sourceAuthorAvatar: sourceAuthor?.avatar ?? null,
        sourceContent: target.content,
        sourceImages: target.images
      },
      include: {
        author: {
          select: AUTHOR_SELECT
        }
      }
    });

    (repost as any).sourceDeleted = false;

    res.status(201).json({ message: '转发成功', moment: repost });
  } catch (error) {
    res.status(500).json({ error: '转发失败' });
  }
};

export const getMoments = async (req: AuthRequest, res: Response) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const userId = req.userId;

  try {
    const followings = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true }
    });

    const followingIds = followings.map(f => f.followingId);

    const where: any = {};
    if (followingIds.length > 0) {
      where.authorId = { in: followingIds };
    }

    const moments = await prisma.moment.findMany({
      where,
      include: {
        author: {
          select: AUTHOR_SELECT
        },
        comments: {
          include: {
            author: {
              select: {
                id: true,
                username: true,
                avatar: true
              }
            }
          }
        },
        _count: {
          select: { likes: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit)
    });

    await attachSourceStatus(moments as any[]);

    const total = await prisma.moment.count({ where });

    res.json({
      moments,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ error: '获取失败' });
  }
};

export const getUserMoments = async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  try {
    const moments = await prisma.moment.findMany({
      where: { authorId: userId },
      include: {
        author: {
          select: AUTHOR_SELECT
        },
        _count: {
          select: { likes: true, comments: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit)
    });

    await attachSourceStatus(moments as any[]);

    const total = await prisma.moment.count({ where: { authorId: userId } });

    res.json({
      moments,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ error: '获取失败' });
  }
};

export const deleteMoment = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    const moment = await prisma.moment.findUnique({ where: { id } });

    if (!moment) {
      return res.status(404).json({ error: '动态不存在' });
    }

    // 原作者可撤下原动态，转发者可撤下自己的转发，管理员可撤下任意动态
    if (moment.authorId !== req.userId && !req.isAdmin) {
      return res.status(403).json({ error: '无权限删除' });
    }

    // 删除原动态不影响已产生的转发：转发保留当时快照（repostOfId 为普通字段无级联）
    // 先清理本动态的评论点赞、评论与点赞，避免 Restrict 关系导致撤下失败
    const comments = await prisma.comment.findMany({
      where: { momentId: id },
      select: { id: true }
    });
    const commentIds = comments.map(c => c.id);

    await prisma.like.deleteMany({
      where: { OR: [{ momentId: id }, { commentId: { in: commentIds } }] }
    });
    await prisma.comment.deleteMany({ where: { momentId: id } });
    await prisma.moment.delete({ where: { id } });

    res.json({ message: '删除成功' });
  } catch (error) {
    res.status(500).json({ error: '删除失败' });
  }
};
