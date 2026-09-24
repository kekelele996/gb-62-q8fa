'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Heart,
  MessageCircle,
  Send,
  Repeat2,
  Trash2,
  User as UserIcon
} from 'lucide-react';
import { momentApi, interactionApi } from '@/lib/api';
import { formatTime } from '@/lib/time';
import { Moment } from '@/types';
import RepostModal from './RepostModal';
import MomentSourceBox from './MomentSourceBox';

interface MomentCardProps {
  moment: Moment;
  currentUserId?: string;
  isAdmin?: boolean;
  onChange: () => void;
}

export default function MomentCard({ moment, currentUserId, isAdmin, onChange }: MomentCardProps) {
  const [commentText, setCommentText] = useState('');
  const [repostTarget, setRepostTarget] = useState<Moment | null>(null);

  const isRepost = !!moment.repostOfId;
  const isOwn = moment.authorId === currentUserId;
  const canDelete = isOwn || isAdmin;

  const handleLike = async () => {
    try {
      await interactionApi.toggleLike({ momentId: moment.id });
      onChange();
    } catch (error) {
      console.error('点赞失败', error);
    }
  };

  const handleComment = async () => {
    const text = commentText.trim();
    if (!text) return;
    try {
      await interactionApi.createComment({ content: text, momentId: moment.id });
      setCommentText('');
      onChange();
    } catch (error) {
      alert('评论失败');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(
      isRepost ? '确定撤下这条转发吗？' : '确定撤下这条动态吗？'
    )) {
      return;
    }
    try {
      await momentApi.delete(moment.id);
      onChange();
    } catch (error: any) {
      alert(error.response?.data?.error || '删除失败');
    }
  };

  return (
    <div className="card p-4">
      <div className="flex items-start space-x-3">
        <Link href={`/profile/${moment.author.id}`} className="flex-shrink-0">
          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
            {moment.author.avatar ? (
              <img
                src={moment.author.avatar}
                alt={moment.author.username}
                className="w-10 h-10 rounded-full"
              />
            ) : (
              <UserIcon className="w-5 h-5 text-purple-600" />
            )}
          </div>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 flex-wrap">
              <Link href={`/profile/${moment.author.id}`} className="font-medium text-gray-800">
                {moment.author.username}
              </Link>
              <span className={`level-badge level-${moment.author.level}`}>
                {moment.author.level === 'SEED' && '🌰'}
                {moment.author.level === 'SPROUT' && '🌱'}
                {moment.author.level === 'FLOWER' && '🌸'}
                {moment.author.level === 'TREE' && '🌳'}
              </span>
              {isRepost && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-green-50 text-green-600 flex items-center space-x-0.5">
                  <Repeat2 className="w-3 h-3" />
                  <span>转发</span>
                </span>
              )}
              <span className="text-sm text-gray-400">
                {formatTime(moment.createdAt)}
              </span>
            </div>
            {canDelete && (
              <button
                onClick={handleDelete}
                title="撤下"
                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded flex-shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          {isRepost && (
            <>
              {moment.repostComment && (
                <p className="text-gray-700 mt-2 whitespace-pre-wrap">
                  {moment.repostComment}
                </p>
              )}
              {moment.source && <MomentSourceBox source={moment.source} />}
            </>
          )}

          {!isRepost && (
            <>
              {moment.content && (
                <p className="text-gray-700 mt-2 whitespace-pre-wrap">
                  {moment.content}
                </p>
              )}

              {moment.images && moment.images.length > 0 && (
                <div className={`grid gap-2 mt-3 ${
                  moment.images.length === 1 ? 'grid-cols-1' :
                  moment.images.length === 2 ? 'grid-cols-2' :
                  'grid-cols-3'
                }`}>
                  {moment.images.map((img, idx) => (
                    <img
                      key={idx}
                      src={img}
                      alt=""
                      className={`object-cover rounded-lg ${
                        moment.images.length === 1 ? 'w-full max-h-80' : 'w-full aspect-square'
                      }`}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          <div className="flex items-center space-x-6 mt-4">
            <button
              onClick={handleLike}
              className="flex items-center space-x-1 text-gray-500 hover:text-red-500"
            >
              <Heart className="w-5 h-5" />
              <span className="text-sm">{moment._count?.likes || 0}</span>
            </button>
            <span className="flex items-center space-x-1 text-gray-500">
              <MessageCircle className="w-5 h-5" />
              <span className="text-sm">{moment._count?.comments || 0}</span>
            </span>
            {!isRepost && (
              <button
                onClick={() => setRepostTarget(moment)}
                disabled={isOwn || moment.hasReposted}
                title={
                  isOwn
                    ? '不能转发自己的动态'
                    : moment.hasReposted
                      ? '你已经转发过了'
                      : '转发'
                }
                className={`flex items-center space-x-1 text-sm ${
                  isOwn || moment.hasReposted
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-gray-500 hover:text-green-600'
                }`}
              >
                <Repeat2 className="w-5 h-5" />
                <span>{moment.hasReposted ? '已转发' : '转发'}</span>
              </button>
            )}
          </div>

          {moment.comments && moment.comments.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              {moment.comments.slice(0, 3).map((comment) => (
                <div key={comment.id} className="text-sm py-1">
                  <Link href={`/profile/${comment.author.id}`} className="font-medium text-gray-800">
                    {comment.author.username}
                  </Link>
                  <span className="text-gray-600 ml-1">{comment.content}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex space-x-2 mt-3">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="flex-1 input-field py-1 text-sm"
              placeholder="评论..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleComment();
                }
              }}
            />
            <button
              onClick={handleComment}
              className="p-1 text-green-500 hover:bg-green-50 rounded"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {repostTarget && (
        <RepostModal
          moment={repostTarget}
          onClose={() => setRepostTarget(null)}
          onSubmitted={onChange}
        />
      )}
    </div>
  );
}
