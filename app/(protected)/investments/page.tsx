import { createClient } from "@/utils/supabase/server";
import { calculatePortfolioValue } from "@/utils/financeAPI";
import PortfolioSummary from "@/components/investments/PortfolioSummary";
import InvestmentsList from "@/components/investments/InvestmentsList";
import InvestmentForm from "@/components/investments/InvestmentForm";

export default async function InvestmentsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    // Fetch investments
    const { data: investments } = await supabase
        .from("investments")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

    // Calculate portfolio locally using DB values
    const investmentsWithValues = (investments ?? []).map((inv) => {
        const currentPrice = inv.current_price || inv.avg_buy_price;
        const value = currentPrice * inv.quantity;
        const cost = inv.avg_buy_price * inv.quantity;
        const gain = value - cost;
        const gainPercent = cost > 0 ? (gain / cost) * 100 : 0;

        return {
            ...inv,
            currentPrice,
            value,
            gain,
            gainPercent,
        };
    });

    const totalValue = investmentsWithValues.reduce((sum, inv) => sum + inv.value, 0);
    const totalCost = investmentsWithValues.reduce((sum, inv) => sum + (inv.avg_buy_price * inv.quantity), 0);
    const totalGain = totalValue - totalCost;
    const totalGainPercent = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Inversiones</h1>
                    <p className="text-muted-foreground">
                        Tu portafolio de inversiones
                    </p>
                </div>
                <InvestmentForm />
            </div>

            <PortfolioSummary
                totalValue={totalValue}
                totalCost={totalCost}
                totalGain={totalGain}
                totalGainPercent={totalGainPercent}
            />

            <InvestmentsList investments={investmentsWithValues} />
        </div>
    );
}
