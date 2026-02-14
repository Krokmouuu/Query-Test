"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { ViewMode } from "@/app/page";

const COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#06b6d4",
  "#f97316",
  "#a855f7",
];

type ChartViewProps = {
  data: Record<string, unknown>[];
  columns: string[];
  mode: Exclude<ViewMode, "table">;
};

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (active && payload && payload.length) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-900/95 backdrop-blur-xl border border-indigo-500/50 rounded-lg p-3 shadow-xl"
      >
        <p className="text-slate-300 font-semibold mb-1">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </motion.div>
    );
  }
  return null;
}

export function hasNumericColumn(data: Record<string, unknown>[], cols: string[]) {
  if (!data?.length) return false;
  const colList = cols.length ? cols : Object.keys(data[0] ?? {});
  return colList.some((col) => {
    const val = data[0]?.[col];
    return (
      typeof val === "number" ||
      (typeof val === "string" && /^-?\d+\.?\d*$/.test(String(val)))
    );
  });
}

export function ChartView({ data, columns, mode }: ChartViewProps) {
  const { chartData, valueKey, canChart } = useMemo(() => {
    if (!data?.length)
      return { chartData: [], valueKey: "value", canChart: false };
    const colList = columns.length ? columns : Object.keys(data[0] ?? {});
    const first = colList[0] ?? "name";
    const numericCols = colList.filter((col) => {
      const val = data[0]?.[col];
      return (
        typeof val === "number" ||
        (typeof val === "string" && /^-?\d+\.?\d*$/.test(String(val)))
      );
    });
    if (numericCols.length > 0) {
      const valueKey = numericCols[0];
      const categoryCol = colList.find((c) => !numericCols.includes(c)) ?? first;
      const chartData = data.map((row) => ({
        name: String(row[categoryCol] ?? ""),
        value: Number(row[valueKey]) || 0,
        [valueKey]: Number(row[valueKey]) || 0,
      }));
      return { chartData, valueKey, canChart: true };
    }
    const countByCategory = new Map<string, number>();
    for (const row of data) {
      const cat = String(row[first] ?? "");
      countByCategory.set(cat, (countByCategory.get(cat) ?? 0) + 1);
    }
    const chartData = Array.from(countByCategory.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    return { chartData, valueKey: "effectif", canChart: chartData.length > 0 };
  }, [data, columns]);

  if (!chartData.length) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-slate-400 text-center py-12"
      >
        No data to display
      </motion.div>
    );
  }

  if (!canChart) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-slate-400 text-center py-12 px-4"
      >
        <p className="font-medium text-slate-300 mb-1">Aucune donnée numérique</p>
        <p className="text-sm">Les graphiques nécessitent au moins une colonne de nombres. Passez en vue Tableau pour afficher ces résultats.</p>
      </motion.div>
    );
  }

  if (chartData.length === 1) {
    const single = chartData[0];
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center gap-3 py-12"
      >
        <p className="text-slate-400 text-sm">Un seul résultat : un graphique n’a pas de sens ici.</p>
        <p className="text-4xl font-bold text-indigo-400 tabular-nums">{single.value}</p>
        {single.name && String(single.name) !== String(single.value) && (
          <p className="text-slate-500 text-sm">{single.name}</p>
        )}
        <p className="text-slate-500 text-xs">Utilisez la vue Tableau pour ce type de requête.</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.4 }}
      className="w-full flex-1 min-h-0 relative"
    >
      <motion.div
        className="absolute inset-0 opacity-20 rounded-xl pointer-events-none"
        animate={{
          background: [
            "radial-gradient(circle at 0% 0%, rgba(99, 102, 241, 0.3) 0%, transparent 50%)",
            "radial-gradient(circle at 100% 100%, rgba(139, 92, 246, 0.3) 0%, transparent 50%)",
            "radial-gradient(circle at 0% 100%, rgba(236, 72, 153, 0.3) 0%, transparent 50%)",
            "radial-gradient(circle at 100% 0%, rgba(99, 102, 241, 0.3) 0%, transparent 50%)",
          ],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
      />

      <ResponsiveContainer width="100%" height="100%">
        {mode === "bar" ? (
          <BarChart data={chartData}>
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={1} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.8} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#334155"
              opacity={0.3}
            />
            <XAxis
              dataKey="name"
              stroke="#94a3b8"
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={100}
            />
            <YAxis stroke="#94a3b8" tick={{ fill: "#94a3b8", fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ color: "#94a3b8" }} />
            <Bar
              dataKey="value"
              fill="url(#barGradient)"
              name={valueKey}
              radius={[8, 8, 0, 0]}
              animationDuration={1000}
              animationBegin={0}
            />
          </BarChart>
        ) : (
          <PieChart>
            <Pie
              data={chartData.slice(0, 8)}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) =>
                `${String(name).split(" ")[0]}: ${((percent ?? 0) * 100).toFixed(0)}%`
              }
              outerRadius={150}
              fill="#8884d8"
              dataKey="value"
              animationDuration={1000}
              animationBegin={0}
            >
              {chartData.slice(0, 8).map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                  stroke="#1e293b"
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ color: "#94a3b8" }}
              layout="vertical"
              align="right"
              verticalAlign="middle"
            />
          </PieChart>
        )}
      </ResponsiveContainer>

      <motion.div
        className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none"
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute -bottom-10 -left-10 w-40 h-40 bg-purple-600/20 rounded-full blur-3xl pointer-events-none"
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1,
        }}
      />
    </motion.div>
  );
}
