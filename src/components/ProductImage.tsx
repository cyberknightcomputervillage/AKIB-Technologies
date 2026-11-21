import React, { useEffect, useState } from 'react';
import { Cpu } from 'lucide-react';
import { isValidImageUrl } from '../lib/validation';

interface ProductImageProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
}

export function ProductImage({
  src,
  alt,
  className = 'w-full h-full object-cover',
  containerClassName = 'bg-slate-100',
}: ProductImageProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const safeUrl = src && isValidImageUrl(src) ? src.trim() : '';

  if (!safeUrl || failed) {
    return (
      <div
        className={`w-full h-full flex flex-col items-center justify-center p-4 text-slate-400 select-none ${containerClassName}`}
        role="img"
        aria-label={alt}
      >
        <Cpu className="w-8 h-8 mb-2 stroke-[1.5]" />
        <span className="text-xs font-medium text-slate-500 text-center line-clamp-2 max-w-[180px]">
          {alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={safeUrl}
      alt={alt}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
