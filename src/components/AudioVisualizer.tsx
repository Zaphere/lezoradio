interface Props {
  isPlaying: boolean;
  size?: 'small' | 'medium' | 'large';
}

export default function AudioVisualizer({ isPlaying, size = 'medium' }: Props) {
  const sizeClasses = {
    small: 'h-8 gap-1',
    medium: 'h-12 gap-1.5',
    large: 'h-16 gap-2'
  };

  const barClasses = {
    small: 'w-1',
    medium: 'w-1.5',
    large: 'w-2'
  };

  if (!isPlaying) {
    return (
      <div className={`flex items-center justify-center ${sizeClasses[size]}`}>
        <div className={`${barClasses[size]} h-2 bg-primary/30 rounded-full`} />
        <div className={`${barClasses[size]} h-2 bg-primary/30 rounded-full`} />
        <div className={`${barClasses[size]} h-2 bg-primary/30 rounded-full`} />
        <div className={`${barClasses[size]} h-2 bg-primary/30 rounded-full`} />
        <div className={`${barClasses[size]} h-2 bg-primary/30 rounded-full`} />
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center ${sizeClasses[size]}`}>
      <div className={`${barClasses[size]} bg-primary rounded-full sound-bar`} style={{ animationDelay: '0s' }} />
      <div className={`${barClasses[size]} bg-primary rounded-full sound-bar-1`} style={{ animationDelay: '0.1s' }} />
      <div className={`${barClasses[size]} bg-primary rounded-full sound-bar-2`} style={{ animationDelay: '0.2s' }} />
      <div className={`${barClasses[size]} bg-primary rounded-full sound-bar-3`} style={{ animationDelay: '0.3s' }} />
      <div className={`${barClasses[size]} bg-primary rounded-full sound-bar-4`} style={{ animationDelay: '0.4s' }} />
      <div className={`${barClasses[size]} bg-primary rounded-full sound-bar-2`} style={{ animationDelay: '0.5s' }} />
      <div className={`${barClasses[size]} bg-primary rounded-full sound-bar-1`} style={{ animationDelay: '0.6s' }} />
      <div className={`${barClasses[size]} bg-primary rounded-full sound-bar`} style={{ animationDelay: '0.7s' }} />
    </div>
  );
}
