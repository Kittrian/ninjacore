import type { ClientDetail } from '@/lib/types';

const BUREAUS = [
  { key: 'transunion' as const, label: 'TRANSUNION', from: 'from-cyan-500/40', to: 'to-cyan-700/40', ring: 'ring-cyan-300/20' },
  { key: 'experian' as const, label: 'EXPERIAN', from: 'from-blue-700/40', to: 'to-indigo-900/40', ring: 'ring-blue-400/20' },
  { key: 'equifax' as const, label: 'EQUIFAX', from: 'from-red-600/40', to: 'to-rose-800/40', ring: 'ring-rose-300/20' },
];

const fmtScore = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n.toString() : '—';
};
const fmtPct = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? `${n.toFixed(0)}%` : '—';
};
const fmtMoney = (v: unknown) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
};
const fmtYears = (v: unknown) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return '—';
  return `${n.toFixed(1)} yr`;
};

export default function BureauCards({ client }: { client: ClientDetail }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {BUREAUS.map((b) => {
        const score = client.creditScores?.[b.key];
        const util = client.bureauUtilization?.[b.key];
        const ageYears = (() => {
          const v = client.bureauAgeOfCredit?.[b.key];
          if (typeof v === 'number') return v / 12; // months → years assumption
          return null;
        })();
        const onTime = client.bureauOnTimePayments?.[b.key];
        const debt = client.bureauTotalDebt?.[b.key];
        return (
          <div
            key={b.key}
            className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${b.from} ${b.to} ring-1 ${b.ring} backdrop-blur p-5`}
          >
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold tracking-widest text-white/90">{b.label}</div>
              <div className="text-[10px] font-semibold tracking-widest text-white/70 bg-black/30 rounded-full px-2 py-1">
                PROJECTED FICO 8 —
              </div>
            </div>
            <div className="mt-6 text-5xl font-extrabold tabular-nums">{fmtScore(score)}</div>
            <div className="mt-6 grid grid-cols-2 gap-3 text-xs text-white/80">
              <div className="rounded-lg bg-black/20 p-3">
                <div className="uppercase tracking-wider text-white/60">Utilization</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">
                  {fmtPct(util?.utilizationPercent)}
                </div>
              </div>
              <div className="rounded-lg bg-black/20 p-3">
                <div className="uppercase tracking-wider text-white/60">Age of credit</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">{fmtYears(ageYears)}</div>
              </div>
              <div className="rounded-lg bg-black/20 p-3">
                <div className="uppercase tracking-wider text-white/60">On-time pmts</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">{fmtPct(onTime)}</div>
              </div>
              <div className="rounded-lg bg-black/20 p-3">
                <div className="uppercase tracking-wider text-white/60">Total debt</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">{fmtMoney(debt)}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
