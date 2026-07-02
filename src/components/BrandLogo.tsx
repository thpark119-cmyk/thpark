import React from 'react';

interface BrandLogoProps {
  compact?: boolean;
  className?: string;
}

export function BrandLogo({ compact = false, className = '' }: BrandLogoProps) {
  if (compact) {
    return (
      <span className={`inline-flex items-baseline whitespace-nowrap tracking-tight ${className}`} aria-label="Music In One">
        <span className="font-[800] text-brand/90 mr-[0.02em]">M</span>io
      </span>
    );
  }

  return (
    <span className={`inline-flex items-baseline whitespace-nowrap tracking-tight ${className}`} aria-label="Music In One">
      <span className="mr-[0.18em]">
        <span className="font-[800] text-brand/90 tracking-[0.01em]">M</span>usic
      </span>
      <span className="mr-[0.18em]">
        <span className="font-[800] text-brand/90 tracking-[0.01em]">I</span>n
      </span>
      <span>
        <span className="font-[800] text-brand/90 tracking-[0.01em]">O</span>ne
      </span>
    </span>
  );
}
