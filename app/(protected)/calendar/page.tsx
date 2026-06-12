import { createClientWithUser } from "@/utils/supabase/server";
import PaymentCalendar from "@/components/calendar/PaymentCalendar";
import RecurringRulesList from "@/components/calendar/RecurringRulesList";
import RecurringRuleForm from "@/components/calendar/RecurringRuleForm";

export default async function CalendarPage() {
    const { supabase, user } = await createClientWithUser();

    if (!user) return null;

    // Fetch all required data in parallel
    const [
        { data: transactions },
        { data: recurringRules },
        { data: accounts },
        { data: categories }
    ] = await Promise.all([
        supabase
            .from("transactions")
            .select(`
                *,
                category:categories(*)
            `)
            .eq("user_id", user.id)
            .order("date", { ascending: false }),
        supabase
            .from("recurring_rules")
            .select(`
                *,
                category:categories(*),
                account:accounts(*)
            `)
            .eq("user_id", user.id)
            .order("next_due_date", { ascending: true }),
        supabase
            .from("accounts")
            .select("*")
            .eq("user_id", user.id),
        supabase
            .from("categories")
            .select("*")
            .eq("user_id", user.id)
    ]);

    // Prepare calendar events
    const calendarEvents = [
        // Past transactions
        ...(transactions ?? []).map((t) => ({
            date: t.date,
            type: (t.category?.type || "expense") as "income" | "expense",
            amount: t.amount,
            description: t.description || t.category?.name || "",
            isPast: true,
            isRecurring: false,
        })),
        // Scheduled recurring payments (next 6 months)
        ...(recurringRules ?? [])
            .filter((r) => r.active)
            .map((r) => ({
                date: r.next_due_date,
                type: (r.amount < 0 ? "expense" : "income") as "income" | "expense",
                amount: r.amount,
                description: r.description || "Pago recurrente",
                isPast: false,
                isRecurring: true,
            })),
    ];


    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Calendario</h1>
                    <p className="text-muted-foreground">
                        Visualiza tus pagos pasados y programados
                    </p>
                </div>
                <RecurringRuleForm
                    accounts={accounts ?? []}
                    categories={categories ?? []}
                />
            </div>

            {/* Calendar and Recurring Rules */}
            <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                    <PaymentCalendar events={calendarEvents} />
                </div>
                <div>
                    <RecurringRulesList rules={recurringRules ?? []} />
                </div>
            </div>
        </div>
    );
}
