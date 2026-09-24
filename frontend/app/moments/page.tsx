'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { momentApi, uploadApi } from '@/lib/api';
import { Moment } from '@/types';
import MomentCard from '@/components/MomentCard';
import {
  MessageCircle,
  X,
  Image as ImageIcon
} from 'lucide-react';

export default function MomentsPage() {
  const [moments, setMoments] = useState<Moment[]>([]);
  const [content, setContent] = useState('');
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    loadMoments();
  }, [user, router]);

  const loadMoments = async () => {
    try {
      const res = await momentApi.getList({ page: 1, limit: 20 });
      setMoments(res.data.moments);
    } catch (error) {
      console.error('加载动态失败', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const fileList = Array.from(files);
      const res = await uploadApi.uploadMultiple(fileList);
      setUploadedImages(prev => [...prev, ...res.data.urls]);
    } catch (error) {
      alert('图片上传失败');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim() && uploadedImages.length === 0) {
      alert('请输入内容或添加图片');
      return;
    }

    setSubmitting(true);
    try {
      await momentApi.create({
        content,
        images: uploadedImages
      });
      setContent('');
      setUploadedImages([]);
      loadMoments();
    } catch (error) {
      alert('发布失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="flex items-center space-x-3 mb-6">
        <MessageCircle className="w-8 h-8 text-purple-500" />
        <h1 className="text-2xl font-bold text-gray-800">花友圈</h1>
      </div>

      <div className="card p-4 mb-6">
        <form onSubmit={handleSubmit} className="space-y-3">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="input-field min-h-[80px] resize-none"
            placeholder="分享你的种植日常..."
          />

          {uploadedImages.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {uploadedImages.map((img, idx) => (
                <div key={idx} className="relative">
                  <img
                    src={img}
                    alt=""
                    className="w-full aspect-square object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <label className="flex items-center space-x-2 text-gray-500 cursor-pointer hover:text-green-500">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
                disabled={uploading}
              />
              <ImageIcon className="w-5 h-5" />
              <span className="text-sm">{uploading ? '上传中...' : '添加图片'}</span>
            </label>
            <button
              type="submit"
              disabled={submitting || (!content.trim() && uploadedImages.length === 0)}
              className="btn-primary disabled:opacity-50"
            >
              {submitting ? '发布中...' : '发布'}
            </button>
          </div>
        </form>
      </div>

      {moments.length === 0 ? (
        <div className="card p-12 text-center">
          <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">还没有动态</p>
          <p className="text-gray-400 text-sm mt-2">关注更多花友来查看他们的动态</p>
        </div>
      ) : (
        <div className="space-y-4">
          {moments.map((moment) => (
            <MomentCard
              key={moment.id}
              moment={moment}
              currentUserId={user?.id}
              isAdmin={user?.isAdmin}
              onChange={loadMoments}
            />
          ))}
        </div>
      )}
    </div>
  );
}
