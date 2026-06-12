import { createClientWithUser } from "@/utils/supabase/server";
import TransactionsList from "@/components/transactions/TransactionsList";
import TransactionForm from "@/components/transactions/TransactionForm";
import CSVImporter from "@/components/transactions/CSVImporter";
import CSVExporter from "@/components/transactions/CSVExporter";

import { getUserSettings } from "@/actions/settings";

export default async function TransactionsPage() {
    const { supabase, user } = await createClientWithUser();

    if (!user) return null;

    const [
        settings,
        { data: transactions },
        { data: accounts },
        { data: categories }
    ] = await Promise.all([
        getUserSettings(supabase, user.id),
        supabase
            .from("transactions")
            .select(`
                *,
                category:categories(*),
                account:accounts(*),
                receipts(*)
            `)
            .eq("user_id", user.id)
            .order("date", { ascending: false }),
        supabase
            .from("accounts")
            .select("*")
            .eq("user_id", user.id),
        supabase
            .from("categories")
            .select("*")
            .eq("user_id", user.id)
    ]);

    const currency = settings?.currency || "EUR";

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Transacciones</h1>
                    <p className="text-muted-foreground">Gestiona tus ingresos y gastos</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <TransactionForm
                        accounts={accounts ?? []}
                        categories={categories ?? []}
                    />
                    <CSVImporter
                        accounts={accounts ?? []}
                        categories={categories ?? []}
                    />
                    <CSVExporter
                        transactions={transactions ?? []}
                        accounts={accounts ?? []}
                        categories={categories ?? []}
                    />
                </div>
            </div>

            {/* Transactions List */}
            <TransactionsList transactions={transactions ?? []} accounts={accounts ?? []} currency={currency} />
        </div>
    );
}
