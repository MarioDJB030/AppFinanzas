"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Minus, Calendar, Loader2, Pin } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import type { Goal } from "@/types/database";

interface GoalCardProps {
    goal: Goal;
    currency?: string;
}

export default function GoalCard({ goal, currency = "EUR" }: GoalCardProps) {
    const [action, setAction] = useState<"deposit" | "withdraw" | null>(null);
    const [amount, setAmount] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    const percentage = Math.min((goal.current_amount / goal.target_amount) * 100, 100);
    const remaining = goal.target_amount - goal.current_amount;

    // Calculate days remaining
    let daysRemaining: number | null = null;
    if (goal.deadline) {
        const today = new Date();
        const deadline = new Date(goal.deadline);
        const diffTime = deadline.getTime() - today.getTime();
        daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    const handleTransaction = async () => {
        if (!amount || isNaN(parseFloat(amount))) return;
        setLoading(true);

        const val = parseFloat(amount);
        const newAmount = action === "deposit"
            ? goal.current_amount + val
            : goal.current_amount - val;

        try {
            const { error } = await supabase
                .from("goals")
                .update({ current_amount: newAmount })
                .eq("id", goal.id);

            if (error) throw error;

            toast.success(action === "deposit" ? "Depósito realizado" : "Retiro realizado");
            setAction(null);
            setAmount("");
            router.refresh();

            // Trigger confetti if goal reached 100% and it was a deposit
            // We check if it wasn't already at 100% to avoid spamming (optional check, but good UX)
            // Or just check if newAmount >= targetAmount and it was a deposit
            if (action === "deposit" && newAmount >= goal.target_amount) {
                confetti({
                    particleCount: 100,
                    spread: 70,
                    origin: { y: 0.6 }
                });
            }

        } catch (error) {
            console.error(error);
            toast.error("Error al actualizar la meta");
        } finally {
            setLoading(false);
        }
    };

    const handlePin = async () => {
        try {
            const { error } = await supabase.rpc('pin_goal', { goal_id: goal.id });

            if (error) throw error;

            toast.success("Meta fijada correctamente");
            router.refresh();
        } catch (error) {
            console.error(error);
            toast.error("Error al fijar la meta");
        }
    };

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat("es-ES", { style: "currency", currency: currency }).format(val);

    return (
        <>
            <Card className="flex flex-col h-full hover:shadow-md transition-all">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-base font-medium flex items-center gap-2">
                        <span className="text-2xl">{goal.icon}</span>
                        {goal.name}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            className={`h-8 w-8 ${goal.is_pinned ? "text-primary" : "text-muted-foreground"}`}
                            onClick={handlePin}
                            title="Fijar meta"
                        >
                            <Pin className={`w-4 h-4 ${goal.is_pinned ? "fill-current" : ""}`} />
                        </Button>
                        <Badge variant={percentage >= 100 ? "default" : "secondary"}>
                            {percentage.toFixed(0)}%
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-4">
                    <div className="flex justify-between items-end text-sm">
                        <div>
                            <p className="text-muted-foreground text-xs">Ahorrado</p>
                            <p className="font-bold text-xl">{formatCurrency(goal.current_amount)}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-muted-foreground text-xs">Objetivo</p>
                            <p className="font-medium">{formatCurrency(goal.target_amount)}</p>
                        </div>
                    </div>

                    <Progress value={percentage} className="h-3" />

                    {daysRemaining !== null && (
                        <div className={`flex items-center gap-1 text-xs ${daysRemaining < 0 ? "text-rose-500 font-bold" : "text-muted-foreground"}`}>
                            <Calendar className="w-3 h-3" />
                            {daysRemaining < 0
                                ? `Venció hace ${Math.abs(daysRemaining)} días`
                                : `${daysRemaining} días restantes`
                            }
                        </div>
                    )}
                </CardContent>
                <CardFooter className="grid grid-cols-2 gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={() => setAction("deposit")} className="w-full text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50">
                        <Plus className="w-4 h-4 mr-1" />
                        Aportar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setAction("withdraw")} className="w-full text-rose-600 hover:text-rose-700 hover:bg-rose-50">
                        <Minus className="w-4 h-4 mr-1" />
                        Retirar
                    </Button>
                </CardFooter>
            </Card>

            {/* Transaction Dialog */}
            <Dialog open={!!action} onOpenChange={(open) => !open && setAction(null)}>
                <DialogContent className="sm:max-w-xs">
                    <DialogHeader>
                        <DialogTitle>
                            {action === "deposit" ? "Aportar a la meta" : "Retirar de la meta"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Input
                                type="number"
                                placeholder="Cantidad (€)"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setAction(null)}>Cancelar</Button>
                        <Button onClick={handleTransaction} disabled={loading}>
                            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Confirmar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
