import React, { useEffect, useState } from 'react';
import { getLessonPhoto } from '../utils/localPhotoStorage';
import { useLanguage } from '../context/LanguageContext';

interface LocalPhotoViewProps {
  photoId: string;
  onClick?: () => void;
  className?: string;
  onLoadError?: () => void;
}

export default function LocalPhotoView({ photoId, onClick, className, onLoadError }: LocalPhotoViewProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    let objectUrl: string | null = null;
    
    getLessonPhoto(photoId)
      .then(photo => {
        if (photo && photo.blob) {
          objectUrl = URL.createObjectURL(photo.blob);
          setUrl(objectUrl);
        } else {
          setError(true);
          onLoadError?.();
        }
      })
      .catch((e) => {
        console.error('Failed to load photo', e);
        setError(true);
        onLoadError?.();
      });

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [photoId]);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-stone-900 border border-stone-800 text-stone-500 text-[10px] text-center p-2 rounded-lg ${className || ''}`}>
        {t('students.photoNotOnDevice') || 'Photo not on this device'}
      </div>
    );
  }

  if (!url) {
    return (
      <div className={`flex items-center justify-center bg-stone-900 animate-pulse rounded-lg ${className || ''}`} />
    );
  }

  return (
    <img 
      src={url} 
      alt="Lesson" 
      onClick={onClick}
      className={`object-cover cursor-pointer rounded-lg ${className || ''}`}
    />
  );
}
