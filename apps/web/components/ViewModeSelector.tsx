'use client';

import { motion } from 'motion/react';
import { Table2, BarChart3, PieChart } from 'lucide-react';
import type { ViewMode } from '@/app/page';

interface ViewModeSelectorProps {
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

const modes: { value: ViewMode; icon: typeof Table2; label: string }[] = [
  { value: 'table', icon: Table2, label: 'Table' },
  { value: 'bar', icon: BarChart3, label: 'Bar' },
  { value: 'pie', icon: PieChart, label: 'Pie' },
];

export function ViewModeSelector({ viewMode, onChange }: ViewModeSelectorProps) {
  return (
    <div className="flex items-center gap-1 bg-slate-900/50 backdrop-blur-xl rounded-xl p-1.5 border border-slate-800/50">
      <span className="text-xs text-slate-400 px-3 mr-2">Show as</span>
      {modes.map((mode) => {
        const Icon = mode.icon;
        const isActive = viewMode === mode.value;

        return (
          <motion.button
            key={mode.value}
            onClick={() => onChange(mode.value)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`relative px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300 flex items-center gap-2 ${
              isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="activeMode"
                className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg shadow-lg shadow-indigo-500/30"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
              />
            )}
            <Icon className="w-4 h-4 relative z-10" />
            <span className="relative z-10">{mode.label}</span>

            {isActive && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-indigo-400 to-purple-400 rounded-lg blur-xl pointer-events-none"
                animate={{
                  opacity: [0.3, 0.6, 0.3],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
