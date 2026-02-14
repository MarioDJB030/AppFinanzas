import { createClient } from "@/utils/supabase/server";
import AccountsList from "@/components/accounts/AccountsList";
import AccountForm from "@/components/accounts/AccountForm";

export default async function AccountsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    // Fetch accounts with transaction sums
    const { data: accounts } = await supabase
        .from("accounts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

    // Fetch transactions to calculate balances
    const { data: transactions } = await supabase
        .from("transactions")
        .select("account_id, amount")
        .eq("user_id", user.id);

    // Calculate current balance for each account
    const accountsWithBalance = (accounts ?? []).map((account) => {
        const accountTransactions = (transactions ?? []).filter(
            (t) => t.account_id === account.id
        );
        const transactionsTotal = accountTransactions.reduce(
            (sum, t) => sum + (t.amount || 0),
            0
        );
        return {
            ...account,
            currentBalance: (account.initial_balance || 0) + transactionsTotal,
        };
    });

    const totalBalance = accountsWithBalance.reduce(
        (sum, acc) => sum + acc.currentBalance,
        0
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Cuentas</h1>
                    <p className="text-muted-foreground">Gestiona tus cuentas bancarias</p>
                </div>
                <AccountForm />
            </div>

            {/* Total Balance */}
            <div className="p-6 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10">
                <p className="text-sm font-medium text-muted-foreground">Saldo Total</p>
                <p className="text-3xl font-bold mt-1">
                    {new Intl.NumberFormat("es-ES", {
                        style: "currency",
                        currency: "EUR",
                    }).format(totalBalance)}
                </p>
            </div>

            {/* Accounts List */}
            <AccountsList accounts={accountsWithBalance} />
        </div>
    );
}
