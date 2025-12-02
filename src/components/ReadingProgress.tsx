'use client';

import { useEffect, useState } from 'react';

export default function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const updateProgress = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercent = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      setProgress(Math.min(100, scrollPercent));
    };

    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();

    return () => window.removeEventListener('scroll', updateProgress);
  }, []);

  if (progress < 2) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-0.5 bg-[var(--black-elevated)]">
      <div 
        className="h-full bg-[var(--red)] transition-all duration-100"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
