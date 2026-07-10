import React, { useEffect, useState } from 'react';
import { getFileDownloadUrl } from '../utils/cloudStorage';
import { CloudScoreFile } from '../types/cloudFiles';
import { useLanguage } from '../context/LanguageContext';
import { Loader2, FileText, Image as ImageIcon, ExternalLink, Trash2 } from 'lucide-react';

interface CloudScoreFileViewProps {
  file: CloudScoreFile;
  onDelete?: () => void;
  readOnly?: boolean;
  onOpenPdf?: (file: CloudScoreFile) => void;
}

export default function CloudScoreFileView({ file, onDelete, readOnly, onOpenPdf }: CloudScoreFileViewProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    let isMounted = true;
    getFileDownloadUrl(file.storagePath)
      .then(downloadUrl => {
        if (isMounted) setUrl(downloadUrl);
      })
      .catch((e) => {
        console.error('Failed to load cloud file', e);
        if (isMounted) setError(true);
      });
    return () => { isMounted = false; };
  }, [file.storagePath]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const isPdf = file.contentType === 'application/pdf';

  return (
    <div className="flex items-center justify-between p-3 bg-stone-800 rounded-xl border border-white/5">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-lg bg-stone-700 flex items-center justify-center shrink-0">
          {isPdf ? <FileText size={20} className="text-brand" /> : <ImageIcon size={20} className="text-emerald-500" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-stone-200 truncate">{file.fileName}</p>
          <p className="text-[10px] text-stone-500 font-mono">
            {formatSize(file.size)} • {new Date(file.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-2 shrink-0 pl-3">
        {error ? (
          <span className="text-[10px] text-red-400 px-2">{t('repertoire.loadFailed') || 'Load failed'}</span>
        ) : url ? (
          <button 
            onClick={() => {
              if (isPdf && onOpenPdf) {
                onOpenPdf(file);
              } else {
                window.open(url, '_blank');
              }
            }}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-brand/20 text-stone-400 hover:text-brand flex items-center justify-center transition-colors"
            title={t('repertoire.openFile') || 'Open file'}
            type="button"
          >
            <ExternalLink size={14} />
          </button>
        ) : (
          <div className="w-8 h-8 flex items-center justify-center">
            <Loader2 size={14} className="animate-spin text-stone-500" />
          </div>
        )}
        
        {!readOnly && onDelete && (
          <button 
            onClick={onDelete}
            type="button"
            className="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 flex items-center justify-center transition-colors"
            title={t('common.delete') || 'Delete'}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
