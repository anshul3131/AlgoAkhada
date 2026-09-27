import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { ChartWrapper } from './ChartWrapper';

interface Props {
  stats: Record<string, number>;
}

// Generate nice distinct colors for topics
const generateColors = (count: number) => {
  const baseColors = ['#f43f5e', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#0ea5e9', '#84cc16'];
  return Array.from({ length: count }, (_, i) => baseColors[i % baseColors.length]);
};

export function TopicsPieChart({ stats }: Props) {
  // Sort and take top 8 topics to avoid clutter, put rest in "Other"
  const sortedEntries = Object.entries(stats).sort((a, b) => b[1] - a[1]);
  const topEntries = sortedEntries.slice(0, 7);
  const otherSum = sortedEntries.slice(7).reduce((acc, curr) => acc + curr[1], 0);
  
  const data = [...topEntries.map(([name, value]) => ({ name, value }))];
  if (otherSum > 0) {
    data.push({ name: 'other', value: otherSum });
  }

  const COLORS = generateColors(data.length);

  if (data.length === 0) {
    return (
      <ChartWrapper title="Accepted By Topic">
        <div className="text-text-secondary text-sm">No solved problems</div>
      </ChartWrapper>
    );
  }

  return (
    <ChartWrapper title="Accepted By Topic">
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            animationBegin={400}
            animationDuration={1500}
            animationEasing="ease-out"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index]} className="hover:opacity-80 transition-opacity" />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ backgroundColor: '#111318', borderColor: '#1f232b', borderRadius: '8px' }}
            itemStyle={{ color: '#e2e8f0' }}
            formatter={(value: any, name: any) => [value, String(name).charAt(0).toUpperCase() + String(name).slice(1)]}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}
