import { useState } from 'react';
import { Volume2 } from 'lucide-react';

interface ResilientImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
}

export function ResilientImage({ src, alt, className = '', fallbackTitle }: ResilientImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
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
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
