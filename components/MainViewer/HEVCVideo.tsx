import React from 'react';

interface HEVCVideoProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  className?: string;
}

export const HEVCVideo: React.FC<HEVCVideoProps> = ({ videoRef, className }) => {
  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      preload="metadata"
      className={className}
    />
  );
};

