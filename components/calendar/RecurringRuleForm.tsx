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
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { Account, Category } from "@/types/database";
import AccountSplitSelector, { SplitState, SplitMode } from "./AccountSplitSelector";

interface RecurringRuleFormProps {
    accounts: Account[];
    categories: Category[];
}

const frequencies = [
    { value: "daily", label: "Diario" },
    { value: "weekly", label: "Semanal" },
    { value: "biweekly", label: "Quincenal" },
    { value: "monthly", label: "Mensual" },
    { value: "yearly", label: "Anual" },
];

export default function RecurringRuleForm({ accounts, categories }: RecurringRuleFormProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [type, setType] = useState<"income" | "expense">("expense");
    const [amount, setAmount] = useState("");
    const [description, setDescription] = useState("");
    const [accountId, setAccountId] = useState("");
    const [categoryId, setCategoryId] = useState("");
    const [frequency, setFrequency] = useState("monthly");
    const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
    
    // Reparto state
    const [isSplit, setIsSplit] = useState(false);
    const [splitMode, setSplitMode] = useState<SplitMode>("percentage");
    const [splits, setSplits] = useState<SplitState[]>(
        accounts.map(a => ({ accountId: a.id, active: false, value: 0 }))
    );
    
    const [loading, setLoading] = useState(false);

    const router = useRouter();
    const supabase = createClient();

    const filteredCategories = categories.filter((cat) => cat.type === type);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const parsedAmount = Math.abs(parseFloat(amount));
        const finalAmount = type === "expense" ? -parsedAmount : parsedAmount;

        // Validation for split mode
        if (isSplit) {
            const activeSplits = splits.filter(s => s.active);
            if (activeSplits.length === 0) {
                toast.error("Selecciona al menos una cuenta para el reparto");
                return;
            }
            
            const totalSplitValue = activeSplits.reduce((sum, s) => sum + s.value, 0);
            const targetTotal = splitMode === "percentage" ? 100 : parsedAmount;
            
            if (Math.abs(totalSplitValue - targetTotal) > 0.01) { // 0.01 tolerance for floating point
                toast.error(`El reparto debe sumar exactamente ${targetTotal}${splitMode === "percentage" ? "%" : "€"}`);
                return;
            }
        }

        setLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("No user");

            // Insert recurring rule
            const { data: ruleData, error: ruleError } = await supabase.from("recurring_rules").insert({
                user_id: user.id,
                account_id: isSplit ? splits.filter(s => s.active)[0]?.accountId : accountId, // First active or selected
                category_id: categoryId,
                amount: finalAmount,
                description,
                frequency,
                start_date: startDate,
                next_due_date: startDate,
                active: true,
                is_split: isSplit
            }).select().single();

            if (ruleError) throw ruleError;

            // Insert splits if applicable
            if (isSplit && ruleData) {
                const activeSplits = splits.filter(s => s.active);
                const splitsToInsert = activeSplits.map(s => ({
                    rule_id: ruleData.id,
                    account_id: s.accountId,
                    split_mode: splitMode,
                    value: s.value
                }));

                const { error: splitsError } = await supabase
                    .from("recurring_rule_splits")
                    .insert(splitsToInsert);

                if (splitsError) {
                    // Try to clean up the rule if splits failed
                    await supabase.from("recurring_rules").delete().eq("id", ruleData.id);
                    throw splitsError;
                }
            }

            toast.success("Pago recurrente creado");
            setIsOpen(false);
            resetForm();
            router.refresh();
        } catch (error) {
            toast.error("Error al crear el pago recurrente");
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
        setFrequency("monthly");
        setStartDate(new Date().toISOString().split("T")[0]);
        setIsSplit(false);
        setSplitMode("percentage");
        setSplits(accounts.map(a => ({ accountId: a.id, active: false, value: 0 })));
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Nuevo Pago Recurrente
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <RefreshCw className="w-5 h-5" />
                        Nuevo Pago Recurrente
                    </DialogTitle>
                    <DialogDescription>
                        Programa un pago que se repita automáticamente
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-4">
                        {/* Type Selection */}
                        <div className="space-y-2">
                            <Label>Tipo</Label>
                            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="expense">Gasto</SelectItem>
                                    <SelectItem value="income">Ingreso</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Amount */}
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

                        {/* Description */}
                        <div className="space-y-2">
                            <Label htmlFor="description">Descripción</Label>
                            <Input
                                id="description"
                                placeholder="Ej: Netflix, Alquiler..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </div>

                        {/* Account and Category */}
                        <div className="grid grid-cols-2 gap-4">
                            {!isSplit && (
                                <div className="space-y-2">
                                    <Label>Cuenta</Label>
                                    <Select value={accountId} onValueChange={setAccountId} required={!isSplit}>
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
                            )}

                            <div className={`space-y-2 ${isSplit ? "col-span-2" : ""}`}>
                                <Label>Categoría</Label>
                                <Select value={categoryId} onValueChange={setCategoryId} required>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar" />
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

                        {/* Split feature */}
                        <div className="space-y-4">
                            <div className="flex items-center space-x-2">
                                <Checkbox 
                                    id="is-split" 
                                    checked={isSplit} 
                                    onCheckedChange={(c) => setIsSplit(c === true)} 
                                />
                                <Label htmlFor="is-split" className="font-medium">
                                    Repartir a diferentes cuentas
                                </Label>
                            </div>

                            {isSplit && (
                                <AccountSplitSelector
                                    accounts={accounts}
                                    splits={splits}
                                    setSplits={setSplits}
                                    splitMode={splitMode}
                                    setSplitMode={setSplitMode}
                                    totalAmount={Math.abs(parseFloat(amount)) || 0}
                                />
                            )}
                        </div>

                        {/* Frequency and Start Date */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Frecuencia</Label>
                                <Select value={frequency} onValueChange={setFrequency}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {frequencies.map((f) => (
                                            <SelectItem key={f.value} value={f.value}>
                                                {f.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="startDate">Fecha inicio</Label>
                                <Input
                                    id="startDate"
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    required
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
