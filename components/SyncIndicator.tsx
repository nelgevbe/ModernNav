
import React, { useEffect, useState } from 'react';
import { Loader2, CloudUpload } from 'lucide-react';
import { storageService } from '../services/storage';
import { useLanguage } from '../contexts/LanguageContext';

export const SyncIndicator: React.FC = () => {
  const [isDirty, setIsDirty] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    // Initial check
    storageService.checkGlobalDirtyState();

    const unsubscribe = storageService.subscribeSyncStatus((status) => {
      setIsDirty(status);
    });
    return () => unsubscribe();
  }, []);

  // We use a small delay for hiding to avoid flickering if rapid changes occur
  // But for showing, we want it instant.
  
  if (!isDirty) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[150] flex justify-center pointer-events-none">
      <div className="bg-indigo-600/90 text-white text-xs font-medium px-4 py-1.5 rounded-t-lg shadow-lg border-t border-indigo-400/30 backdrop-blur-md flex items-center gap-2 animate-fade-in-down">
        <Loader2 size={12} className="animate-spin text-indigo-200" />
        <span className="tracking-wide">{t('syncing_msg')}</span>
      </div>
    </div>
  );
};
