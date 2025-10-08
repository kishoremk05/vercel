import React from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";

interface FeedbackAnalyticsProps {
  data: Array<{
    date: string;
    positive: number;
    negative: number;
  }>;
  totalPositive: number;
  totalNegative: number;
}

const COLORS = ["#4CAF50", "#F44336"];

const FeedbackAnalytics: React.FC<FeedbackAnalyticsProps> = ({
  data,
  totalPositive,
  totalNegative,
}) => {
  const pieData = [
    { name: "Positive", value: totalPositive },
    { name: "Negative", value: totalNegative },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-8">
      <h3 className="text-lg font-bold mb-4">Feedback Analytics</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Pie Chart */}
        <div>
          <h4 className="font-semibold mb-2">Feedback Sentiment</h4>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={70}
                label
              >
                {pieData.map((entry, idx) => (
                  <Cell
                    key={`cell-${idx}`}
                    fill={COLORS[idx % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        {/* Timeline Graph */}
        <div>
          <h4 className="font-semibold mb-2">Feedback Over Time</h4>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={data}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="positive"
                stroke="#4CAF50"
                name="Positive"
              />
              <Line
                type="monotone"
                dataKey="negative"
                stroke="#F44336"
                name="Negative"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default FeedbackAnalytics;
