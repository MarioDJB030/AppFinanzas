"use client";

import { useState } from "react";
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
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Loader2, ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import type { Account, Category } from "@/types/database";

interface TransactionFormProps {
    accounts: Account[];
    categories: Category[];
}

export default function TransactionForm({ accounts, categories }: TransactionFormProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [type, setType] = useState<"income" | "expense" | "transfer">("expense");
    const [amount, setAmount] = useState("");
    const [description, setDescription] = useState("");
    const [accountId, setAccountId] = useState(""); // For transfer, this is origin account
    const [toAccountId, setToAccountId] = useState(""); // Destination account for transfer
    const [categoryId, setCategoryId] = useState("");
    const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
    const [loading, setLoading] = useState(false);

    const router = useRouter();
    const supabase = createClient();

    const filteredCategories = categories.filter((cat) => cat.type === type);

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

                // Insert 2 transactions: expense in origin and income in destination
                const { error } = await supabase.from("transactions").insert([
                    {
                        user_id: user.id,
                        account_id: accountId,
                        category_id: null,
                        amount: -Math.abs(parsedAmount),
                        description: originDesc,
                        date,
                        is_recurring: false,
                    },
                    {
                        user_id: user.id,
                        account_id: toAccountId,
                        category_id: null,
                        amount: Math.abs(parsedAmount),
                        description: destDesc,
                        date,
                        is_recurring: false,
                    },
                ]);

                if (error) throw error;

                toast.success("Transferencia realizada con éxito");
            } else {
                const { error } = await supabase.from("transactions").insert({
                    user_id: user.id,
                    account_id: accountId,
                    category_id: categoryId || null,
                    amount: type === "expense" ? -Math.abs(parsedAmount) : Math.abs(parsedAmount),
                    description: description.trim() || null,
                    date,
                    is_recurring: false,
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
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Nueva Transacción
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Nueva Transacción</DialogTitle>
                    <DialogDescription>
                        Añade un gasto, ingreso o transfiere entre tus cuentas
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={type} onValueChange={(v) => setType(v as typeof type)}>
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="expense" className="flex items-center gap-1.5">
                            <ArrowUpRight className="w-4 h-4 text-rose-500" />
                            Gasto
                        </TabsTrigger>
                        <TabsTrigger value="income" className="flex items-center gap-1.5">
                            <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
                            Ingreso
                        </TabsTrigger>
                        <TabsTrigger value="transfer" className="flex items-center gap-1.5">
                            <ArrowLeftRight className="w-4 h-4 text-blue-500" />
                            Transferencia
                        </TabsTrigger>
                    </TabsList>

                    {/* Standard Income or Expense Form */}
                    {(type === "expense" || type === "income") && (
                        <TabsContent value={type} className="mt-4">
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="amount">Cantidad</Label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
                                            €
                                        </span>
                                        <Input
                                            id="amount"
                                            type="number"
                                            step="0.01"
                                            placeholder="0.00"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            className="pl-8 text-2xl font-bold h-14"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="description">Descripción</Label>
                                    <Input
                                        id="description"
                                        placeholder="Ej: Compra supermercado"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Cuenta</Label>
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
                                        <Label>Categoría</Label>
                                        <Select value={categoryId} onValueChange={setCategoryId}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccionar categoría" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {filteredCategories.map((category) => (
                                                    <SelectItem key={category.id} value={category.id}>
                                                        {category.icon ? `${category.icon} ` : ""}{category.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="date">Fecha</Label>
                                    <Input
                                        id="date"
                                        type="date"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                        required
                                    />
                                </div>

                                <DialogFooter className="mt-6">
                                    <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                                        Cancelar
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={loading}
                                        className={type === "income" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"}
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Guardando...
                                            </>
                                        ) : (
                                            <>
                                                <Plus className="w-4 h-4 mr-2" />
                                                Guardar {type === "income" ? "Ingreso" : "Gasto"}
                                            </>
                                        )}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </TabsContent>
                    )}

                    {/* Transfer Form */}
                    {type === "transfer" && (
                        <TabsContent value="transfer" className="mt-4">
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="transfer-amount">Cantidad a Transferir</Label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
                                            €
                                        </span>
                                        <Input
                                            id="transfer-amount"
                                            type="number"
                                            step="0.01"
                                            placeholder="0.00"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            className="pl-8 text-2xl font-bold h-14"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Cuenta Origen (Desde)</Label>
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
                                        <Label>Cuenta Destino (Hacia)</Label>
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

                                <div className="space-y-2">
                                    <Label htmlFor="transfer-description">Concepto / Motivo (Opcional)</Label>
                                    <Input
                                        id="transfer-description"
                                        placeholder="Ej: Ahorro mensual, Traspaso fondos"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="transfer-date">Fecha</Label>
                                    <Input
                                        id="transfer-date"
                                        type="date"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                        required
                                    />
                                </div>

                                <DialogFooter className="mt-6">
                                    <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                                        Cancelar
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={loading}
                                        className="bg-blue-600 hover:bg-blue-700 text-white"
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Transfiriendo...
                                            </>
                                        ) : (
                                            <>
                                                <ArrowLeftRight className="w-4 h-4 mr-2" />
                                                Realizar Transferencia
                                            </>
                                        )}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </TabsContent>
                    )}
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
