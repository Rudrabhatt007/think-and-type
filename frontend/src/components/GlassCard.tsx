import React from 'react';
import { motion } from 'framer-motion';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  heavy?: boolean;
  delay?: number;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  heavy = false,
  delay = 0,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      className={`
        ${heavy ? 'glass-panel-heavy' : 'glass-panel'}
        rounded-2xl p-6 backdrop-blur-md border border-white/10
        ${className}
      `}
    >
      {children}
    </motion.div>
  );
};
