import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { ChartWrapper } from './ChartWrapper';
import { useTheme } from '../../../hooks/useTheme';

interface Props {
  stats: {
    wins: number;
    losses: number;
  };
}

export function MatchesPieChart({ stats }: Props) {
  const { isDark } = useTheme();
  const winColor = isDark ? '#00FF9C' : '#059669';
  const COLORS = [winColor, '#ef4444'];
  const data = [
    { name: 'Wins', value: stats.wins },
    { name: 'Losses', value: stats.losses },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return (
      <ChartWrapper title="Total 2-Player Matches" height={200}>
        <div className="text-text-secondary text-sm">No matches played</div>
      </ChartWrapper>
    );
  }

  return (
    <ChartWrapper title="Total 2-Player Matches" height={200}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="45%"
            innerRadius={0}
            outerRadius="95%"
            paddingAngle={2}
            dataKey="value"
            animationBegin={200}
            animationDuration={1500}
            animationEasing="ease-out"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="hover:opacity-80 transition-opacity" />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{
              backgroundColor: isDark ? '#111318' : '#ffffff',
              borderColor: isDark ? '#1f232b' : '#e2e8f0',
              borderRadius: '8px',
              boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.5)' : '0 4px 12px rgba(0,0,0,0.08)'
            }}
            itemStyle={{ color: isDark ? '#e2e8f0' : '#1f2328' }}
          />
          <Legend verticalAlign="bottom" height={36} iconType="circle" />
        </PieChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}
