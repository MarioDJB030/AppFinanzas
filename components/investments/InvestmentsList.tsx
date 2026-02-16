"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    MoreVertical,
    Trash2,
    TrendingUp,
    TrendingDown,
    LineChart,
    Coins,
    RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import type { Investment } from "@/types/database";
import AssetDetailDialog from "./AssetDetailDialog";
import { getStockQuote } from "@/utils/financeAPI";

interface InvestmentWithValues extends Investment {
    currentPrice: number;
    value: number;
    gain: number;
    gainPercent: number;
}

interface InvestmentsListProps {
    investments: InvestmentWithValues[];
}

const typeLabels: Record<string, { label: string; color: string }> = {
    stock: { label: "Acción", color: "bg-blue-500/10 text-blue-500" },
    crypto: { label: "Cripto", color: "bg-amber-500/10 text-amber-500" },
    etf: { label: "ETF", color: "bg-violet-500/10 text-violet-500" },
    bond: { label: "Bono", color: "bg-emerald-500/10 text-emerald-500" },
    other: { label: "Otro", color: "bg-zinc-500/10 text-zinc-500" },
};

export default function InvestmentsList({ investments: initialInvestments }: InvestmentsListProps) {
    const router = useRouter();
    const supabase = createClient();
    const [updating, setUpdating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [selectedInvestment, setSelectedInvestment] = useState<InvestmentWithValues | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    const handleDelete = async (investmentId: string) => {
        try {
            const { error } = await supabase
                .from("investments")
                .delete()
                .eq("id", investmentId);

            if (error) throw error;

            toast.success("Inversión eliminada");
            router.refresh();
        } catch (error) {
            toast.error("Error al eliminar");
            console.error(error);
        }
    };

    const handleUpdatePrices = async () => {
        setUpdating(true);
        toast.info("Actualizando precios (esto tomará unos segundos para respetar límites)...");

        let updatedCount = 0;
        const total = initialInvestments.length;

        for (let i = 0; i < total; i++) {
            const inv = initialInvestments[i];
            setProgress(((i + 1) / total) * 100);

            try {
                // Fetch quote
                const quote = await getStockQuote(inv.symbol);

                if (quote && quote.price > 0) {
                    // Update DB
                    await supabase
                        .from("investments")
                        .update({
                            current_price: quote.price,
                            last_updated: new Date().toISOString()
                        })
                        .eq("id", inv.id);
                    updatedCount++;
                }
            } catch (error) {
                console.warn(`Failed to update ${inv.symbol}`, error);
            }

            // Delay between requests to respect API limits (12s for safe side with 5 calls/min limit)
            if (i < total - 1) {
                await new Promise(resolve => setTimeout(resolve, 12000));
            }
        }

        setUpdating(false);
        setProgress(0);
        toast.success(`Actualizados ${updatedCount} de ${total} activos.`);
        router.refresh();
    };

    const formatCurrency = (value: number, currency: string = "EUR") =>
        new Intl.NumberFormat("es-ES", {
            style: "currency",
            currency,
            minimumFractionDigits: 2,
        }).format(value);

    const handleRowClick = (investment: InvestmentWithValues) => {
        setSelectedInvestment(investment);
        setIsDetailOpen(true);
    };

    if (initialInvestments.length === 0) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <LineChart className="w-16 h-16 mb-4 opacity-50" />
                    <p className="text-lg font-medium">No hay inversiones</p>
                    <p className="text-sm mt-1">
                        Añade tu primera inversión para empezar a rastrear tu portafolio
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <Coins className="w-5 h-5 text-muted-foreground" />
                        Mis Inversiones
                    </CardTitle>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleUpdatePrices}
                        disabled={updating}
                        className="gap-2"
                    >
                        <RefreshCw className={`w-3 h-3 ${updating ? "animate-spin" : ""}`} />
                        {updating ? `Actualizando ${Math.round(progress)}%` : "Actualizar Precios"}
                    </Button>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto pb-2">
                        <div className="space-y-3 min-w-max">
                            {initialInvestments.map((investment) => {
                                const isPositive = investment.gain >= 0;
                                const typeInfo = typeLabels[investment.asset_type] || typeLabels.other;

                                // Check if price is stale (older than 24h)
                                const lastUpdated = investment.last_updated ? new Date(investment.last_updated) : null;
                                const isStale = !lastUpdated || (new Date().getTime() - lastUpdated.getTime() > 24 * 60 * 60 * 1000);

                                return (
                                    <div
                                        key={investment.id}
                                        className="flex items-center justify-between p-4 rounded-xl bg-accent/30 hover:bg-accent/50 transition-colors cursor-pointer"
                                        onClick={() => handleRowClick(investment)}
                                    >
                                        <div className="flex items-center gap-4">
                                            {/* Symbol Badge */}
                                            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                                                <span className="text-sm font-bold text-primary">
                                                    {investment.symbol.slice(0, 3).toUpperCase()}
                                                </span>
                                            </div>

                                            {/* Info */}
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-semibold">{investment.symbol}</p>
                                                    <Badge className={typeInfo.color} variant="secondary">
                                                        {typeInfo.label}
                                                    </Badge>
                                                    {isStale && (
                                                        <span className="text-[10px] text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">
                                                            Desactualizado
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                                                    <span>{investment.quantity} unidades</span>
                                                    <span>·</span>
                                                    <span>
                                                        Avg: {formatCurrency(investment.avg_buy_price, investment.currency)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Values */}
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <p className="font-semibold">
                                                    {formatCurrency(investment.value, investment.currency)}
                                                </p>
                                                <div
                                                    className={`flex items-center justify-end gap-1 text-sm ${isPositive ? "text-emerald-500" : "text-rose-500"
                                                        }`}
                                                >
                                                    {isPositive ? (
                                                        <TrendingUp className="w-3 h-3" />
                                                    ) : (
                                                        <TrendingDown className="w-3 h-3" />
                                                    )}
                                                    <span>
                                                        {isPositive ? "+" : ""}
                                                        {investment.gainPercent.toFixed(2)}%
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <div className="text-right text-sm text-muted-foreground">
                                                    <p>Precio</p>
                                                    <p className="font-medium text-foreground">
                                                        {formatCurrency(investment.currentPrice || investment.avg_buy_price, investment.currency)}
                                                    </p>
                                                </div>

                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                            <MoreVertical className="w-4 h-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDelete(investment.id);
                                                            }}
                                                            className="text-destructive"
                                                        >
                                                            <Trash2 className="w-4 h-4 mr-2" />
                                                            Eliminar
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <AssetDetailDialog
                investment={selectedInvestment}
                open={isDetailOpen}
                onOpenChange={setIsDetailOpen}
            />
        </>
    );
}
