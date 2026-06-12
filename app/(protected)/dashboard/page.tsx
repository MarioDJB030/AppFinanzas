import { createClientWithUser } from "@/utils/supabase/server";
import { checkForRecurringPayments } from "@/utils/recurringPayments";
import { ensureUserHasCategories } from "@/utils/defaultCategories";
import BalanceCard from "@/components/dashboard/BalanceCard";
import ExpensesChart from "@/components/dashboard/ExpensesChart";
import RecentTransactions from "@/components/dashboard/RecentTransactions";
import BudgetSummary from "@/components/dashboard/BudgetSummary";
import DashboardGoal from "@/components/dashboard/DashboardGoal";
import QuickActions from "@/components/dashboard/QuickActions";
import AiAdvisor from "@/components/dashboard/AiAdvisor";
import { getUserSettings } from "@/actions/settings";

export default async function DashboardPage() {
    const { supabase, user } = await createClientWithUser();

    if (!user) {
        return null;
    }

    // Fire-and-forget: ensure categories and check recurring payments in background
    // (We don't await them to unblock rendering)
    ensureUserHasCategories(supabase, user.id).catch(console.error);
    checkForRecurringPayments(supabase, user.id).catch(console.error);

    // Parallelize all data fetching
    const [
        settings,
        { data: accounts },
        { data: transactions },
        { data: categories },
        { data: budgets },
        { data: goals }
    ] = await Promise.all([
        getUserSettings(supabase, user.id),
        supabase.from("accounts").select("*").eq("user_id", user.id),
        supabase.from("transactions").select(`*, category:categories(*), account:accounts(*)`).eq("user_id", user.id).order("date", { ascending: false }),
        supabase.from("categories").select("*").eq("user_id", user.id),
        supabase.from("budgets").select(`*, category:categories(*)`).eq("user_id", user.id),
        supabase.from("goals").select("*").eq("user_id", user.id)
    ]);

    const currency = settings?.currency || "EUR";

    // Calculate totals
    const totalAccountBalance = accounts?.reduce(
        (sum, acc) => sum + (acc.initial_balance || 0),
        0
    ) ?? 0;

    const incomeTransactions = transactions?.filter(
        (t) => t.category?.type === "income"
    ) ?? [];
    const expenseTransactions = transactions?.filter(
        (t) => t.category?.type === "expense"
    ) ?? [];

    const totalIncome = incomeTransactions.reduce(
        (sum, t) => sum + Math.abs(t.amount || 0),
        0
    );
    const totalExpenses = expenseTransactions.reduce(
        (sum, t) => sum + Math.abs(t.amount || 0),
        0
    );

    const totalBalance = totalAccountBalance + totalIncome - totalExpenses;

    // Calculate expenses by category for chart
    const expensesByCategory: Record<string, { name: string; icon: string; amount: number }> = {};
    expenseTransactions.forEach((t) => {
        const catId = t.category_id;
        const catName = t.category?.name || "Sin categoría";
        const catIcon = t.category?.icon || "circle";
        if (!expensesByCategory[catId]) {
            expensesByCategory[catId] = { name: catName, icon: catIcon, amount: 0 };
        }
        expensesByCategory[catId].amount += Math.abs(t.amount || 0);
    });

    const chartData = Object.entries(expensesByCategory).map(([, value]) => ({
        category: value.name,
        icon: value.icon,
        amount: value.amount,
        percentage: totalExpenses > 0 ? (value.amount / totalExpenses) * 100 : 0,
    }));

    // Recent transactions (last 5)
    const recentTransactions = transactions?.slice(0, 5) ?? [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Dashboard</h1>
                    <p className="text-muted-foreground">Resumen de tus finanzas</p>
                </div>
            </div>

            {/* Row 1: KPIs (Balance Cards) */}
            <div className="grid gap-4 md:grid-cols-3">
                <BalanceCard
                    title="Saldo Total"
                    amount={totalBalance}
                    type="total"
                    icon="wallet"
                    currency={currency}
                />
                <BalanceCard
                    title="Ingresos"
                    amount={totalIncome}
                    type="income"
                    icon="trending-up"
                    currency={currency}
                />
                <BalanceCard
                    title="Gastos"
                    amount={totalExpenses}
                    type="expense"
                    icon="trending-down"
                    currency={currency}
                />
            </div>

            {/* Row 2: Quick Actions */}
            <QuickActions accounts={accounts ?? []} categories={categories ?? []} />

            {/* Row 3: Budget & Goal Focus */}
            <div className="grid gap-6 md:grid-cols-2">
                <BudgetSummary currency={currency} budgets={budgets ?? []} transactions={transactions ?? []} />
                <DashboardGoal currency={currency} goals={goals ?? []} />
            </div>

            {/* Row 4: Analysis */}
            <div className="grid gap-6 md:grid-cols-2">
                <ExpensesChart data={chartData} totalExpenses={totalExpenses} currency={currency} />
                <RecentTransactions transactions={recentTransactions} currency={currency} />
            </div>

            {/* Row 5: AI Advisor */}
            <div className="grid col-span-full">
                <AiAdvisor transactions={transactions ?? []} budgets={budgets ?? []} currency={currency} />
            </div>
        </div>
    );
}
