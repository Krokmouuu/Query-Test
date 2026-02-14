const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api/proxy';

export type QueryResult = {
  sql: string;
  rows: Record<string, unknown>[];
  columns: string[];
};

export async function runNaturalLanguageQuery(query: string): Promise<QueryResult> {
  const res = await fetch(`${API_BASE}/query/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? 'Query failed');
  }
  return res.json();
}

export type SavedReport = {
  id: number;
  name: string;
  naturalLanguageQuery: string | null;
  sql: string | null;
  chartType: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function listReports(): Promise<SavedReport[]> {
  const res = await fetch(`${API_BASE}/reports`);
  if (!res.ok) throw new Error('Failed to load reports');
  return res.json();
}

export async function getReport(id: number): Promise<SavedReport | null> {
  const res = await fetch(`${API_BASE}/reports/${id}`);
  if (!res.ok) return null;
  return res.json();
}

export async function createReport(data: {
  name: string;
  naturalLanguageQuery?: string;
  sql?: string;
  chartType?: string;
}): Promise<SavedReport> {
  const res = await fetch(`${API_BASE}/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to save report');
  return res.json();
}

export async function deleteReport(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/reports/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete report');
}

export type DbStats = {
  organizations: number;
  facilities: number;
  doctors: number;
  patients: number;
  visits: number;
  insurances: number;
  savedReports: number;
};

export async function getDbStats(): Promise<DbStats> {
  const res = await fetch(`${API_BASE}/stats`);
  if (!res.ok) throw new Error('Failed to load stats');
  return res.json();
}
