"use client";

import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet, PiggyBank } from "lucide-react";

interface PortfolioSummaryProps {
    totalValue: number;
    totalCost: number;
    totalGain: number;
    totalGainPercent: number;
}

export default function PortfolioSummary({
    totalValue,
    totalCost,
    totalGain,
    totalGainPercent,
}: PortfolioSummaryProps) {
    const isPositive = totalGain >= 0;

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat("es-ES", {
            style: "currency",
            currency: "EUR",
            minimumFractionDigits: 2,
        }).format(value);

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Total Value */}
            <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-0">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">
                                Valor Total
                            </p>
                            <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-blue-500/10">
                            <Wallet className="w-6 h-6 text-blue-500" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Total Cost */}
            <Card className="bg-gradient-to-br from-violet-500/10 to-violet-600/5 border-0">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">
                                Coste Total
                            </p>
                            <p className="text-2xl font-bold">{formatCurrency(totalCost)}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-violet-500/10">
                            <PiggyBank className="w-6 h-6 text-violet-500" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Total Gain */}
            <Card
                className={`bg-gradient-to-br ${isPositive
                        ? "from-emerald-500/10 to-emerald-600/5"
                        : "from-rose-500/10 to-rose-600/5"
                    } border-0`}
            >
                <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">
                                Ganancia/Pérdida
                            </p>
                            <p
                                className={`text-2xl font-bold ${isPositive ? "text-emerald-500" : "text-rose-500"
                                    }`}
                            >
                                {isPositive ? "+" : ""}
                                {formatCurrency(totalGain)}
                            </p>
                        </div>
                        <div
                            className={`p-3 rounded-xl ${isPositive ? "bg-emerald-500/10" : "bg-rose-500/10"
                                }`}
                        >
                            {isPositive ? (
                                <TrendingUp className="w-6 h-6 text-emerald-500" />
                            ) : (
                                <TrendingDown className="w-6 h-6 text-rose-500" />
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Percent Change */}
            <Card
                className={`bg-gradient-to-br ${isPositive
                        ? "from-emerald-500/10 to-emerald-600/5"
                        : "from-rose-500/10 to-rose-600/5"
                    } border-0`}
            >
                <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">
                                Rentabilidad
                            </p>
                            <p
                                className={`text-2xl font-bold ${isPositive ? "text-emerald-500" : "text-rose-500"
                                    }`}
                            >
                                {isPositive ? "+" : ""}
                                {totalGainPercent.toFixed(2)}%
                            </p>
                        </div>
                        <div
                            className={`p-3 rounded-xl ${isPositive ? "bg-emerald-500/10" : "bg-rose-500/10"
                                }`}
                        >
                            {isPositive ? (
                                <TrendingUp className="w-6 h-6 text-emerald-500" />
                            ) : (
                                <TrendingDown className="w-6 h-6 text-rose-500" />
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
