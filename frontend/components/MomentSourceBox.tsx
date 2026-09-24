'use client';

import Link from 'next/link';
import { MomentSource } from '@/types';

export default function MomentSourceBox({ source }: { source: MomentSource }) {
  return (
    <div className="mt-3 rounded-lg bg-gray-50 p-3">
      {source.deleted ? (
        <>
          <p className="text-sm text-gray-500">
            来源内容已撤下
          </p>
          <p className="text-xs text-gray-400 mt-1">
            @{source.author.username} 的原动态已删除，以下为转发时保留的内容
          </p>
        </>
      ) : (
        <Link
          href={source.author.id ? `/profile/${source.author.id}` : '#'}
          className="text-sm font-medium text-green-600 hover:underline"
        >
          @{source.author.username}
        </Link>
      )}

      {source.content && (
        <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">
          {source.content}
        </p>
      )}

      {source.images && source.images.length > 0 && (
        <div className={`grid gap-2 mt-2 ${
          source.images.length === 1 ? 'grid-cols-1' :
          source.images.length === 2 ? 'grid-cols-2' :
          'grid-cols-3'
        }`}>
          {source.images.map((img, idx) => (
            <img
              key={idx}
              src={img}
              alt=""
              className={`object-cover rounded ${
                source.images.length === 1 ? 'w-full max-h-64' : 'w-full aspect-square'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
