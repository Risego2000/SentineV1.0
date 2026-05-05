export const isLikelyHevcFilename = (filename: string): boolean => {
  const lower = filename.toLowerCase();
  return (
    lower.endsWith('.hevc') ||
    lower.endsWith('.h265') ||
    lower.endsWith('.265') ||
    lower.endsWith('.hev')
  );
};

export const canPlayHevcNatively = (): boolean => {
  if (typeof document === 'undefined') return false;
  const video = document.createElement('video');
  return (
    video.canPlayType('video/mp4; codecs="hev1.1.6.L93.B0"') !== '' ||
    video.canPlayType('video/mp4; codecs="hvc1"') !== '' ||
    video.canPlayType('video/mp4; codecs="hev1"') !== ''
  );
};
