import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { ChartWrapper } from './ChartWrapper';

interface Props {
  stats: {
    wins: number;
    losses: number;
  };
}

const COLORS = ['#3b82f6', '#ef4444'];

export function MatchesPieChart({ stats }: Props) {
  const data = [
    { name: 'Wins', value: stats.wins },
    { name: 'Losses', value: stats.losses },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return (
      <ChartWrapper title="Total 2-Player Matches">
        <div className="text-text-secondary text-sm">No matches played</div>
      </ChartWrapper>
    );
  }

  return (
    <ChartWrapper title="Total 2-Player Matches">
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={0}
            outerRadius={100}
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
            contentStyle={{ backgroundColor: '#111318', borderColor: '#1f232b', borderRadius: '8px' }}
            itemStyle={{ color: '#e2e8f0' }}
          />
          <Legend verticalAlign="bottom" height={36} iconType="circle" />
        </PieChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}
