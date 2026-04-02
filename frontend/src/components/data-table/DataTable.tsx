import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { useOilPrices } from '../../hooks/useOilPrices';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { formatCurrency, formatCompactDate } from '../../lib/utils';

type SortKey = 'date' | 'wti' | 'brent' | 'spread' | 'return' | 'volatility';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 50;

export function DataTable() {
  const { data: wtiData, isLoading: wtiLoading } = useOilPrices('wti');
  const { data: brentData, isLoading: brentLoading } = useOilPrices('brent');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(0);

  const rows = useMemo(() => {
    if (!wtiData?.observations?.length) return [];

    const brentMap = new Map<string, number>();
    if (brentData?.observations) {
      for (const p of brentData.observations) {
        brentMap.set(p.date, p.value);
      }
    }

    return wtiData.observations.map((p: { date: string; value: number }, i: number) => {
      const brentVal = brentMap.get(p.date) ?? null;
      const spread = brentVal !== null ? brentVal - p.value : null;
      const prevWti = i > 0 ? wtiData.observations[i - 1].value : null;
      const dailyReturn = prevWti !== null ? ((p.value - prevWti) / prevWti) * 100 : null;

      let vol20 = null;
      if (i >= 20) {
        const returns: number[] = [];
        for (let j = i - 19; j <= i; j++) {
          const r = (wtiData.observations[j].value - wtiData.observations[j - 1].value) / wtiData.observations[j - 1].value;
          returns.push(r);
        }
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / (returns.length - 1);
        vol20 = Math.sqrt(variance) * Math.sqrt(252) * 100;
      }

      return { date: p.date, wti: p.value, brent: brentVal, spread, dailyReturn, vol20 };
    });
  }, [wtiData, brentData]);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      let va: number, vb: number;
      switch (sortKey) {
        case 'date': va = new Date(a.date).getTime(); vb = new Date(b.date).getTime(); break;
        case 'wti': va = a.wti; vb = b.wti; break;
        case 'brent': va = a.brent ?? 0; vb = b.brent ?? 0; break;
        case 'spread': va = a.spread ?? 0; vb = b.spread ?? 0; break;
        case 'return': va = a.dailyReturn ?? 0; vb = b.dailyReturn ?? 0; break;
        case 'volatility': va = a.vol20 ?? 0; vb = b.vol20 ?? 0; break;
        default: va = 0; vb = 0;
      }
      return sortDir === 'asc' ? va - vb : vb - va;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageRows = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
    setPage(0);
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronDown className="h-3 w-3 opacity-30" />;
    return sortDir === 'asc' ? <ChevronUp className="h-3 w-3 text-accent" /> : <ChevronDown className="h-3 w-3 text-accent" />;
  };

  const handleExportCsv = () => {
    const header = 'Date,WTI,Brent,Spread,Daily Return %,20d Volatility %\n';
    const csvRows = sorted.map((r) =>
      `${r.date},${r.wti.toFixed(2)},${r.brent?.toFixed(2) ?? ''},${r.spread?.toFixed(2) ?? ''},${r.dailyReturn?.toFixed(4) ?? ''},${r.vol20?.toFixed(2) ?? ''}`
    );
    const csv = header + csvRows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'oil_prices.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (wtiLoading || brentLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-[400px]">
          <div className="text-text-secondary font-[family-name:var(--font-mono)] text-sm">Loading data...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Price Data</CardTitle>
        <Button variant="outline" size="sm" onClick={handleExportCsv}>
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Export CSV
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-accent/10">
                {([
                  ['date', 'Date'],
                  ['wti', 'WTI'],
                  ['brent', 'Brent'],
                  ['spread', 'Spread'],
                  ['return', 'Daily Return %'],
                  ['volatility', '20d Vol %'],
                ] as [SortKey, string][]).map(([key, label]) => (
                  <th
                    key={key}
                    className="py-2 px-3 text-left font-[family-name:var(--font-display)] tracking-wider uppercase text-text-secondary cursor-pointer hover:text-text-primary transition-colors"
                    onClick={() => toggleSort(key)}
                  >
                    <div className="flex items-center gap-1">
                      {label}
                      <SortIcon col={key} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, i) => (
                <tr key={r.date} className={`border-b border-border hover:bg-surface/50 transition-colors ${i % 2 === 0 ? '' : 'bg-surface/20'}`}>
                  <td className="py-1.5 px-3 font-[family-name:var(--font-mono)] text-text-secondary">{formatCompactDate(r.date)}</td>
                  <td className="py-1.5 px-3 font-[family-name:var(--font-mono)]">{formatCurrency(r.wti)}</td>
                  <td className="py-1.5 px-3 font-[family-name:var(--font-mono)]">{r.brent !== null ? formatCurrency(r.brent) : '--'}</td>
                  <td className="py-1.5 px-3 font-[family-name:var(--font-mono)]">{r.spread !== null ? formatCurrency(r.spread) : '--'}</td>
                  <td className={`py-1.5 px-3 font-[family-name:var(--font-mono)] ${
                    r.dailyReturn !== null
                      ? r.dailyReturn > 0 ? 'text-green' : r.dailyReturn < 0 ? 'text-red' : ''
                      : ''
                  }`}>
                    {r.dailyReturn !== null ? `${r.dailyReturn >= 0 ? '+' : ''}${r.dailyReturn.toFixed(2)}%` : '--'}
                  </td>
                  <td className="py-1.5 px-3 font-[family-name:var(--font-mono)]">{r.vol20 !== null ? `${r.vol20.toFixed(1)}%` : '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
          <span className="text-xs text-text-secondary font-[family-name:var(--font-mono)]">
            Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, sorted.length)} of {sorted.length} rows
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-text-secondary px-2 font-[family-name:var(--font-mono)]">
              Page {page + 1} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
