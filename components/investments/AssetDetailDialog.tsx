"use client";

import { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import { Loader2, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import { getStockHistory, type StockHistoryItem } from "@/utils/financeAPI";
import type { Investment } from "@/types/database";

interface AssetDetailDialogProps {
    investment: Investment | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export default function AssetDetailDialog({
    investment,
    open,
    onOpenChange,
}: AssetDetailDialogProps) {
    const [timeRange, setTimeRange] = useState<"1W" | "1M" | "3M">("1M");
    const [history, setHistory] = useState<StockHistoryItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open && investment) {
            fetchHistory(investment.symbol);
        } else {
            setHistory([]);
            setError(null);
            setTimeRange("1M"); // Reset on close
        }
    }, [open, investment]);

    const fetchHistory = async (symbol: string) => {
        setLoading(true);
        setError(null);
        try {
            const data = await getStockHistory(symbol);
            if (data.length === 0) {
                setError("No se pudieron cargar los datos históricos. Es posible que se haya alcanzado el límite de la API.");
            }
            setHistory(data);
        } catch (err) {
            console.error(err);
            setError("Error al cargar el historial");
        } finally {
            setLoading(false);
        }
    };

    if (!investment) return null;

    // Filter history based on time range
    const getFilteredHistory = () => {
        if (history.length === 0) return [];

        switch (timeRange) {
            case "1W":
                return history.slice(-7); // Last 7 trading days (~1 week)
            case "1M":
                return history.slice(-30); // Last 30 trading days (~1 month +)
            case "3M":
                return history; // All fetched history (capped at 100 in API)
            default:
                return history.slice(-30);
        }
    };

    const chartData = getFilteredHistory();

    // Calculate simple stats from CHART data (to reflect visible range)
    const lastPrice = chartData.length > 0 ? chartData[chartData.length - 1].price : investment.avg_buy_price;
    const startPrice = chartData.length > 0 ? chartData[0].price : lastPrice;
    const periodChange = lastPrice - startPrice;
    const periodChangePercent = startPrice > 0 ? (periodChange / startPrice) * 100 : 0;
    const isPositive = periodChange >= 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <div className="flex items-center justify-between mr-8">
                        <div>
                            <DialogTitle className="flex items-center gap-2 text-xl">
                                {investment.symbol}
                                <span className="text-sm font-normal text-muted-foreground bg-secondary px-2 py-0.5 rounded-md">
                                    {investment.asset_type.toUpperCase()}
                                </span>
                            </DialogTitle>
                            <DialogDescription>
                                {investment.name || "Detalle del activo"}
                            </DialogDescription>
                        </div>
                        <div className="text-right">
                            <p className="text-2xl font-bold">
                                {new Intl.NumberFormat("en-US", {
                                    style: "currency",
                                    currency: "USD",
                                }).format(lastPrice)}
                            </p>
                            {history.length > 0 && (
                                <p className={`flex items-center justify-end gap-1 text-sm ${isPositive ? "text-emerald-500" : "text-rose-500"}`}>
                                    {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                                    {isPositive ? "+" : ""}
                                    {periodChangePercent.toFixed(2)}% (30d)
                                </p>
                            )}
                        </div>
                    </div>
                </DialogHeader>

                <div className="mt-4 min-h-[350px]">
                    <div className="flex justify-end mb-4">
                        <div className="inline-flex bg-secondary p-1 rounded-lg">
                            <button
                                onClick={() => setTimeRange("1W")}
                                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${timeRange === "1W"
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"}`}
                            >
                                1S
                            </button>
                            <button
                                onClick={() => setTimeRange("1M")}
                                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${timeRange === "1M"
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"}`}
                            >
                                1M
                            </button>
                            <button
                                onClick={() => setTimeRange("3M")}
                                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${timeRange === "3M"
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"}`}
                            >
                                3M
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-[300px] gap-2 text-muted-foreground">
                            <Loader2 className="w-8 h-8 animate-spin" />
                            <p>Cargando historial...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center h-[300px] gap-2 text-muted-foreground max-w-sm text-center mx-auto">
                            <AlertCircle className="w-8 h-8 text-amber-500" />
                            <p>{error}</p>
                            <p className="text-xs">La API gratuita tiene un límite de 25 peticiones al día.</p>
                        </div>
                    ) : chartData.length > 0 ? (
                        <div className="w-full h-[300px] min-h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                    <XAxis
                                        dataKey="date"
                                        tickFormatter={(date) => {
                                            const d = new Date(date);
                                            return `${d.getDate()}/${d.getMonth() + 1}`;
                                        }}
                                        stroke="var(--muted-foreground)"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        minTickGap={20}
                                    />
                                    <YAxis
                                        domain={['auto', 'auto']}
                                        tickFormatter={(val) => `$${val}`}
                                        stroke="var(--muted-foreground)"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        width={60}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: "var(--background)",
                                            borderColor: "var(--border)",
                                            borderRadius: "8px",
                                            color: "var(--foreground)",
                                        }}
                                        itemStyle={{ color: "var(--foreground)" }}
                                        labelStyle={{ color: "var(--muted-foreground)" }}
                                        formatter={(value: any) => [`$${Number(value).toFixed(2)}`, "Precio"]}
                                        labelFormatter={(label) => new Date(label).toLocaleDateString()}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="price"
                                        stroke={isPositive ? "#10b981" : "#f43f5e"}
                                        strokeWidth={2}
                                        dot={false}
                                        activeDot={{ r: 4, strokeWidth: 0, fill: isPositive ? "#10b981" : "#f43f5e" }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-[300px]">
                            <p className="text-muted-foreground">No hay datos disponibles</p>
                        </div>
                    )}
                </div>

                {/* Investment Stats */}
                <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">Tu posición</p>
                        <div className="flex justify-between items-baseline">
                            <span className="text-sm">Cantidad</span>
                            <span className="font-mono font-medium">{investment.quantity}</span>
                        </div>
                        <div className="flex justify-between items-baseline mt-1">
                            <span className="text-sm">Precio Medio</span>
                            <span className="font-mono font-medium">${investment.avg_buy_price}</span>
                        </div>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">Valoración</p>
                        <div className="flex justify-between items-baseline">
                            <span className="text-sm">Coste Base</span>
                            <span className="font-mono font-medium">${(investment.quantity * investment.avg_buy_price).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-baseline mt-1">
                            <span className="text-sm">Valor Actual</span>
                            {/* Note: This calculates based on last chart price if available, or static buy price */}
                            <span className="font-mono font-bold">${(investment.quantity * lastPrice).toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
