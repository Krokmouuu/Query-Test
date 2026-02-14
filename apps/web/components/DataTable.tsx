'use client';

type DataTableProps = {
  data: Record<string, unknown>[];
  columns: string[];
};

export function DataTable({ data, columns }: DataTableProps) {
  if (data.length === 0) {
    return <p className="text-slate-500 text-sm">No rows returned.</p>;
  }
  const cols = columns.length ? columns : data[0] ? Object.keys(data[0] as object) : [];
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            {cols.map((col, colIndex) => (
              <th
                key={`${col}-${colIndex}`}
                className="text-left px-3 py-2 font-medium text-slate-400 border-b border-slate-700 whitespace-nowrap"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30">
              {cols.map((col, colIndex) => (
                <td
                  key={`${col}-${colIndex}`}
                  className="px-3 py-2 text-slate-300 whitespace-nowrap max-w-[280px] truncate"
                  title={String(row[col] ?? '')}
                >
                  {row[col] != null ? String(row[col]) : '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
