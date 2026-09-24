import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/prisma';
import { addPoints } from './authController';

const REPOST_COMMENT_MAX_LENGTH = 80;

const authorSelect = {
  id: true,
  username: true,
  avatar: true,
  level: true
};

const momentInclude = {
  author: { select: authorSelect },
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
  // 来源原动态仍在时带上最新信息，撤下后 repostOf 为 null，前端改用快照展示
  repostOf: {
    select: {
      id: true,
      content: true,
      images: true,
      createdAt: true,
      author: { select: authorSelect }
    }
  },
  _count: {
    select: { likes: true, comments: true }
  }
};

/**
 * 统一附加转发快照字段，前端始终从 source 读取来源信息：
 * - 来源在线时使用实时的作者与正文
 * - 来源撤下后使用转发时的快照，并标记 deleted
 */
const withSource = (moment: any) => {
  if (!moment.repostOfId && !moment.sourceAuthorId) {
    return moment;
  }

  const source = moment.repostOf
    ? {
        id: moment.repostOf.id,
        author: moment.repostOf.author,
        content: moment.repostOf.content,
        images: moment.repostOf.images,
        createdAt: moment.repostOf.createdAt,
        deleted: false
      }
    : {
        id: null,
        author: {
          id: moment.sourceAuthorId,
          username: moment.sourceAuthorUsername
        },
        content: moment.sourceContent,
        images: moment.sourceImages || [],
        createdAt: null,
        deleted: true
      };

  const { repostOf, sourceAuthorId, sourceAuthorUsername, sourceContent, sourceImages, ...rest } = moment;
  return { ...rest, source };
};

/**
 * 为列表中的原动态批量标记当前用户是否已转发，用于前端按钮置灰。
 */
const attachHasReposted = async (moments: any[], userId?: string) => {
  if (!userId || moments.length === 0) {
    moments.forEach(m => { m.hasReposted = false; });
    return moments;
  }

  const originIds = moments
    .filter(m => !m.repostOfId)
    .map(m => m.id);

  if (originIds.length === 0) {
    moments.forEach(m => { m.hasReposted = false; });
    return moments;
  }

  const existing = await prisma.moment.findMany({
    where: {
      authorId: userId,
      repostOfId: { in: originIds }
    },
    select: { repostOfId: true }
  });
  const repostedIds = new Set(existing.map(r => r.repostOfId));

  moments.forEach(m => {
    m.hasReposted = repostedIds.has(m.id);
  });
  return moments;
};

export const createMoment = async (req: AuthRequest, res: Response) => {
  const { content, images } = req.body;

  try {
    const moment = await prisma.moment.create({
      data: {
        content: content || '',
        images: images || [],
        sourceImages: [],
        authorId: req.userId!
      }
    });

    const momentWithAuthor = await prisma.moment.findUnique({
      where: { id: moment.id },
      include: momentInclude
    });

    await addPoints(req.userId!, 10);

    res.status(201).json({ message: '动态发布成功', moment: withSource(momentWithAuthor) });
  } catch (error) {
    res.status(500).json({ error: '发布失败' });
  }
};

export const createRepost = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { comment } = req.body;
  const userId = req.userId!;

  const repostComment = typeof comment === 'string' ? comment.trim() : '';

  if (repostComment.length > REPOST_COMMENT_MAX_LENGTH) {
    return res.status(400).json({ error: `看法不能超过 ${REPOST_COMMENT_MAX_LENGTH} 个字` });
  }

  try {
    // 转发一条转发时，归属到它最初的原动态；原动态已撤下时 repostOfId 为空
    const target = await prisma.moment.findUnique({
      where: { id },
      select: {
        id: true,
        authorId: true,
        content: true,
        images: true,
        createdAt: true,
        repostOfId: true
      }
    });

    if (!target) {
      return res.status(404).json({ error: '来源内容已撤下，无法转发' });
    }

    let root: { id: string; authorId: string; content: string; images: string[]; createdAt: Date } = target;
    if (target.repostOfId) {
      const rootMoment = await prisma.moment.findUnique({
        where: { id: target.repostOfId },
        select: { id: true, authorId: true, content: true, images: true, createdAt: true }
      });
      if (!rootMoment) {
        return res.status(404).json({ error: '来源内容已撤下，无法转发' });
      }
      root = rootMoment;
    }
    const rootId = root.id;

    if (root.authorId === userId) {
      return res.status(400).json({ error: '不能转发自己的动态' });
    }

    const existing = await prisma.moment.findFirst({
      where: { authorId: userId, repostOfId: rootId }
    });
    if (existing) {
      return res.status(409).json({ error: '你已经转发过这条动态了' });
    }

    const sourceAuthor = await prisma.user.findUnique({
      where: { id: root.authorId },
      select: { id: true, username: true }
    });

    const moment = await prisma.moment.create({
      data: {
        content: repostComment,
        images: [],
        sourceImages: root.images || [],
        authorId: userId,
        repostOfId: rootId,
        repostComment: repostComment || null,
        sourceAuthorId: root.authorId,
        sourceAuthorUsername: sourceAuthor?.username || '未知花友',
        sourceContent: root.content
      }
    });

    const repost = await prisma.moment.findUnique({
      where: { id: moment.id },
      include: momentInclude
    });

    res.status(201).json({ message: '转发成功', moment: withSource(repost) });
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

    // 动态流展示自己与已关注花友的动态（含转发）
    const where: any = {
      authorId: { in: [...followingIds, userId] }
    };

    const moments = await prisma.moment.findMany({
      where,
      include: momentInclude,
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit)
    });

    const total = await prisma.moment.count({ where });

    await attachHasReposted(moments as any[], userId);

    res.json({
      moments: moments.map(withSource),
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

export const getUserMoments = async (req: AuthRequest, res: Response) => {
  const { userId } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const currentUserId = req.userId;

  try {
    const moments = await prisma.moment.findMany({
      where: { authorId: userId },
      include: momentInclude,
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit)
    });

    const total = await prisma.moment.count({ where: { authorId: userId } });

    await attachHasReposted(moments as any[], currentUserId);

    res.json({
      moments: moments.map(withSource),
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

    // 原作者和转发者各自只能撤下自己的动态，管理员可撤下任意动态
    if (moment.authorId !== req.userId && !req.isAdmin) {
      return res.status(403).json({ error: '无权限删除' });
    }

    // 原动态撤下：转发仅解除引用，正文/原图/来源昵称的快照继续保留
    await prisma.moment.updateMany({
      where: { repostOfId: id },
      data: { repostOfId: null }
    });

    // 清理该动态下的评论与点赞（转发引用不受影响）
    const commentIds = await prisma.comment.findMany({
      where: { momentId: id },
      select: { id: true }
    });
    await prisma.like.deleteMany({
      where: { OR: [{ momentId: id }, { commentId: { in: commentIds.map(c => c.id) } }] }
    });
    await prisma.comment.deleteMany({ where: { momentId: id } });

    await prisma.moment.delete({ where: { id } });

    res.json({ message: '删除成功' });
  } catch (error) {
    res.status(500).json({ error: '删除失败' });
  }
};
