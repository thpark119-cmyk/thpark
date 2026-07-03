import React, { useEffect, useState } from 'react';
import { getFileDownloadUrl } from '../utils/cloudStorage';
import { useLanguage } from '../context/LanguageContext';
import { CloudLessonPhoto } from '../types/cloudFiles';
import { Loader2 } from 'lucide-react';

interface CloudPhotoViewProps {
  photo: CloudLessonPhoto;
  onClick?: () => void;
  className?: string;
  onLoadError?: () => void;
}

export default function CloudPhotoView({ photo, onClick, className, onLoadError }: CloudPhotoViewProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    let isMounted = true;
    
    getFileDownloadUrl(photo.storagePath)
      .then(downloadUrl => {
        if (isMounted) setUrl(downloadUrl);
      })
      .catch((e) => {
        console.error('Failed to load cloud photo', e);
        if (isMounted) {
          setError(true);
          onLoadError?.();
        }
      });

    return () => {
      isMounted = false;
    };
  }, [photo.storagePath]);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-stone-900 border border-stone-800 text-stone-500 text-[10px] text-center p-2 rounded-lg cursor-pointer ${className || ''}`} onClick={onClick}>
        {t('students.photoLoadFailed') || 'Could not load the photo. Please check your network connection.'}
      </div>
    );
  }

  if (!url) {
    return (
      <div className={`flex items-center justify-center bg-stone-900 rounded-lg ${className || ''}`}>
        <Loader2 size={16} className="text-stone-500 animate-spin" />
      </div>
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
