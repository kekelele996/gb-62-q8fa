'use client';

import { useState, useEffect } from 'react';
import { X, Repeat2 } from 'lucide-react';
import { momentApi } from '@/lib/api';
import { Moment } from '@/types';

const MAX_LENGTH = 80;

interface RepostModalProps {
  moment: Moment | null;
  onClose: () => void;
  onSubmitted: () => void;
}

export default function RepostModal({ moment, onClose, onSubmitted }: RepostModalProps) {
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (moment) {
      setComment('');
      setSubmitting(false);
    }
  }, [moment]);

  if (!moment) return null;

  // 转发目标始终是最初的原动态
  const originId = moment.repostOfId ? moment.source?.id ?? moment.id : moment.id;
  const sourceAuthorName = moment.repostOfId
    ? moment.source?.author.username
    : moment.author.username;
  const sourceContent = moment.repostOfId ? moment.source?.content : moment.content;
  const sourceImages = moment.repostOfId ? moment.source?.images : moment.images;

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await momentApi.repost(originId!, comment.trim());
      onSubmitted();
      onClose();
    } catch (error: any) {
      alert(error.response?.data?.error || '转发失败，请重试');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800 flex items-center space-x-2">
            <Repeat2 className="w-5 h-5 text-green-500" />
            <span>转发到花友圈</span>
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, MAX_LENGTH))}
              className="input-field min-h-[90px] resize-none"
              placeholder="说说你的看法（可不填）"
              autoFocus
            />
            <div className="text-right text-xs text-gray-400 mt-1">
              {comment.length}/{MAX_LENGTH}
            </div>
          </div>

          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-sm font-medium text-gray-700">
              {sourceAuthorName || '未知花友'}
            </p>
            {sourceContent && (
              <p className="text-sm text-gray-600 mt-1 line-clamp-4 whitespace-pre-wrap">
                {sourceContent}
              </p>
            )}
            {sourceImages && sourceImages.length > 0 && (
              <div className="flex space-x-2 mt-2">
                {sourceImages.slice(0, 3).map((img, idx) => (
                  <img
                    key={idx}
                    src={img}
                    alt=""
                    className="w-16 h-16 object-cover rounded"
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-2 p-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 rounded-lg bg-green-500 text-white hover:bg-green-600 disabled:opacity-50"
          >
            {submitting ? '转发中...' : '转发'}
          </button>
        </div>
      </div>
    </div>
  );
}
