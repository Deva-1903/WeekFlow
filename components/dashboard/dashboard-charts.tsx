"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  completionData: { date: string; completed: number }[];
}

export function DashboardCharts({ completionData }: Props) {
  const chartData = completionData.map((d) => ({
    day: format(parseISO(d.date), "EEE"),
    completed: d.completed,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Tasks Completed — Last 7 Days</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "12px" }}
              cursor={{ fill: "#f1f5f9" }}
            />
            <Bar dataKey="completed" fill="#6366f1" radius={[3, 3, 0, 0]} name="Completed" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
