import { createClient } from "@/utils/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import BudgetCard from "@/components/budgets/BudgetCard";
import BudgetForm from "@/components/budgets/BudgetForm";
import { Wallet } from "lucide-react";
import type { Budget, Category } from "@/types/database";
import { getUserSettings } from "@/actions/settings";
import { getCustomMonthRange } from "@/utils/dateHelpers";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default async function BudgetsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    // 1. Fetch User Settings
    const settings = await getUserSettings();
    const currency = settings?.currency || "EUR";
    const startDay = settings?.start_day_of_month || 1;

    // 2. Calculate Date Range
    const { start, end } = getCustomMonthRange(new Date(), startDay);
    const startOfPeriod = format(start, "yyyy-MM-dd");
    const endOfPeriod = format(end, "yyyy-MM-dd");

    // 3. Fetch Categories
    const { data: categories } = await supabase
        .from("categories")
        .select("*")
        .eq("user_id", user.id);

    // 4. Fetch Budgets
    const { data: budgets } = await supabase
        .from("budgets")
        .select(`
            *,
            category:categories(*)
        `)
        .eq("user_id", user.id);

    // 5. Fetch expenses for current CUSTOM period
    const { data: rawExpenses, error: expensesError } = await supabase
        .from("transactions")
        .select("amount, category_id, date, categories!inner(type)")
        .eq("user_id", user.id)
        .gte("date", startOfPeriod)
        .lte("date", endOfPeriod);

    if (expensesError) {
        console.error("Error fetching expenses:", expensesError);
    }

    // Filter for expenses
    const expenses = rawExpenses?.filter((tx: any) => tx.categories?.type === 'expense') || [];

    // 6. Calculate progress per category
    const spendingMap = new Map<string, number>();

    expenses?.forEach((tx) => {
        if (tx.category_id) {
            const current = spendingMap.get(tx.category_id) || 0;
            spendingMap.set(tx.category_id, current + Number(tx.amount));
        }
    });

    // 7. Combine and Sort
    const budgetItems = (budgets as Budget[] || []).map((budget) => {
        const rawSpent = spendingMap.get(budget.category_id) || 0;
        const spent = Math.abs(rawSpent);
        const limit = budget.amount_limit;
        const percentage = (spent / limit) * 100;

        return {
            ...budget,
            spent,
            percentage,
        };
    }).sort((a, b) => b.percentage - a.percentage);

    // Calculate total stats
    const totalBudget = budgetItems.reduce((acc, b) => acc + b.amount_limit, 0);
    const totalSpent = budgetItems.reduce((acc, b) => acc + b.spent, 0);
    const totalProgress = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Presupuestos Mensuales</h1>
                    <p className="text-muted-foreground flex items-center gap-1">
                        Periodo: {format(start, "d MMM", { locale: es })} - {format(end, "d MMM", { locale: es })}
                    </p>
                </div>
                <BudgetForm categories={categories as Category[] || []} />
            </div>

            {/* Global Summary */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Presupuesto Total</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {new Intl.NumberFormat("es-ES", { style: "currency", currency: currency }).format(totalSpent)}
                            <span className="text-muted-foreground text-sm font-normal ml-2">
                                / {new Intl.NumberFormat("es-ES", { style: "currency", currency: currency }).format(totalBudget)}
                            </span>
                        </div>
                        <Progress value={totalProgress} className="h-2 mt-4" />
                        <p className="text-xs text-muted-foreground mt-2">
                            Has gastado el {totalProgress.toFixed(0)}% de tu presupuesto global
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Budget List */}
            {budgetItems.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                        <Wallet className="w-10 h-10 text-muted-foreground mb-4 opacity-50" />
                        <p className="font-medium">No tienes presupuestos definidos</p>
                        <p className="text-sm text-muted-foreground mt-1 mb-4">
                            Crea un presupuesto para controlar tus gastos
                        </p>
                        <BudgetForm categories={categories as Category[] || []} />
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {budgetItems.map((item) => (
                        <BudgetCard
                            key={item.id}
                            budget={item}
                            currentSpent={item.spent}
                            categoryName={item.category?.name || "Sin categoría"}
                            categoryIcon={item.category?.icon || "📁"}
                            categories={categories as Category[] || []}
                            currency={currency}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
