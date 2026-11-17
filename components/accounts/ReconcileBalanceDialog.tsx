"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Scale } from "lucide-react";
import { toast } from "sonner";
import type { Account } from "@/types/database";

interface ReconcileBalanceDialogProps {
    account: Account | null;
    currentBalance: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currency?: string;
}

export default function ReconcileBalanceDialog({
    account,
    currentBalance,
    open,
    onOpenChange,
    currency = "EUR",
}: ReconcileBalanceDialogProps) {
    const [realBalance, setRealBalance] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        if (open && account) {
            setRealBalance(currentBalance.toFixed(2));
        }
    }, [open, account, currentBalance]);

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(value);

    const parsedReal = parseFloat(realBalance.replace(",", "."));
    const difference = !isNaN(parsedReal) ? parsedReal - currentBalance : 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!account) return;

        if (isNaN(parsedReal)) {
            toast.error("Introduce un saldo válido");
            return;
        }

        if (Math.abs(difference) < 0.005) {
            toast.message("El saldo ya coincide, no hace falta ajustar");
            onOpenChange(false);
            return;
        }

        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("No user");

            const { error } = await supabase.from("transactions").insert({
                user_id: user.id,
                account_id: account.id,
                category_id: null,
                amount: Number(difference.toFixed(2)),
                description: "Reconciliación de saldo",
                date: new Date().toISOString().split("T")[0],
                is_recurring: false,
                kind: "adjustment",
            });

            if (error) throw error;

            toast.success(`Saldo de ${account.name} cuadrado a ${formatCurrency(parsedReal)}`);
            onOpenChange(false);
            router.refresh();
        } catch (error) {
            console.error(error);
            toast.error("Error al cuadrar el saldo");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Scale className="w-5 h-5" />
                        Cuadrar saldo
                    </DialogTitle>
                    <DialogDescription>
                        Ajusta {account?.name} al saldo real del banco. El movimiento no cuenta
                        como ingreso ni como gasto.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                        <p className="text-muted-foreground">Saldo actual en la app</p>
                        <p className="text-lg font-semibold">{formatCurrency(currentBalance)}</p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="real-balance">Saldo real</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
                                €
                            </span>
                            <Input
                                id="real-balance"
                                type="number"
                                step="0.01"
                                value={realBalance}
                                onChange={(e) => setRealBalance(e.target.value)}
                                className="pl-8 text-xl font-bold h-12"
                                required
                            />
                        </div>
                    </div>

                    {!isNaN(parsedReal) && Math.abs(difference) >= 0.005 && (
                        <p className={`text-sm font-medium ${difference > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                            Ajuste: {difference > 0 ? "+" : ""}
                            {formatCurrency(difference)}
                        </p>
                    )}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Guardando...
                                </>
                            ) : (
                                "Cuadrar saldo"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
