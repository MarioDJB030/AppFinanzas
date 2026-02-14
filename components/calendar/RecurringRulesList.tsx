"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    RefreshCw,
    MoreVertical,
    Pause,
    Play,
    Trash2,
    ArrowUpRight,
    ArrowDownLeft,
    Calendar,
} from "lucide-react";
import { toast } from "sonner";
import type { RecurringRule } from "@/types/database";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface RecurringRulesListProps {
    rules: RecurringRule[];
}

const frequencyLabels: Record<string, string> = {
    daily: "Diario",
    weekly: "Semanal",
    biweekly: "Quincenal",
    monthly: "Mensual",
    yearly: "Anual",
};

export default function RecurringRulesList({ rules }: RecurringRulesListProps) {
    const router = useRouter();
    const supabase = createClient();

    const handleToggleActive = async (ruleId: string, isActive: boolean) => {
        try {
            const { error } = await supabase
                .from("recurring_rules")
                .update({ active: !isActive })
                .eq("id", ruleId);

            if (error) throw error;

            toast.success(isActive ? "Pago pausado" : "Pago activado");
            router.refresh();
        } catch (error) {
            toast.error("Error al actualizar");
            console.error(error);
        }
    };

    const handleDelete = async (ruleId: string) => {
        try {
            const { error } = await supabase
                .from("recurring_rules")
                .delete()
                .eq("id", ruleId);

            if (error) throw error;

            toast.success("Pago recurrente eliminado");
            router.refresh();
        } catch (error) {
            toast.error("Error al eliminar");
            console.error(error);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 text-muted-foreground" />
                    Pagos Recurrentes
                </CardTitle>
            </CardHeader>
            <CardContent>
                {rules.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <RefreshCw className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No hay pagos recurrentes</p>
                        <p className="text-sm mt-1">
                            Añade pagos que se repiten automáticamente
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {rules.map((rule) => {
                            const isExpense = rule.amount < 0;
                            const formattedAmount = new Intl.NumberFormat("es-ES", {
                                style: "currency",
                                currency: "EUR",
                            }).format(Math.abs(rule.amount));

                            return (
                                <div
                                    key={rule.id}
                                    className={`p-4 rounded-xl border ${rule.active ? "bg-card" : "bg-muted/50 opacity-60"
                                        }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start gap-3">
                                            <div
                                                className={`p-2 rounded-lg ${isExpense ? "bg-rose-500/10" : "bg-emerald-500/10"
                                                    }`}
                                            >
                                                {isExpense ? (
                                                    <ArrowUpRight className="w-4 h-4 text-rose-500" />
                                                ) : (
                                                    <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-medium">
                                                    {rule.description || rule.category?.name || "Pago recurrente"}
                                                </p>
                                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                                    <Badge variant="secondary" className="text-xs">
                                                        {frequencyLabels[rule.frequency] || rule.frequency}
                                                    </Badge>
                                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                        <Calendar className="w-3 h-3" />
                                                        Próximo: {format(new Date(rule.next_due_date), "d MMM", { locale: es })}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <span
                                                className={`font-semibold ${isExpense ? "text-rose-500" : "text-emerald-500"
                                                    }`}
                                            >
                                                {isExpense ? "-" : "+"}{formattedAmount}
                                            </span>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <MoreVertical className="w-4 h-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem
                                                        onClick={() => handleToggleActive(rule.id, rule.active)}
                                                    >
                                                        {rule.active ? (
                                                            <>
                                                                <Pause className="w-4 h-4 mr-2" />
                                                                Pausar
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Play className="w-4 h-4 mr-2" />
                                                                Activar
                                                            </>
                                                        )}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => handleDelete(rule.id)}
                                                        className="text-destructive"
                                                    >
                                                        <Trash2 className="w-4 h-4 mr-2" />
                                                        Eliminar
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
