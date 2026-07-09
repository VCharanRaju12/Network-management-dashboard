import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { Metric } from "../api/client";

export function MetricChart({
  metrics,
  metricType,
  label,
  color,
  unit = "",
}: {
  metrics: Metric[];
  metricType: string;
  label: string;
  color: string;
  unit?: string;
}) {
  const series = metrics
    .filter((m) => m.metric_type === metricType)
    .slice()
    .reverse()
    .map((m) => ({
      time: new Date(m.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      value: m.value,
    }));

  if (series.length < 2) {
    return (
      <div className="bg-surface border border-border rounded-xl p-4">
        <p className="text-xs text-muted mb-1">{label}</p>
        <p className="text-xs text-muted py-8 text-center">
          Not enough data yet — check back after a few more poll cycles.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <p className="text-xs text-muted mb-2">{label}</p>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={series} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="#232938" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10, fill: "#8892A6" }}
            axisLine={{ stroke: "#232938" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#8892A6" }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip
            contentStyle={{
              background: "#131822",
              border: "1px solid #232938",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "#8892A6" }}
            formatter={(value) => [`${Number(value).toFixed(1)}${unit}`, label]}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
