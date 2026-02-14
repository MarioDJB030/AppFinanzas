"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { Budget } from "@/types/database";
import { AlertCircle, CheckCircle2, AlertTriangle } from "lucide-react";
import BudgetForm from "./BudgetForm";

interface BudgetCardProps {
    budget: Budget;
    currentSpent: number;
    categoryName: string;
    categoryIcon: string;
    categories: any[];
    currency?: string;
}

export default function BudgetCard({
    budget,
    currentSpent,
    categoryName,
    categoryIcon,
    categories,
    currency = "EUR"
}: BudgetCardProps) {
    const limit = budget.amount_limit;
    const percentage = Math.min((currentSpent / limit) * 100, 100);
    const remaining = limit - currentSpent;
    const isOverBudget = remaining < 0;

    // Traffic light logic
    let statusColor = "bg-emerald-500";
    let statusText = "text-emerald-500";
    let Icon = CheckCircle2;

    if (percentage >= 100) {
        statusColor = "bg-rose-500";
        statusText = "text-rose-500";
        Icon = AlertCircle;
    } else if (percentage >= 80) {
        statusColor = "bg-amber-500";
        statusText = "text-amber-500";
        Icon = AlertTriangle;
    }

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat("es-ES", {
            style: "currency",
            currency: currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(Math.abs(value));

    return (
        <BudgetForm
            categories={categories}
            existingBudget={budget}
            trigger={
                <Card
                    className={`transition-all hover:shadow-md cursor-pointer text-left ${percentage >= 100 ? "border-rose-500/50 bg-rose-500/5" : ""
                        }`}
                >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <span className="text-xl">{categoryIcon}</span>
                            {categoryName}
                        </CardTitle>
                        <Badge variant={percentage >= 100 ? "destructive" : "secondary"} className="font-mono">
                            {percentage.toFixed(0)}%
                        </Badge>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {/* Progress Bar */}
                            <Progress value={percentage} className={`h-2 ${statusColor}`} />

                            {/* Stats */}
                            <div className="flex justify-between items-end text-sm">
                                <div>
                                    <p className="text-muted-foreground">Gastado</p>
                                    <p className="font-bold text-lg">{formatCurrency(currentSpent)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-muted-foreground">Límite</p>
                                    <p className="font-medium">{formatCurrency(limit)}</p>
                                </div>
                            </div>

                            {/* Status Text */}
                            <div className={`flex items-center gap-2 text-xs font-medium ${statusText}`}>
                                <Icon className="w-3 h-3" />
                                {isOverBudget
                                    ? `Te has pasado ${formatCurrency(remaining)}`
                                    : `Te quedan ${formatCurrency(remaining)}`
                                }
                            </div>
                        </div>
                    </CardContent>
                </Card>
            }
        />
    );
}
