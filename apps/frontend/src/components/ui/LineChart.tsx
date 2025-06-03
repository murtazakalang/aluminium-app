import React, { ReactNode } from 'react';
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface LineChartProps {
  data: Record<string, unknown>[];
  xAxisKey: string;
  yAxisKey: string | string[];
  title?: string;
  height?: number;
  className?: string;
  colors?: string[];
  formatTooltip?: (value: number | string, name: string) => [ReactNode, string];
  formatYAxis?: (value: number | string) => string;
  formatXAxis?: (value: number | string) => string;
  strokeWidth?: number;
}

export default function LineChart({
  data,
  xAxisKey,
  yAxisKey,
  title,
  height = 300,
  className = '',
  colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'],
  formatTooltip,
  formatYAxis,
  formatXAxis,
  strokeWidth = 2,
}: LineChartProps) {
  const yAxisKeys = Array.isArray(yAxisKey) ? yAxisKey : [yAxisKey];

  return (
    <div className={`w-full ${className}`}>
      {title && (
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsLineChart
          data={data}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis 
            dataKey={xAxisKey}
            tickFormatter={formatXAxis}
            className="text-sm text-gray-600"
          />
          <YAxis 
            tickFormatter={formatYAxis}
            className="text-sm text-gray-600"
          />
          <Tooltip
            formatter={formatTooltip}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            }}
          />
          {yAxisKeys.length > 1 && <Legend />}
          {yAxisKeys.map((key, index) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={colors[index % colors.length]}
              strokeWidth={strokeWidth}
              dot={{ fill: colors[index % colors.length], strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
} 