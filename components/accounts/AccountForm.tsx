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
import { Plus, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";

const accountTypes = [
    { value: "bank", label: "Cuenta Bancaria" },
    { value: "savings", label: "Cuenta de Ahorro" },
    { value: "cash", label: "Efectivo" },
    { value: "investment", label: "Inversión" },
];

export default function AccountForm() {
    const [isOpen, setIsOpen] = useState(false);
    const [name, setName] = useState("");
    const [type, setType] = useState("bank");
    const [initialBalance, setInitialBalance] = useState("");
    const [loading, setLoading] = useState(false);

    const router = useRouter();
    const supabase = createClient();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("No user");

            const { error } = await supabase.from("accounts").insert({
                user_id: user.id,
                name,
                type,
                initial_balance: parseFloat(initialBalance) || 0,
            });

            if (error) throw error;

            toast.success("Cuenta creada");
            setIsOpen(false);
            resetForm();
            router.refresh();
        } catch (error) {
            toast.error("Error al crear la cuenta");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setName("");
        setType("checking");
        setInitialBalance("");
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Nueva Cuenta
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Wallet className="w-5 h-5" />
                        Nueva Cuenta
                    </DialogTitle>
                    <DialogDescription>
                        Añade una nueva cuenta bancaria o cartera
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Nombre de la cuenta</Label>
                            <Input
                                id="name"
                                placeholder="Ej: Cuenta principal, Ahorros..."
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Tipo de cuenta</Label>
                            <Select value={type} onValueChange={setType}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {accountTypes.map((t) => (
                                        <SelectItem key={t.value} value={t.value}>
                                            {t.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="initialBalance">Saldo inicial</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                    €
                                </span>
                                <Input
                                    id="initialBalance"
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={initialBalance}
                                    onChange={(e) => setInitialBalance(e.target.value)}
                                    className="pl-8"
                                />
                            </div>
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
                                    Crear
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
