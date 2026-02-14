'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Database, ChevronDown, ChevronUp } from 'lucide-react';
import { getDbStats, type DbStats } from '@/lib/api';

const LABELS: Record<keyof DbStats, string> = {
  organizations: 'Organisations',
  facilities: 'Établissements',
  doctors: 'Médecins',
  patients: 'Patients',
  visits: 'Visites',
  insurances: 'Assurances',
  savedReports: 'Rapports sauvegardés',
};

export function DbStatsPanel() {
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState<DbStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    getDbStats()
      .then(setStats)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erreur'))
      .finally(() => setLoading(false));
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/50 text-slate-400 hover:text-slate-200 hover:border-slate-600 text-sm transition-colors"
        title="Afficher les stats de la base"
      >
        <Database className="w-4 h-4" />
        <span>Stats DB</span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 top-full mt-2 z-20 w-56 rounded-xl border border-slate-700 bg-slate-900/95 backdrop-blur-xl shadow-xl overflow-hidden"
          >
            <div className="p-3 border-b border-slate-700">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Contenu de la base
              </span>
            </div>
            <div className="p-3 max-h-64 overflow-y-auto">
              {loading && (
                <p className="text-slate-500 text-sm">Chargement…</p>
              )}
              {error && (
                <p className="text-red-400 text-sm">{error}</p>
              )}
              {stats && !loading && (
                <ul className="space-y-2">
                  {(Object.keys(LABELS) as (keyof DbStats)[]).map((key) => (
                    <li
                      key={key}
                      className="flex justify-between items-center text-sm"
                    >
                      <span className="text-slate-400">{LABELS[key]}</span>
                      <span className="font-mono font-medium text-indigo-300">
                        {stats[key]}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
