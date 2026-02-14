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
import { Plus, ArrowDownLeft, ArrowUpRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Account, Category } from "@/types/database";

interface QuickActionsProps {
    accounts: Account[];
    categories: Category[];
}

export default function QuickActions({ accounts, categories }: QuickActionsProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [type, setType] = useState<"income" | "expense">("expense");
    const [amount, setAmount] = useState("");
    const [description, setDescription] = useState("");
    const [accountId, setAccountId] = useState("");
    const [categoryId, setCategoryId] = useState("");
    const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
    const [loading, setLoading] = useState(false);

    const router = useRouter();
    const supabase = createClient();

    const filteredCategories = categories.filter((cat) => cat.type === type);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("No user");

            const { error } = await supabase.from("transactions").insert({
                user_id: user.id,
                account_id: accountId,
                category_id: categoryId,
                amount: type === "expense" ? -Math.abs(parseFloat(amount)) : Math.abs(parseFloat(amount)),
                description,
                date,
                is_recurring: false,
            });

            if (error) throw error;

            toast.success(type === "income" ? "Ingreso añadido" : "Gasto añadido");
            setIsOpen(false);
            resetForm();
            router.refresh();
        } catch (error) {
            toast.error("Error al guardar la transacción");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setAmount("");
        setDescription("");
        setAccountId("");
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
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    {type === "income" ? (
                                        <>
                                            <ArrowDownLeft className="w-5 h-5 text-emerald-500" />
                                            Nuevo Ingreso
                                        </>
                                    ) : (
                                        <>
                                            <ArrowUpRight className="w-5 h-5 text-rose-500" />
                                            Nuevo Gasto
                                        </>
                                    )}
                                </DialogTitle>
                                <DialogDescription>
                                    Añade una nueva transacción a tu cuenta
                                </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleSubmit}>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="amount">Cantidad</Label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                                €
                                            </span>
                                            <Input
                                                id="amount"
                                                type="number"
                                                step="0.01"
                                                placeholder="0.00"
                                                value={amount}
                                                onChange={(e) => setAmount(e.target.value)}
                                                className="pl-8"
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
                                            <Label htmlFor="account">Cuenta</Label>
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

                                        <div className="space-y-2">
                                            <Label htmlFor="category">Categoría</Label>
                                            <Select value={categoryId} onValueChange={setCategoryId} required>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccionar categoría" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {filteredCategories.map((category) => (
                                                        <SelectItem key={category.id} value={category.id}>
                                                            {category.name}
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
                                </div>
                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                                        Cancelar
                                    </Button>
                                    <Button type="submit" disabled={loading}>
                                        {loading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Guardando...
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
