'use client';

import { motion } from 'motion/react';
import { FileText, Trash2, Clock } from 'lucide-react';
import type { SavedReport } from '@/app/page';

interface SidebarProps {
  savedReports: SavedReport[];
  onLoadReport: (report: SavedReport) => void;
  onDeleteReport: (id: string) => void;
}

export function Sidebar({ savedReports, onLoadReport, onDeleteReport }: SidebarProps) {
  return (
    <motion.aside
      initial={{ x: -300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="w-72 bg-slate-950/80 backdrop-blur-xl border-r border-slate-800/50 p-6 overflow-auto relative z-10"
    >
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="text-sm font-semibold text-slate-400 mb-4 uppercase tracking-wider">
          Saved reports
        </h2>
      </motion.div>

      {savedReports.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-sm text-slate-500 italic"
        >
          <p className="mb-2">No saved reports yet.</p>
          <p className="text-xs">Run a query and click &quot;Save report&quot;.</p>
        </motion.div>
      ) : (
        <div className="space-y-2">
          {savedReports.map((report, index) => (
            <motion.div
              key={report.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ scale: 1.02, x: 4 }}
              className="group bg-slate-900/50 border border-slate-800/50 rounded-lg p-3 cursor-pointer hover:bg-slate-800/50 hover:border-indigo-500/50 transition-all duration-300 relative overflow-hidden"
              onClick={() => onLoadReport(report)}
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-indigo-600/0 via-purple-600/10 to-pink-600/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                initial={false}
              />

              <div className="relative z-10 flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <FileText className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <h3 className="text-sm font-medium text-slate-200 truncate min-w-0">
                      {report.name}
                    </h3>
                    <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-xs rounded-full border border-indigo-500/30 flex-shrink-0">
                      {report.viewMode}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Clock className="w-3 h-3" />
                    <span>
                      {report.timestamp instanceof Date
                        ? report.timestamp.toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })
                        : new Date(report.timestamp).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-slate-600 font-mono truncate">
                    {report.query.length > 40 ? `${report.query.substring(0, 40)}...` : report.query || '—'}
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.2, rotate: 5 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteReport(report.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 hover:text-red-400 text-slate-500"
                >
                  <Trash2 className="w-4 h-4" />
                </motion.button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <motion.div
        className="absolute -bottom-20 -left-20 w-60 h-60 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </motion.aside>
  );
}
