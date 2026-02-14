'use client';

import { motion } from 'motion/react';

type QueryEditorProps = {
  query: string;
  onChange: (value: string) => void;
  onRun: () => void;
  isRunning: boolean;
};

export function QueryEditor({ query, onChange, onRun, isRunning }: QueryEditorProps) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur p-4 mb-6">
      <label className="block text-sm font-medium text-slate-300 mb-2">Your question</label>
      <textarea
        value={query}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (query.trim() && !isRunning) onRun();
          }
        }}
        placeholder="e.g. List all doctors, Show patients with their visit count (Enter to send, Shift+Enter for new line)"
        className="w-full min-h-[100px] rounded-lg border border-slate-700 bg-slate-950/50 px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y font-mono text-sm"
        disabled={isRunning}
      />
      <div className="flex items-center gap-3 mt-3">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onRun}
          disabled={isRunning || !query.trim()}
          className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium shadow-lg shadow-indigo-500/20 transition-all duration-300"
        >
          {isRunning ? 'Running…' : 'Run query'}
        </motion.button>
      </div>
    </div>
  );
}
