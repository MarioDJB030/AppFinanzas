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
import { Plus, Loader2, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import type { Account, Category } from "@/types/database";

interface TransactionFormProps {
    accounts: Account[];
    categories: Category[];
}

export default function TransactionForm({ accounts, categories }: TransactionFormProps) {
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
                category_id: categoryId || null,
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
                        Añade un nuevo ingreso o gasto
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={type} onValueChange={(v) => setType(v as typeof type)}>
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="expense" className="flex items-center gap-2">
                            <ArrowUpRight className="w-4 h-4" />
                            Gasto
                        </TabsTrigger>
                        <TabsTrigger value="income" className="flex items-center gap-2">
                            <ArrowDownLeft className="w-4 h-4" />
                            Ingreso
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value={type} className="mt-4">
                        <form onSubmit={handleSubmit}>
                            <div className="space-y-4">
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
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
