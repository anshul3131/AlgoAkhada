import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { ChartWrapper } from './ChartWrapper';

interface Props {
  stats: {
    accepted: number;
    wrongAnswer: number;
    timeLimitExceeded: number;
    runtimeError: number;
    other: number;
  };
}

const COLORS = ['#22c55e', '#ef4444', '#f59e0b', '#8b5cf6', '#64748b'];

export function SubmissionsPieChart({ stats }: Props) {
  const data = [
    { name: 'Accepted', value: stats.accepted },
    { name: 'Wrong Answer', value: stats.wrongAnswer },
    { name: 'Time Limit', value: stats.timeLimitExceeded },
    { name: 'Runtime Error', value: stats.runtimeError },
    { name: 'Other', value: stats.other },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return (
      <ChartWrapper title="Total Submissions">
        <div className="text-text-secondary text-sm">No submissions yet</div>
      </ChartWrapper>
    );
  }

  return (
    <ChartWrapper title="Total Submissions">
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={5}
            dataKey="value"
            animationBegin={0}
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
