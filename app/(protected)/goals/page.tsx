import { createClient } from "@/utils/supabase/server";
import GoalCard from "@/components/goals/GoalCard";
import GoalForm from "@/components/goals/GoalForm";
import { Trophy } from "lucide-react";
import type { Goal } from "@/types/database";
import { getUserSettings } from "@/actions/settings";

export default async function GoalsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    // Fetch user settings
    const settings = await getUserSettings();
    const currency = settings?.currency || "EUR";

    const { data: goals } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Metas de Ahorro</h1>
                    <p className="text-muted-foreground">
                        Visualiza tus objetivos y alcanza tus sueños
                    </p>
                </div>
                <GoalForm />
            </div>

            {(!goals || goals.length === 0) ? (
                <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-lg">
                    <Trophy className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
                    <h3 className="text-lg font-medium">No tienes metas activas</h3>
                    <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-sm">
                        Crea tu primera meta de ahorro para empezar a trackear tu progreso.
                    </p>
                    <GoalForm />
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {goals.map((goal) => (
                        <GoalCard key={goal.id} goal={goal} currency={currency} />
                    ))}
                </div>
            )}
        </div>
    );
}
