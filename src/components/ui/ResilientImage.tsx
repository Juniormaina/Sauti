import { useState } from 'react';
import { Volume2 } from 'lucide-react';
import { useOfflineStore } from '../../stores/offlineStore';

interface ResilientImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
}

export function ResilientImage({ src, alt, className = '', fallbackTitle }: ResilientImageProps) {
  const [failed, setFailed] = useState(false);
  const lowBandwidthMode = useOfflineStore((s) => s.lowBandwidthMode);

  if (failed || lowBandwidthMode) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#FFF8ED] via-[#A9D9E8]/30 to-[#F6C96B]/30 p-6 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <Volume2 className="h-8 w-8 text-[#245C45] mb-2" aria-hidden="true" />
        <span className="font-display text-sm font-semibold text-[#245C45]">
          {fallbackTitle || alt}
        </span>
        {lowBandwidthMode && (
          <span className="text-[11px] text-[#4A5851] mt-1">Image paused (Data-Saving Mode)</span>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
