"use client";

import { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, Zap, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { createTransactionFromReceipt } from "@/actions/receipts";
import type { Account, Category } from "@/types/database";

interface ScanResultDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    scanData: {
        amount: number;
        merchant: string;
        date: string;
        category_suggestion: string;
        confidence: number;
    } | null;
    receiptId: string;
    categories: Category[];
    accounts: Account[];
}

export default function ScanResultDialog({
    open,
    onOpenChange,
    scanData,
    receiptId,
    categories,
    accounts,
}: ScanResultDialogProps) {
    const [amount, setAmount] = useState("");
    const [merchant, setMerchant] = useState("");
    const [date, setDate] = useState("");
    const [categoryId, setCategoryId] = useState("");
    const [accountId, setAccountId] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (scanData && open) {
            setAmount(scanData.amount?.toString() || "");
            setMerchant(scanData.merchant || "");
            setDate(scanData.date || new Date().toISOString().split("T")[0]);

            // Try to match category
            if (scanData.category_suggestion) {
                const match = categories.find(c =>
                    c.name.toLowerCase().includes(scanData.category_suggestion.toLowerCase()) ||
                    scanData.category_suggestion.toLowerCase().includes(c.name.toLowerCase())
                );
                if (match) {
                    setCategoryId(match.id);
                }
            }
        }
    }, [scanData, open, categories]);

    const handleConfirm = async () => {
        if (!accountId) {
            toast.error("Por favor selecciona una cuenta");
            return;
        }

        setLoading(true);
        try {
            const res = await createTransactionFromReceipt(receiptId, {
                amount: parseFloat(amount),
                description: merchant,
                date,
                categoryId,
                accountId
            });

            if (res.error) {
                toast.error(res.error);
            } else {
                toast.success("Transacción creada y vinculada");
                onOpenChange(false);
            }
        } catch (error) {
            console.error(error);
            toast.error("Error al guardar");
        } finally {
            setLoading(false);
        }
    };

    if (!scanData) return null;

    const isLowConfidence = scanData.confidence < 0.7;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Zap className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                        Ticket Escaneado
                    </DialogTitle>
                    <DialogDescription>
                        La IA ha detectado estos datos. Revísalos antes de guardar.
                    </DialogDescription>
                </DialogHeader>

                {isLowConfidence && (
                    <div className="bg-yellow-500/15 text-yellow-600 p-3 rounded-md text-sm flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                        <p>La confianza del escaneo es baja. Por favor verifica los datos cuidadosamente.</p>
                    </div>
                )}

                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Monto</Label>
                            <div className="relative">
                                <Input
                                    type="number"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    step="0.01"
                                />
                                <Zap className="w-3 h-3 text-yellow-500 absolute right-3 top-3 opacity-50" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Fecha</Label>
                            <div className="relative">
                                <Input
                                    type="date"
                                    value={date}
                                    onChange={e => setDate(e.target.value)}
                                />
                                <Zap className="w-3 h-3 text-yellow-500 absolute right-8 top-3 opacity-50" />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Comercio / Descripción</Label>
                        <div className="relative">
                            <Input
                                value={merchant}
                                onChange={e => setMerchant(e.target.value)}
                                placeholder="Nombre del comercio"
                            />
                            <Zap className="w-3 h-3 text-yellow-500 absolute right-3 top-3 opacity-50" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Categoría Sugerida</Label>
                            <Select value={categoryId} onValueChange={setCategoryId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map(c => (
                                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Cuenta (Requerido)</Label>
                            <Select value={accountId} onValueChange={setAccountId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {accounts.map(a => (
                                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    <Button onClick={handleConfirm} disabled={loading || !accountId || !amount}>
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Confirmar y Guardar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
