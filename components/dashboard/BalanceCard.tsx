"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Wallet, TrendingUp, TrendingDown } from "lucide-react";

interface BalanceCardProps {
    title: string;
    amount: number;
    type: "total" | "income" | "expense";
    icon: "wallet" | "trending-up" | "trending-down";
    currency?: string;
}

const iconMap = {
    wallet: Wallet,
    "trending-up": TrendingUp,
    "trending-down": TrendingDown,
};

const colorMap = {
    total: "from-blue-500/10 to-blue-600/5 text-blue-500",
    income: "from-emerald-500/10 to-emerald-600/5 text-emerald-500",
    expense: "from-rose-500/10 to-rose-600/5 text-rose-500",
};

const iconBgMap = {
    total: "bg-blue-500/10",
    income: "bg-emerald-500/10",
    expense: "bg-rose-500/10",
};

export default function BalanceCard({ title, amount, type, icon, currency = "EUR" }: BalanceCardProps) {
    const Icon = iconMap[icon];
    const colorClass = colorMap[type];
    const iconBgClass = iconBgMap[type];

    const formattedAmount = new Intl.NumberFormat("es-ES", {
        style: "currency",
        currency: currency,
        minimumFractionDigits: 2,
    }).format(amount);

    return (
        <Card className={`overflow-hidden bg-gradient-to-br ${colorClass} border-0`}>
            <CardContent className="p-6">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">{title}</p>
                        <p className="text-2xl font-bold">{formattedAmount}</p>
                    </div>
                    <div className={`p-3 rounded-xl ${iconBgClass}`}>
                        <Icon className="w-6 h-6" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
