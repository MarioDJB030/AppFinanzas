"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Plus, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Account, Category } from "@/types/database";
import { insertLinkedTransfer, kindFromAmount } from "@/utils/transactionKind";

interface QuickActionsProps {
    accounts: Account[];
    categories: Category[];
}

export default function QuickActions({ accounts, categories }: QuickActionsProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [type, setType] = useState<"income" | "expense" | "transfer">("expense");
    const [amount, setAmount] = useState("");
    const [description, setDescription] = useState("");
    const [accountId, setAccountId] = useState("");
    const [toAccountId, setToAccountId] = useState("");
    const [categoryId, setCategoryId] = useState("");
    const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
    const [loading, setLoading] = useState(false);

    const router = useRouter();
    const supabase = createClient();

    const sortedCategories = [...categories].sort((a, b) =>
        a.name.localeCompare(b.name, "es")
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            toast.error("Por favor, introduce una cantidad válida");
            return;
        }

        if (type === "transfer") {
            if (!accountId || !toAccountId) {
                toast.error("Debes seleccionar la cuenta de origen y de destino");
                return;
            }
            if (accountId === toAccountId) {
                toast.error("La cuenta de origen y la de destino no pueden ser la misma");
                return;
            }
        } else {
            if (!accountId) {
                toast.error("Por favor, selecciona una cuenta");
                return;
            }
        }

        setLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("No user");

            if (type === "transfer") {
                const originAccount = accounts.find((a) => a.id === accountId);
                const destAccount = accounts.find((a) => a.id === toAccountId);

                const originName = originAccount?.name || "Cuenta origen";
                const destName = destAccount?.name || "Cuenta destino";

                const customDesc = description.trim();
                const originDesc = customDesc
                    ? `${customDesc} (a ${destName})`
                    : `Transferencia a ${destName}`;
                const destDesc = customDesc
                    ? `${customDesc} (desde ${originName})`
                    : `Transferencia desde ${originName}`;

                await insertLinkedTransfer(supabase, {
                    userId: user.id,
                    fromAccountId: accountId,
                    toAccountId,
                    amount: parsedAmount,
                    date,
                    originDescription: originDesc,
                    destDescription: destDesc,
                });

                toast.success("Transferencia realizada con éxito");
            } else {
                const signedAmount = type === "expense" ? -Math.abs(parsedAmount) : Math.abs(parsedAmount);
                const { error } = await supabase.from("transactions").insert({
                    user_id: user.id,
                    account_id: accountId,
                    category_id: categoryId || null,
                    amount: signedAmount,
                    description: description.trim() || null,
                    date,
                    is_recurring: false,
                    kind: kindFromAmount(signedAmount),
                });

                if (error) throw error;

                toast.success(type === "income" ? "Ingreso añadido" : "Gasto añadido");
            }

            setIsOpen(false);
            resetForm();
            router.refresh();
        } catch (error) {
            toast.error(type === "transfer" ? "Error al realizar la transferencia" : "Error al guardar la transacción");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setAmount("");
        setDescription("");
        setAccountId("");
        setToAccountId("");
        setCategoryId("");
        setDate(new Date().toISOString().split("T")[0]);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Acciones Rápidas</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex flex-wrap gap-3">
                    <Dialog open={isOpen} onOpenChange={setIsOpen}>
                        <DialogTrigger asChild>
                            <Button
                                variant="outline"
                                className="flex items-center gap-2"
                                onClick={() => setType("expense")}
                            >
                                <ArrowUpRight className="w-4 h-4 text-rose-500" />
                                Añadir Gasto
                            </Button>
                        </DialogTrigger>
                        <DialogTrigger asChild>
                            <Button
                                variant="outline"
                                className="flex items-center gap-2"
                                onClick={() => setType("income")}
                            >
                                <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
                                Añadir Ingreso
                            </Button>
                        </DialogTrigger>
                        <DialogTrigger asChild>
                            <Button
                                variant="outline"
                                className="flex items-center gap-2"
                                onClick={() => setType("transfer")}
                            >
                                <ArrowLeftRight className="w-4 h-4 text-blue-500" />
                                Transferencia
                            </Button>
                        </DialogTrigger>

                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    {type === "income" ? (
                                        <>
                                            <ArrowDownLeft className="w-5 h-5 text-emerald-500" />
                                            Nuevo Ingreso
                                        </>
                                    ) : type === "transfer" ? (
                                        <>
                                            <ArrowLeftRight className="w-5 h-5 text-blue-500" />
                                            Nueva Transferencia
                                        </>
                                    ) : (
                                        <>
                                            <ArrowUpRight className="w-5 h-5 text-rose-500" />
                                            Nuevo Gasto
                                        </>
                                    )}
                                </DialogTitle>
                                <DialogDescription>
                                    {type === "transfer"
                                        ? "Transfiere dinero entre tus cuentas bancarias o carteras"
                                        : "Añade una nueva transacción a tu cuenta"}
                                </DialogDescription>
                            </DialogHeader>

                            <form onSubmit={handleSubmit}>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="quick-amount">Cantidad</Label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
                                                €
                                            </span>
                                            <Input
                                                id="quick-amount"
                                                type="number"
                                                step="0.01"
                                                placeholder="0.00"
                                                value={amount}
                                                onChange={(e) => setAmount(e.target.value)}
                                                className="pl-8 text-xl font-bold h-12"
                                                required
                                            />
                                        </div>
                                    </div>

                                    {type === "transfer" ? (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Cuenta Origen</Label>
                                                <Select value={accountId} onValueChange={setAccountId} required>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Sale de..." />
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

                                            <div className="space-y-2">
                                                <Label>Cuenta Destino</Label>
                                                <Select value={toAccountId} onValueChange={setToAccountId} required>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Llega a..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {accounts.map((account) => (
                                                            <SelectItem
                                                                key={account.id}
                                                                value={account.id}
                                                                disabled={account.id === accountId}
                                                            >
                                                                {account.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="account">Cuenta</Label>
                                                <Select value={accountId} onValueChange={setAccountId} required>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Seleccionar" />
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

                                            <div className="space-y-2">
                                                <Label htmlFor="category">Categoría</Label>
                                                <Select value={categoryId} onValueChange={setCategoryId}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Seleccionar" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {sortedCategories.map((category) => (
                                                            <SelectItem key={category.id} value={category.id}>
                                                                {category.icon ? `${category.icon} ` : ""}{category.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <Label htmlFor="quick-description">
                                            {type === "transfer" ? "Concepto (Opcional)" : "Descripción"}
                                        </Label>
                                        <Input
                                            id="quick-description"
                                            placeholder={type === "transfer" ? "Ej: Traspaso a ahorros" : "Ej: Compra supermercado"}
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="quick-date">Fecha</Label>
                                        <Input
                                            id="quick-date"
                                            type="date"
                                            value={date}
                                            onChange={(e) => setDate(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>

                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                                        Cancelar
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={loading}
                                        className={
                                            type === "transfer"
                                                ? "bg-blue-600 hover:bg-blue-700 text-white"
                                                : type === "income"
                                                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                                : "bg-rose-600 hover:bg-rose-700 text-white"
                                        }
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Procesando...
                                            </>
                                        ) : type === "transfer" ? (
                                            <>
                                                <ArrowLeftRight className="w-4 h-4 mr-2" />
                                                Transferir
                                            </>
                                        ) : (
                                            <>
                                                <Plus className="w-4 h-4 mr-2" />
                                                Guardar
                                            </>
                                        )}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </CardContent>
        </Card>
    );
}
