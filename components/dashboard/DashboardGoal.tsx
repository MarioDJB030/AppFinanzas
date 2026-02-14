import { createClient } from "@/utils/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight, Pin, Trophy } from "lucide-react";
import type { Goal } from "@/types/database";

interface DashboardGoalProps {
    currency?: string;
}

export default async function DashboardGoal({ currency = "EUR" }: DashboardGoalProps) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    // 1. Fetch all goals for the user
    const { data: allGoals } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", user.id);

    // ... logic ...

    // (Update formats below)



    let goal: Goal | undefined;

    if (allGoals && allGoals.length > 0) {
        // A. Priority: Pinned Goal
        const pinnedGoal = allGoals.find(g => g.is_pinned);

        if (pinnedGoal) {
            goal = pinnedGoal;
        } else {
            // B. Fallback: Active goal (not completed) with highest progress %
            // Filter only incomplete goals for the dashboard widget
            const activeGoals = allGoals.filter(g => g.current_amount < g.target_amount);

            if (activeGoals.length > 0) {
                goal = activeGoals.sort((a, b) => {
                    const pa = (a.current_amount / a.target_amount);
                    const pb = (b.current_amount / b.target_amount);
                    return pb - pa; // Descending
                })[0];
            } else {
                // C. Edge case: Only completed goals exist? 
                // If the user wants to see *completed* goals if no active ones exist, we could fallback to that.
                // For now, let's assume we want to encourage creating a NEW goal if all are done.
                // Or maybe show the most recently completed? 
                // Let's fallback to the most recently created goal if no active ones exist, just to show SOMETHING?
                // User said: "si no hay metas creadas... acceso para crear". "si si hay metas... coge la que mas %".
                // "Mas %" of complete goals is 100%. 
                // Let's show the most recently modified/created one if all are completed.
                if (allGoals.length > 0) {
                    goal = allGoals[0]; // Just take the first one (most recent usually if we ordered? DB default order might be insertion id)
                }
            }
        }
    }

    // 3. Empty State: No goals at all
    if (!goal) {
        return (
            <Card className="col-span-1 h-full border-dashed">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        Meta Prioritaria
                        <Trophy className="w-4 h-4 text-muted-foreground" />
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center h-[calc(100%-4rem)] space-y-4 text-center">
                    <div className="bg-primary/10 p-3 rounded-full">
                        <Trophy className="w-6 h-6 text-primary" />
                    </div>
                    <div className="space-y-1">
                        <p className="font-medium">No tienes metas activas</p>
                        <p className="text-sm text-muted-foreground">Define un objetivo para empezar a ahorrar</p>
                    </div>
                    <Link href="/goals">
                        <Button variant="outline" size="sm">
                            Crear Nueva Meta
                        </Button>
                    </Link>
                </CardContent>
            </Card>
        );
    }

    const percentage = Math.min((goal.current_amount / goal.target_amount) * 100, 100);

    return (
        <Card className="col-span-1 h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                    {goal.is_pinned ? "Meta Fijada" : "Meta Prioritaria"}
                    {goal.is_pinned ? <Pin className="w-4 h-4 fill-current text-primary" /> : <Trophy className="w-4 h-4 text-muted-foreground" />}
                </CardTitle>
                <Link
                    href="/goals"
                    className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1"
                >
                    Ver todas <ArrowRight className="w-4 h-4" />
                </Link>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                    <div className="text-3xl bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center">
                        {goal.icon}
                    </div>
                    <div>
                        <div className="font-semibold text-lg">{goal.name}</div>
                        <div className="text-sm text-muted-foreground font-mono">
                            {new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(goal.current_amount)}
                            {" / "}
                            {new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(goal.target_amount)}
                        </div>
                    </div>
                </div>
                <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Progreso</span>
                        <span className="font-bold text-foreground">{percentage.toFixed(0)}%</span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                </div>
            </CardContent>
        </Card>
    );
}
