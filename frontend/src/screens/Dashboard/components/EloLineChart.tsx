import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartWrapper } from './ChartWrapper';

interface Props {
  history: Array<{ date: string; elo: number }>;
}

export function EloLineChart({ history }: Props) {
  // Format dates nicely for X axis
  const data = history.map((point) => {
    const d = new Date(point.date);
    return {
      date: `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`,
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
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorElo" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f232b" vertical={false} />
          <XAxis 
            dataKey="date" 
            stroke="#64748b" 
            fontSize={12} 
            tickLine={false} 
            axisLine={false}
            minTickGap={30}
          />
          <YAxis 
            domain={[minElo - 50, maxElo + 50]} 
            stroke="#64748b" 
            fontSize={12} 
            tickLine={false} 
            axisLine={false}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#111318', borderColor: '#1f232b', borderRadius: '8px' }}
            itemStyle={{ color: '#3b82f6', fontWeight: 'bold' }}
            labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
          />
          <Line 
            type="monotone" 
            dataKey="elo" 
            stroke="#3b82f6" 
            strokeWidth={3}
            dot={{ r: 4, fill: '#111318', stroke: '#3b82f6', strokeWidth: 2 }}
            activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
            animationBegin={600}
            animationDuration={2000}
            animationEasing="ease-out"
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}
