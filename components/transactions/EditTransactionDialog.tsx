"use client";

import { useState, useEffect } from "react";
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
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowDownLeft, ArrowUpRight, Loader2, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import type { Account, Category, Transaction } from "@/types/database";
import { collectDeleteIds, getTransactionKind, kindFromAmount } from "@/utils/transactionKind";

interface EditTransactionDialogProps {
    transaction: Transaction | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    accounts: Account[];
    categories: Category[];
}

export default function EditTransactionDialog({
    transaction,
    open,
    onOpenChange,
    accounts,
    categories,
}: EditTransactionDialogProps) {
    const router = useRouter();
    const supabase = createClient();

    const [type, setType] = useState<"income" | "expense">("expense");
    const [amount, setAmount] = useState("");
    const [description, setDescription] = useState("");
    const [accountId, setAccountId] = useState("");
    const [categoryId, setCategoryId] = useState<string>("none");
    const [date, setDate] = useState("");
    const [loading, setLoading] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Sync form state when transaction changes or dialog opens
    useEffect(() => {
        if (transaction && open) {
            const isInc = transaction.amount >= 0;
            setType(isInc ? "income" : "expense");
            setAmount(Math.abs(transaction.amount).toString());
            setDescription(transaction.description || "");
            setAccountId(transaction.account_id || "");
            setCategoryId(transaction.category_id || "none");
            setDate(transaction.date || new Date().toISOString().split("T")[0]);
        }
    }, [transaction, open]);

    const sortedCategories = [...categories].sort((a, b) =>
        a.name.localeCompare(b.name, "es")
    );
    const currentKind = transaction ? getTransactionKind(transaction) : "expense";
    const isNeutral = currentKind === "transfer" || currentKind === "adjustment";

    const handleTypeChange = (newType: "income" | "expense") => {
        setType(newType);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!transaction) return;

        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            toast.error("Por favor, introduce una cantidad válida");
            return;
        }

        if (!accountId) {
            toast.error("Por favor, selecciona una cuenta");
            return;
        }

        setLoading(true);

        try {
            const absAmount = Math.abs(parsedAmount);
            const finalAmount = isNeutral
                ? (transaction.amount >= 0 ? absAmount : -absAmount)
                : type === "expense"
                    ? -absAmount
                    : absAmount;

            const { error } = await supabase
                .from("transactions")
                .update({
                    amount: finalAmount,
                    description: description.trim() || null,
                    account_id: accountId,
                    category_id: isNeutral ? null : (categoryId === "none" ? null : categoryId),
                    date,
                    kind: isNeutral ? currentKind : kindFromAmount(finalAmount),
                })
                .eq("id", transaction.id);

            if (error) throw error;

            if (currentKind === "transfer" && transaction.linked_transaction_id) {
                const linkedAmount = -finalAmount;
                const { error: linkedError } = await supabase
                    .from("transactions")
                    .update({
                        amount: linkedAmount,
                        date,
                    })
                    .eq("id", transaction.linked_transaction_id);
                if (linkedError) throw linkedError;
            }

            toast.success("Transacción modificada correctamente");
            onOpenChange(false);
            router.refresh();
        } catch (error) {
            console.error("Error al actualizar la transacción:", error);
            toast.error("Error al guardar los cambios");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!transaction) return;

        setDeleting(true);
        try {
            const ids = collectDeleteIds([transaction], [transaction.id]);
            const { error } = await supabase
                .from("transactions")
                .delete()
                .in("id", ids);

            if (error) throw error;

            toast.success("Transacción eliminada");
            setDeleteConfirmOpen(false);
            onOpenChange(false);
            router.refresh();
        } catch (error) {
            console.error("Error al eliminar la transacción:", error);
            toast.error("Error al eliminar la transacción");
        } finally {
            setDeleting(false);
        }
    };

    if (!transaction) return null;

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            Modificar Registro
                        </DialogTitle>
                        <DialogDescription>
                            Corrige o actualiza los datos de esta transacción
                        </DialogDescription>
                    </DialogHeader>

                    {!isNeutral && (
                    <Tabs
                        value={type}
                        onValueChange={(v) => handleTypeChange(v as "income" | "expense")}
                        className="mt-2"
                    >
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="expense" className="flex items-center gap-2">
                                <ArrowUpRight className="w-4 h-4 text-rose-500" />
                                Gasto
                            </TabsTrigger>
                            <TabsTrigger value="income" className="flex items-center gap-2">
                                <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
                                Ingreso
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                    )}
                    {isNeutral && (
                        <p className="text-sm text-muted-foreground mt-2">
                            {currentKind === "transfer"
                                ? "Esta transferencia no cuenta como ingreso ni como gasto. Si cambias el importe, se actualizará también la otra cuenta."
                                : "Este ajuste de saldo no cuenta como ingreso ni como gasto."}
                        </p>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                        {/* Amount */}
                        <div className="space-y-2">
                            <Label htmlFor="edit-amount">Cantidad</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
                                    €
                                </span>
                                <Input
                                    id="edit-amount"
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="pl-8 text-2xl font-bold h-12"
                                    required
                                />
                            </div>
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <Label htmlFor="edit-description">Descripción / Concepto</Label>
                            <Input
                                id="edit-description"
                                placeholder="Ej: Supermercado, Nómina, etc."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </div>

                        {/* Account & Category */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Cuenta</Label>
                                <Select value={accountId} onValueChange={setAccountId} required>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar cuenta" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {accounts.map((account) => (
                                            <SelectItem key={account.id} value={account.id}>
                                                {account.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {!isNeutral && (
                            <div className="space-y-2">
                                <Label>Categoría</Label>
                                <Select value={categoryId} onValueChange={setCategoryId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Sin categoría</SelectItem>
                                        {sortedCategories.map((category) => (
                                            <SelectItem key={category.id} value={category.id}>
                                                {category.icon ? `${category.icon} ` : ""}{category.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            )}
                        </div>

                        {/* Date */}
                        <div className="space-y-2">
                            <Label htmlFor="edit-date">Fecha</Label>
                            <Input
                                id="edit-date"
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                required
                            />
                        </div>

                        <DialogFooter className="mt-6 flex flex-row items-center justify-between sm:justify-between gap-2">
                            <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => setDeleteConfirmOpen(true)}
                                className="flex items-center gap-1.5"
                            >
                                <Trash2 className="w-4 h-4" />
                                Borrar
                            </Button>

                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => onOpenChange(false)}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={loading}
                                    className={
                                        type === "income"
                                            ? "bg-emerald-600 hover:bg-emerald-700"
                                            : "bg-rose-600 hover:bg-rose-700"
                                    }
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Guardando...
                                        </>
                                    ) : (
                                        <>
                                            <Check className="w-4 h-4 mr-2" />
                                            Guardar
                                        </>
                                    )}
                                </Button>
                            </div>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Confirm direct deletion dialog */}
            <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar esta transacción?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. El registro se eliminará permanentemente y
                            se recalculará el balance de la cuenta.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={deleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleting ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Eliminando...
                                </>
                            ) : (
                                "Eliminar"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
