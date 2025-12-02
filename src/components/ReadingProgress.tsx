'use client';

import { useState, useEffect } from 'react';
import { motion, useSpring } from 'framer-motion';

export default function ReadingProgress() {
  const [progress, setProgress] = useState(0);
  const springProgress = useSpring(0, { stiffness: 100, damping: 30 });

  useEffect(() => {
    const updateProgress = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPosition = window.scrollY;
      const newProgress = scrollHeight > 0 ? (scrollPosition / scrollHeight) * 100 : 0;
      setProgress(newProgress);
      springProgress.set(newProgress);
    };

    window.addEventListener('scroll', updateProgress);
    updateProgress();

    return () => window.removeEventListener('scroll', updateProgress);
  }, [springProgress]);

  // Don't show if page is too short
  if (progress === 0 && typeof window !== 'undefined') {
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (scrollHeight < 500) return null;
  }

  return (
    <div className="fixed top-16 left-0 right-0 z-40 h-0.5 bg-[var(--weathered-bone)]/10">
      <motion.div
        className="h-full bg-gradient-to-r from-lantern to-ember"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

