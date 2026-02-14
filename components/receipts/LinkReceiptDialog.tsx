"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, Link as LinkIcon, Unlink } from "lucide-react";
import { linkReceipt } from "@/actions/receipts";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { Receipt } from "@/types/database";

interface LinkReceiptDialogProps {
    receipt: Receipt | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    // We pass recent transactions similarly to the upload component
    recentTransactions: {
        id: string;
        description?: string;
        amount: number;
        date: string;
        category?: { name: string };
    }[];
}

export default function LinkReceiptDialog({ receipt, open, onOpenChange, recentTransactions }: LinkReceiptDialogProps) {
    const [selectedTxId, setSelectedTxId] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    if (!receipt) return null;

    const handleLink = async () => {
        setLoading(true);
        try {
            const txId = selectedTxId === "none" ? null : selectedTxId;
            const res = await linkReceipt(receipt.id, txId);
            if (res.error) {
                toast.error(res.error);
            } else {
                toast.success(txId ? "Recibo enlazado" : "Enlace eliminado");
                onOpenChange(false);
                router.refresh();
            }
        } catch (error) {
            console.error(error);
            toast.error("Error al enlazar");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Enlazar Recibo</DialogTitle>
                    <DialogDescription>
                        Asocia este recibo a una transacción existente o desvinculalo.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Transacción</label>
                        <Select value={selectedTxId} onValueChange={setSelectedTxId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccionar transacción..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">
                                    <div className="flex items-center text-muted-foreground">
                                        <Unlink className="w-4 h-4 mr-2" />
                                        Sin enlace (Desvincular)
                                    </div>
                                </SelectItem>
                                {recentTransactions.map((tx) => (
                                    <SelectItem key={tx.id} value={tx.id}>
                                        {tx.date} - {tx.description || "Sin descripción"} ({tx.amount}€)
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    <Button onClick={handleLink} disabled={loading || !selectedTxId}>
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Guardar Cambios
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
