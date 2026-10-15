import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartWrapper } from './ChartWrapper';
import { useTheme } from '../../../hooks/useTheme';

interface Props {
  history: Array<{ date: string; elo: number }>;
}

export function EloLineChart({ history }: Props) {
  const { isDark } = useTheme();
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

  const accentColor = isDark ? '#00FF9C' : '#059669';
  const activeDotFill = isDark ? '#34D399' : '#047857';

  return (
    <ChartWrapper title="Elo Rating Over Time">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorElo" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={accentColor} stopOpacity={0.5}/>
              <stop offset="95%" stopColor={accentColor} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1f232b" : "#e2e8f0"} vertical={false} />
          <XAxis 
            dataKey="displayDate" 
            stroke={isDark ? "#64748b" : "#94a3b8"} 
            fontSize={12} 
            tickLine={false} 
            axisLine={false}
            minTickGap={30}
            tickFormatter={(value) => value.split(' ')[0] + ' ' + value.split(' ')[1]} // Only show day and month on axis
          />
          <YAxis 
            domain={[minElo - 50, maxElo + 50]} 
            stroke={isDark ? "#64748b" : "#94a3b8"} 
            fontSize={12} 
            tickLine={false} 
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: isDark ? '#111318' : '#ffffff',
              borderColor: accentColor,
              borderRadius: '8px',
              boxShadow: isDark ? '0 0 15px rgba(0, 255, 156, 0.25)' : '0 4px 20px rgba(5, 150, 105, 0.15)'
            }}
            itemStyle={{ color: accentColor, fontWeight: 'bold' }}
            labelStyle={{ color: isDark ? '#94a3b8' : '#64748b', marginBottom: '4px' }}
            cursor={{ stroke: accentColor, strokeWidth: 1, strokeDasharray: '4 4' }}
            labelFormatter={(label) => `Date: ${label}`}
          />
          <Area 
            type="monotone" 
            dataKey="elo" 
            stroke={accentColor} 
            strokeWidth={3}
            fill="url(#colorElo)"
            dot={{ r: 4, fill: isDark ? '#111318' : '#ffffff', stroke: accentColor, strokeWidth: 2 }}
            activeDot={{ r: 7, fill: activeDotFill, stroke: '#fff', strokeWidth: 2, className: 'animate-pulse' }}
            animationBegin={300}
            animationDuration={1500}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}
