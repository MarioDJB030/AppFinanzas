import { createClient } from "@/utils/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";
import type { Goal } from "@/types/database";

export default async function GoalsWidget() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    // Fetch active goals
    const { data: goals } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", user.id)
        .lt("current_amount", "target_amount") // Only active goals
        .order("deadline", { ascending: true }) // Closest deadline first
        .limit(1);

    const goal = goals?.[0] as Goal | undefined;

    if (!goal) return null;

    const percentage = Math.min((goal.current_amount / goal.target_amount) * 100, 100);

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">Meta Prioritaria</CardTitle>
                <Trophy className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="flex items-center gap-3 mb-3">
                    <div className="text-2xl bg-primary/10 w-10 h-10 rounded-full flex items-center justify-center">
                        {goal.icon}
                    </div>
                    <div>
                        <div className="font-semibold">{goal.name}</div>
                        <div className="text-xs text-muted-foreground">
                            {new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(goal.current_amount)}
                            {" / "}
                            {new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(goal.target_amount)}
                        </div>
                    </div>
                </div>
                <Progress value={percentage} className="h-2" />
                <Link
                    href="/goals"
                    className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mt-3 justify-end"
                >
                    Ver todas <ArrowRight className="w-3 h-3" />
                </Link>
            </CardContent>
        </Card>
    );
}
