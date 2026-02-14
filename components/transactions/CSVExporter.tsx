"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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
import { Label } from "@/components/ui/label";
import { Download, FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";
import { format } from "date-fns";
import type { Account, Category, Transaction } from "@/types/database";

interface CSVExporterProps {
    transactions: Transaction[];
    accounts: Account[];
    categories: Category[];
}

export default function CSVExporter({ transactions, accounts, categories }: CSVExporterProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [dateRange, setDateRange] = useState<"all" | "current_month" | "last_month" | "current_year">("all");
    const [accountId, setAccountId] = useState<string>("all");
    const [loading, setLoading] = useState(false);

    const handleExport = () => {
        setLoading(true);
        setTimeout(() => {
            try {
                // Filter transactions
                const filteredData = transactions.filter((t) => {
                    // Account filter
                    if (accountId !== "all" && t.account_id !== accountId) {
                        return false;
                    }

                    // Date filter
                    if (dateRange !== "all") {
                        const transactionDate = new Date(t.date);
                        const now = new Date();
                        const currentMonth = now.getMonth();
                        const currentYear = now.getFullYear();

                        switch (dateRange) {
                            case "current_month":
                                if (transactionDate.getMonth() !== currentMonth || transactionDate.getFullYear() !== currentYear) {
                                    return false;
                                }
                                break;
                            case "last_month":
                                const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                                if (transactionDate.getMonth() !== lastMonthDate.getMonth() || transactionDate.getFullYear() !== lastMonthDate.getFullYear()) {
                                    return false;
                                }
                                break;
                            case "current_year":
                                if (transactionDate.getFullYear() !== currentYear) {
                                    return false;
                                }
                                break;
                        }
                    }

                    return true;
                });

                if (filteredData.length === 0) {
                    toast.error("No hay transacciones para exportar con estos filtros");
                    setLoading(false);
                    return;
                }

                // Map to CSV format
                const csvData = filteredData.map(t => ({
                    Fecha: t.date,
                    Descripción: t.description || "",
                    Cantidad: t.amount,
                    Categoría: t.category?.name || "Sin categoría",
                    Cuenta: accounts.find(a => a.id === t.account_id)?.name || "Cuenta desconocida",
                    Tipo: t.amount >= 0 ? "Ingreso" : "Gasto"
                }));

                // Generate CSV
                const csv = Papa.unparse(csvData, {
                    quotes: true,
                    delimiter: ",",
                });

                // Trigger download
                const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.setAttribute("href", url);
                link.setAttribute("download", `transacciones_${format(new Date(), "yyyy-MM-dd")}.csv`);
                link.style.visibility = "hidden";
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                toast.success(`Exportadas ${filteredData.length} transacciones correctamente`);
                setIsOpen(false);
            } catch (error) {
                console.error(error);
                toast.error("Error al generar el archivo CSV");
            } finally {
                setLoading(false);
            }
        }, 100);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    Exportar CSV
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileDown className="w-5 h-5" />
                        Exportar Transacciones
                    </DialogTitle>
                    <DialogDescription>
                        Selecciona los filtros para exportar tus transacciones a un archivo CSV.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label>Rango de Fechas</Label>
                        <Select value={dateRange} onValueChange={(v) => setDateRange(v as any)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccionar periodo" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todo el historial</SelectItem>
                                <SelectItem value="current_month">Este mes</SelectItem>
                                <SelectItem value="last_month">Mes pasado</SelectItem>
                                <SelectItem value="current_year">Este año</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Cuenta</Label>
                        <Select value={accountId} onValueChange={setAccountId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Todas las cuentas" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas las cuentas</SelectItem>
                                {accounts.map((account) => (
                                    <SelectItem key={account.id} value={account.id}>
                                        {account.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>
                        Cancelar
                    </Button>
                    <Button onClick={handleExport} disabled={loading}>
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Exportando...
                            </>
                        ) : (
                            <>
                                <Download className="w-4 h-4 mr-2" />
                                Exportar
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
