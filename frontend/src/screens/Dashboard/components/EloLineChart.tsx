import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartWrapper } from './ChartWrapper';

interface Props {
  history: Array<{ date: string; elo: number }>;
}

export function EloLineChart({ history }: Props) {
  // Format dates nicely for X axis
  const data = history.map((point, index) => {
    const d = new Date(point.date);
    return {
      timestamp: d.getTime(), // unique continuous metric
      displayDate: `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`,
      elo: point.elo
    };
  });

  if (data.length <= 1) {
    return (
      <ChartWrapper title="Elo Rating Over Time">
        <div className="text-text-secondary text-sm">Play more matches to see your rating history!</div>
      </ChartWrapper>
    );
  }

  // Find min and max Elo for nice Y-axis scaling
  const elos = data.map(d => d.elo);
  const minElo = Math.min(...elos);
  const maxElo = Math.max(...elos);

  return (
    <ChartWrapper title="Elo Rating Over Time">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorElo" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.6}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f232b" vertical={false} />
          <XAxis 
            dataKey="displayDate" 
            stroke="#64748b" 
            fontSize={12} 
            tickLine={false} 
            axisLine={false}
            minTickGap={30}
            tickFormatter={(value) => value.split(' ')[0] + ' ' + value.split(' ')[1]} // Only show day and month on axis
          />
          <YAxis 
            domain={[minElo - 50, maxElo + 50]} 
            stroke="#64748b" 
            fontSize={12} 
            tickLine={false} 
            axisLine={false}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#111318', borderColor: '#3b82f6', borderRadius: '8px', boxShadow: '0 0 15px rgba(59, 130, 246, 0.3)' }}
            itemStyle={{ color: '#60a5fa', fontWeight: 'bold' }}
            labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
            cursor={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '4 4' }}
            labelFormatter={(label) => `Date: ${label}`}
          />
          <Area 
            type="monotone" 
            dataKey="elo" 
            stroke="#3b82f6" 
            strokeWidth={3}
            fill="url(#colorElo)"
            dot={{ r: 4, fill: '#111318', stroke: '#3b82f6', strokeWidth: 2 }}
            activeDot={{ r: 7, fill: '#60a5fa', stroke: '#fff', strokeWidth: 2, className: 'animate-pulse' }}
            animationBegin={300}
            animationDuration={1500}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}
