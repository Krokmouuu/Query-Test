'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  runNaturalLanguageQuery,
  listReports,
  createReport,
  deleteReport,
  type QueryResult,
  type SavedReport as ApiReport,
} from '@/lib/api';
import { Sidebar } from '@/components/Sidebar';
import { QueryEditor } from '@/components/QueryEditor';
import { DataTable } from '@/components/DataTable';
import { ChartView } from '@/components/ChartView';
import { ViewModeSelector } from '@/components/ViewModeSelector';
import { DbStatsPanel } from '@/components/DbStatsPanel';

export type ViewMode = 'table' | 'bar' | 'pie';

export interface SavedReport {
  id: string;
  name: string;
  query: string;
  viewMode: ViewMode;
  timestamp: Date;
}

function apiReportToUi(r: ApiReport): SavedReport {
  return {
    id: String(r.id),
    name: r.name,
    query: r.naturalLanguageQuery ?? r.sql ?? '',
    viewMode: (r.chartType === 'bar' || r.chartType === 'table' || r.chartType === 'pie' ? r.chartType : 'table') as ViewMode,
    timestamp: new Date(r.updatedAt ?? r.createdAt ?? Date.now()),
  };
}

export default function Home() {
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [saveModal, setSaveModal] = useState(false);
  const [reportName, setReportName] = useState('');

  const loadReports = useCallback(async () => {
    try {
      const list = await listReports();
      setSavedReports(list.map(apiReportToUi));
    } catch {
      setSavedReports([]);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleRunQuery = async () => {
    if (!query.trim()) return;
    setIsRunning(true);
    setError(null);
    setResult(null);
    try {
      const data = await runNaturalLanguageQuery(query.trim());
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setIsRunning(false);
    }
  };

  const handleSaveReport = async () => {
    if (!reportName.trim() || !result) return;
    try {
      await createReport({
        name: reportName.trim(),
        naturalLanguageQuery: query.trim() || undefined,
        sql: result.sql || undefined,
        chartType: viewMode,
      });
      setSaveModal(false);
      setReportName('');
      loadReports();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    }
  };

  const handleLoadReport = async (report: SavedReport) => {
    setQuery(report.query);
    setViewMode(report.viewMode);
    setError(null);
    if (!report.query.trim()) {
      setResult(null);
      return;
    }
    setIsRunning(true);
    setResult(null);
    try {
      const data = await runNaturalLanguageQuery(report.query.trim());
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load report');
    } finally {
      setIsRunning(false);
    }
  };

  const handleDeleteReport = async (id: string) => {
    try {
      await deleteReport(Number(id));
      loadReports();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
  };

  const data = result?.rows ?? [];
  const columns = result?.columns ?? [];
  const hasRun = result !== null;

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 overflow-hidden">
      <motion.div
        className="absolute inset-0 opacity-30 pointer-events-none"
        animate={{
          background: [
            'radial-gradient(circle at 20% 50%, rgba(99, 102, 241, 0.3) 0%, transparent 50%)',
            'radial-gradient(circle at 80% 80%, rgba(139, 92, 246, 0.3) 0%, transparent 50%)',
            'radial-gradient(circle at 40% 20%, rgba(99, 102, 241, 0.3) 0%, transparent 50%)',
          ],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
      />

      <Sidebar
        savedReports={savedReports}
        onLoadReport={handleLoadReport}
        onDeleteReport={handleDeleteReport}
      />

      <main className="flex-1 flex flex-col p-8 min-h-0 overflow-hidden relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <QueryEditor
            query={query}
            onChange={setQuery}
            onRun={handleRunQuery}
            isRunning={isRunning}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex items-center gap-4 mb-6 flex-wrap"
        >
          <ViewModeSelector viewMode={viewMode} onChange={setViewMode} />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setSaveModal(true)}
            className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg font-medium shadow-lg shadow-purple-500/30 transition-all duration-300"
          >
            Save report
          </motion.button>
          <div className="ml-auto">
            <DbStatsPanel />
          </div>
        </motion.div>

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 text-sm"
          >
            {error}
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {hasRun && (
            <>
              {result?.sql && (
                <motion.div
                  key="sql"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="mb-4 text-xs text-slate-500 font-mono bg-slate-950/50 p-3 rounded-lg border border-slate-800/30"
                >
                  {result.sql}
                </motion.div>
              )}
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -30 }}
                transition={{ duration: 0.5 }}
                className="flex-1 min-h-0 flex flex-col bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-slate-800/50 p-6 shadow-2xl overflow-hidden"
              >
                <div className={`flex-1 min-h-0 flex flex-col ${viewMode === 'table' ? 'overflow-auto' : ''}`}>
                  <AnimatePresence mode="wait">
                    {viewMode === 'table' ? (
                      <DataTable key="table" data={data} columns={columns} />
                    ) : (
                      <ChartView key="chart" data={data} columns={columns} mode={viewMode} />
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </main>

      {saveModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setSaveModal(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-sm shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-medium text-white mb-3">Save report</h3>
            <input
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
              placeholder="Report name"
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2.5 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setSaveModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveReport}
                disabled={!reportName.trim()}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
