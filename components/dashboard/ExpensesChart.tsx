"use client";

import { useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { PieChart as PieChartIcon } from "lucide-react";
import CategoryForm from "@/components/categories/CategoryForm";

interface ExpenseData {
    category: string;
    icon: string;
    amount: number;
    percentage: number;
}

interface ExpensesChartProps {
    data: ExpenseData[];
    totalExpenses: number;
    currency?: string;
}

const COLORS = [
    "#3b82f6", // blue
    "#10b981", // emerald
    "#f59e0b", // amber
    "#ef4444", // red
    "#8b5cf6", // violet
    "#ec4899", // pink
    "#06b6d4", // cyan
    "#84cc16", // lime
];

export default function ExpensesChart({ data, totalExpenses, currency = "EUR" }: ExpensesChartProps) {
    const [excludedCategories, setExcludedCategories] = useState<Set<string>>(new Set());

    const formattedTotal = new Intl.NumberFormat("es-ES", {
        style: "currency",
        currency: currency,
    }).format(totalExpenses);

    const toggleCategory = (category: string) => {
        const newExcluded = new Set(excludedCategories);
        if (newExcluded.has(category)) {
            newExcluded.delete(category);
        } else {
            newExcluded.add(category);
        }
        setExcludedCategories(newExcluded);
    };

    const activeData = data.filter(item => !excludedCategories.has(item.category));

    if (data.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            <PieChartIcon className="w-5 h-5 text-muted-foreground" />
                            Gastos por Categoría
                        </span>
                        <CategoryForm type="expense" />
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                    <PieChartIcon className="w-12 h-12 mb-4 opacity-50" />
                    <p>No hay gastos registrados</p>
                    <p className="text-sm mt-2">Crea categorías para organizar tus gastos</p>
                </CardContent>
            </Card>
        );
    }

    const renderLegend = (props: any) => {
        const { payload } = props;
        return (
            <ul className="flex flex-wrap justify-center gap-4 mt-4">
                {payload.map((entry: any, index: number) => {
                    const isExcluded = excludedCategories.has(entry.value);
                    return (
                        <li
                            key={`item-${index}`}
                            className={`flex items-center cursor-pointer transition-colors ${isExcluded ? 'opacity-50 line-through text-muted-foreground' : 'text-foreground'}`}
                            onClick={() => toggleCategory(entry.value)}
                        >
                            <span
                                className="w-3 h-3 mr-2 inline-block rounded-sm"
                                style={{ backgroundColor: entry.color }}
                            />
                            <span className="text-sm">
                                {entry.value}
                            </span>
                        </li>
                    );
                })}
            </ul>
        );
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <PieChartIcon className="w-5 h-5 text-muted-foreground" />
                        Gastos por Categoría
                    </span>
                    <span className="text-sm font-normal text-muted-foreground">
                        Total: {formattedTotal}
                    </span>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="w-full h-[300px] md:h-[400px] min-h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={activeData}
                                cx="50%"
                                cy="50%"
                                innerRadius="60%"
                                outerRadius="80%"
                                paddingAngle={2}
                                dataKey="amount"
                                nameKey="category"
                            >
                                {activeData.map((entry, index) => {
                                    // Find original index to maintain consistent colors
                                    const originalIndex = data.findIndex(d => d.category === entry.category);
                                    return (
                                        <Cell
                                            key={`cell-${entry.category}`}
                                            fill={COLORS[originalIndex % COLORS.length]}
                                            className="stroke-background stroke-2 cursor-pointer"
                                            onClick={() => toggleCategory(entry.category)}
                                        />
                                    );
                                })}
                            </Pie>
                            <Tooltip
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const data = payload[0].payload;
                                        return (
                                            <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
                                                <p className="font-medium">{data.category}</p>
                                                <p className="text-muted-foreground">
                                                    {new Intl.NumberFormat("es-ES", {
                                                        style: "currency",
                                                        currency: currency,
                                                    }).format(data.amount)}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {data.percentage.toFixed(1)}%
                                                </p>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Legend
                                content={renderLegend}
                                // @ts-ignore
                                payload={
                                    data.map((item, index) => ({
                                        id: item.category,
                                        type: "square",
                                        value: item.category,
                                        color: excludedCategories.has(item.category) ? "#666" : COLORS[index % COLORS.length]
                                    }))
                                }
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
