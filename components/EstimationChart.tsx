
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';

interface EstimationChartProps {
  votes: string[];
}

const EstimationChart: React.FC<EstimationChartProps> = ({ votes }) => {
  const counts = votes.reduce((acc: Record<string, number>, vote) => {
    acc[vote] = (acc[vote] || 0) + 1;
    return acc;
  }, {});

  const data = Object.keys(counts)
    .sort((a, b) => {
      const numA = parseFloat(a);
      const numB = parseFloat(b);
      if (isNaN(numA) || isNaN(numB)) return a.localeCompare(b);
      return numA - numB;
    })
    .map(key => ({
      name: key,
      value: counts[key]
    }));

  if (data.length === 0) return null;

  const numericVotes = votes.map(v => Number(v)).filter(v => Number.isFinite(v));
  const minVote = numericVotes.length ? Math.min(...numericVotes) : null;
  const maxVote = numericVotes.length ? Math.max(...numericVotes) : null;
  const maxCount = data.reduce((m, d) => Math.max(m, d.value), 0);

  return (
    <div className="w-full mt-6">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {minVote !== null && (
          <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            Min: {minVote}
          </span>
        )}
        {maxVote !== null && (
          <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
            Max: {maxVote}
          </span>
        )}
      </div>

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#94a3b8' }}
              width={24}
              domain={[0, Math.max(1, maxCount)]}
            />
            <Tooltip
              cursor={{ fill: 'rgba(79,70,229,0.06)' }}
              contentStyle={{
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.08)',
                fontSize: '12px'
              }}
              formatter={(value: any, _name: any, props: any) => {
                const label = props?.payload?.name;
                return [`${value}`, `Votes for ${label}`];
              }}
              labelStyle={{ fontWeight: 800, color: '#0f172a' }}
            />
            <Bar dataKey="value" radius={[10, 10, 2, 2]} maxBarSize={42}>
              {data.map((entry, index) => {
                const n = Number(entry.name);
                const isMin = minVote !== null && Number.isFinite(n) && n === minVote;
                const isMax = maxVote !== null && Number.isFinite(n) && n === maxVote;
                const fill = isMin ? '#10b981' : isMax ? '#f43f5e' : '#4f46e5';
                return <Cell key={`cell-${index}`} fill={fill} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default EstimationChart;
