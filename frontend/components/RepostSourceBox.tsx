import Link from 'next/link';
import { Moment } from '@/types';
import { AlertTriangle } from 'lucide-react';

// 转发卡片中的来源区块：始终展示转发时快照的原作者昵称、原正文、原图
export default function RepostSourceBox({ moment }: { moment: Moment }) {
  const sourceName = moment.sourceAuthorName || '未知用户';

  return (
    <div className="mt-3 rounded-lg bg-gray-50 border border-gray-100 p-3">
      {moment.sourceDeleted && (
        <div className="flex items-center space-x-1 text-xs text-amber-600 bg-amber-50 rounded px-2 py-1 mb-2">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>来源内容已撤下，以下为转发时的内容快照</span>
        </div>
      )}

      <div className="flex items-center space-x-1 text-sm flex-wrap">
        <span className="text-gray-400">原作者：</span>
        {moment.sourceAuthorId && !moment.sourceDeleted ? (
          <Link
            href={`/profile/${moment.sourceAuthorId}`}
            className="font-medium text-purple-600 hover:underline"
          >
            {sourceName}
          </Link>
        ) : (
          <span className="font-medium text-gray-600">{sourceName}</span>
        )}
      </div>

      {moment.sourceContent && (
        <p className="text-gray-700 text-sm mt-2 whitespace-pre-wrap">
          {moment.sourceContent}
        </p>
      )}

      {moment.sourceImages && moment.sourceImages.length > 0 && (
        <div className={`grid gap-2 mt-2 ${
          moment.sourceImages.length === 1 ? 'grid-cols-1' :
          moment.sourceImages.length === 2 ? 'grid-cols-2' :
          'grid-cols-3'
        }`}>
          {moment.sourceImages.map((img, idx) => (
            <img
              key={idx}
              src={img}
              alt=""
              className={`object-cover rounded-lg ${
                moment.sourceImages!.length === 1 ? 'w-full max-h-80' : 'w-full aspect-square'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
