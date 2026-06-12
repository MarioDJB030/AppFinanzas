import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";
import { ArrowRight, AlertTriangle, CheckCircle2, AlertCircle } from "lucide-react";
import type { Budget } from "@/types/database";

interface BudgetSummaryProps {
    currency?: string;
    budgets: any[]; // Or Budget[] if type matches
    transactions: any[];
}

export default function BudgetSummary({ currency = "EUR", budgets, transactions }: BudgetSummaryProps) {
    if (!budgets || budgets.length === 0) return null;

    // 1. Filter expenses for the current month
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const startOfMonth = `${year}-${month}-01`;
    // Approximate end of month filter is not strictly needed if transactions are already filtered,
    // but assuming transactions passed are for the period or we filter them here.
    // For simplicity, let's filter the transactions passed to those in the current month.
    
    const expenses = transactions?.filter((tx: any) => 
        tx.category?.type === 'expense' && 
        tx.date >= startOfMonth
    ) || [];

    // 2. Sum expenses by category
    const spendingMap = new Map<string, number>();

    expenses.forEach((tx) => {
        if (tx.category_id) {
            const current = spendingMap.get(tx.category_id) || 0;
            spendingMap.set(tx.category_id, current + Math.abs(Number(tx.amount)));
        }
    });

    // 3. Process and Sort
    const budgetItems = (budgets as Budget[]).map((budget) => {
        const spent = spendingMap.get(budget.category_id) || 0;
        const limit = budget.amount_limit;
        const percentage = (spent / limit) * 100;

        return {
            ...budget,
            spent,
            percentage,
        };
    })
        .sort((a, b) => b.percentage - a.percentage) // Highest risk first
        .slice(0, 3); // Top 3

    return (
        <Card className="col-span-1">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-base font-semibold">Presupuestos en Riesgo</CardTitle>
                <Link
                    href="/budgets"
                    className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1"
                >
                    Ver todos <ArrowRight className="w-4 h-4" />
                </Link>
            </CardHeader>
            <CardContent className="space-y-4">
                {budgetItems.map((item) => {
                    let statusColor = "bg-emerald-500";
                    let Icon = CheckCircle2;
                    let iconColor = "text-emerald-500";

                    if (item.percentage >= 100) {
                        statusColor = "bg-rose-500";
                        Icon = AlertCircle;
                        iconColor = "text-rose-500";
                    } else if (item.percentage >= 80) {
                        statusColor = "bg-amber-500";
                        Icon = AlertTriangle;
                        iconColor = "text-amber-500";
                    }

                    return (
                        <div key={item.id} className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                    <span className="text-lg">{item.category?.icon || "📁"}</span>
                                    <span className="font-medium">{item.category?.name}</span>
                                </div>
                                <div className="text-muted-foreground font-mono text-xs">
                                    {new Intl.NumberFormat("es-ES", { style: "currency", currency: currency }).format(item.spent)}
                                    {" / "}
                                    {new Intl.NumberFormat("es-ES", { style: "currency", currency: currency }).format(item.amount_limit)}
                                </div>
                            </div>
                            <Progress value={Math.min(item.percentage, 100)} className={`h-2 ${statusColor}`} />
                        </div>
                    );
                })}
                {budgetItems.length === 0 && (
                    <p className="text-sm text-muted-foreground">No tienes presupuestos activos.</p>
                )}
            </CardContent>
        </Card>
    );
}
