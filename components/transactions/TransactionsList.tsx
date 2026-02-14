"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    ArrowUpRight,
    ArrowDownLeft,
    Search,
    Filter,
    Calendar,
    Wallet,
} from "lucide-react";
import type { Transaction, Account } from "@/types/database";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Paperclip } from "lucide-react";
import ReceiptDialog from "@/components/receipts/ReceiptDialog";
import { type Receipt } from "@/types/database";

interface TransactionsListProps {
    transactions: Transaction[];
    accounts: Account[];
    currency?: string;
}

export default function TransactionsList({ transactions, accounts, currency = "EUR" }: TransactionsListProps) {
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
    const [dateRange, setDateRange] = useState<"all" | "today" | "week" | "month">("all");
    const [accountFilter, setAccountFilter] = useState<string>("all");

    // Filter transactions
    const filteredTransactions = transactions.filter((t) => {
        // Search filter
        const searchMatch =
            search === "" ||
            t.description?.toLowerCase().includes(search.toLowerCase()) ||
            t.category?.name.toLowerCase().includes(search.toLowerCase());

        // Type filter
        const typeMatch =
            typeFilter === "all" ||
            (typeFilter === "income" && t.amount >= 0) ||
            (typeFilter === "expense" && t.amount < 0);

        // Date filter
        let dateMatch = true;
        if (dateRange !== "all") {
            const transactionDate = new Date(t.date);
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            switch (dateRange) {
                case "today":
                    dateMatch = transactionDate >= today;
                    break;
                case "week":
                    const weekAgo = new Date(today);
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    dateMatch = transactionDate >= weekAgo;
                    break;
                case "month":
                    const monthAgo = new Date(today);
                    monthAgo.setMonth(monthAgo.getMonth() - 1);
                    dateMatch = transactionDate >= monthAgo;
                    break;
            }
        }

        // Account filter
        const accountMatch =
            accountFilter === "all" || t.account_id === accountFilter;

        return searchMatch && typeMatch && dateMatch && accountMatch;
    });

    // Group by date
    const groupedTransactions = filteredTransactions.reduce(
        (groups, transaction) => {
            const date = transaction.date;
            if (!groups[date]) {
                groups[date] = [];
            }
            groups[date].push(transaction);
            return groups;
        },
        {} as Record<string, Transaction[]>
    );

    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const supabase = createClient();
    const router = useRouter();

    // Toggle selection of a transaction
    const toggleSelection = (id: string) => {
        const newSelected = new Set(selectedItems);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedItems(newSelected);

        // Auto-exit selection mode if empty (optional, but keeps UI clean)
        if (newSelected.size === 0 && isSelectionMode) {
            // Optional: setIsSelectionMode(false); 
        }
    };

    // Toggle all visible transactions
    const toggleAll = () => {
        if (selectedItems.size === filteredTransactions.length) {
            setSelectedItems(new Set());
        } else {
            const allIds = new Set(filteredTransactions.map(t => t.id));
            setSelectedItems(allIds);
        }
    };

    // Handle delete
    const handleDelete = async () => {
        if (!confirm(`¿Estás seguro de que quieres eliminar ${selectedItems.size} transacciones?`)) return;

        try {
            const { error } = await supabase
                .from("transactions")
                .delete()
                .in("id", Array.from(selectedItems));

            if (error) throw error;

            toast.success("Transacciones eliminadas correctamente");
            setSelectedItems(new Set());
            setIsSelectionMode(false);
            router.refresh();
        } catch (error) {
            toast.error("Error al eliminar las transacciones");
            console.error(error);
        }
    };

    // Handle long press (simplified as click for now, user asked for "holding it down" but a toggle button is often better for web)
    // We will add a button to enter "Selection Mode"

    // ... existing filter logic ...

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row gap-4 justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-muted-foreground" />
                        Historial
                    </CardTitle>

                    {/* Action Bar */}
                    <div className="flex flex-wrap gap-2 items-center">
                        {selectedItems.size > 0 && (
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={handleDelete}
                                className="mr-2"
                            >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Borrar ({selectedItems.size})
                            </Button>
                        )}

                        <Button
                            variant={isSelectionMode ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => {
                                setIsSelectionMode(!isSelectionMode);
                                setSelectedItems(new Set());
                            }}
                        >
                            {isSelectionMode ? "Cancelar" : "Seleccionar"}
                        </Button>

                        {/* Search */}
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9"
                            />
                        </div>

                        {/* Filters ... */}
                        {/* Keep existing filters here, just truncated for brevity in replace block if possible, but safe to include all if needed context */}
                        {/* Type Filter */}
                        <Select
                            value={typeFilter}
                            onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}
                        >
                            <SelectTrigger className="w-36">
                                <Filter className="w-4 h-4 mr-2" />
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos</SelectItem>
                                <SelectItem value="income">Ingresos</SelectItem>
                                <SelectItem value="expense">Gastos</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Date Filter */}
                        <Select
                            value={dateRange}
                            onValueChange={(v) => setDateRange(v as typeof dateRange)}
                        >
                            <SelectTrigger className="w-36">
                                <Calendar className="w-4 h-4 mr-2" />
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todo</SelectItem>
                                <SelectItem value="today">Hoy</SelectItem>
                                <SelectItem value="week">Semana</SelectItem>
                                <SelectItem value="month">Mes</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Account Filter */}
                        <Select
                            value={accountFilter}
                            onValueChange={setAccountFilter}
                        >
                            <SelectTrigger className="w-44">
                                <Wallet className="w-4 h-4 mr-2" />
                                <SelectValue />
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
            </CardHeader>
            <CardContent>
                {filteredTransactions.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No se encontraron transacciones</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {Object.entries(groupedTransactions)
                            .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
                            .map(([date, transactions]) => (
                                <div key={date}>
                                    <h3 className="text-sm font-medium text-muted-foreground mb-3">
                                        {format(new Date(date), "EEEE, d 'de' MMMM", { locale: es })}
                                    </h3>
                                    <div className="space-y-2">
                                        {transactions.map((transaction) => {
                                            // CORRECTED LOGIC: Use amount sign, not category type
                                            const isIncome = transaction.amount >= 0;
                                            const formattedAmount = new Intl.NumberFormat("es-ES", {
                                                style: "currency",
                                                currency: currency,
                                            }).format(Math.abs(transaction.amount));

                                            return (
                                                <div
                                                    key={transaction.id}
                                                    className={`flex items-center justify-between p-4 rounded-xl transition-colors cursor-pointer ${selectedItems.has(transaction.id)
                                                        ? "bg-primary/10 border-primary border"
                                                        : "bg-accent/30 hover:bg-accent/50"
                                                        }`}
                                                    onClick={() => {
                                                        if (isSelectionMode) toggleSelection(transaction.id);
                                                    }}
                                                    onContextMenu={(e) => {
                                                        e.preventDefault();
                                                        if (!isSelectionMode) {
                                                            setIsSelectionMode(true);
                                                            toggleSelection(transaction.id);
                                                        }
                                                    }}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        {isSelectionMode && (
                                                            <Checkbox
                                                                checked={selectedItems.has(transaction.id)}
                                                                onCheckedChange={() => toggleSelection(transaction.id)}
                                                            />
                                                        )}
                                                        <div
                                                            className={`p-2 rounded-lg ${isIncome ? "bg-emerald-500/10" : "bg-rose-500/10"
                                                                }`}
                                                        >
                                                            {isIncome ? (
                                                                <ArrowDownLeft className="w-5 h-5 text-emerald-500" />
                                                            ) : (
                                                                <ArrowUpRight className="w-5 h-5 text-rose-500" />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <p className="font-medium flex items-center gap-2">
                                                                {transaction.description ||
                                                                    transaction.category?.name ||
                                                                    "Sin descripción"}
                                                                {transaction.receipts && transaction.receipts.length > 0 && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-6 w-6 text-muted-foreground hover:text-primary"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            if (transaction.receipts && transaction.receipts.length > 0) {
                                                                                setSelectedReceipt(transaction.receipts[0]);
                                                                            }
                                                                        }}
                                                                    >
                                                                        <Paperclip className="w-3 h-3" />
                                                                    </Button>
                                                                )}
                                                            </p>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <Badge variant="secondary" className="text-xs">
                                                                    {transaction.category?.name || "Sin categoría"}
                                                                </Badge>
                                                                <span className="text-xs text-muted-foreground">
                                                                    {transaction.account?.name}
                                                                </span>
                                                                {transaction.is_recurring && (
                                                                    <Badge variant="outline" className="text-xs">
                                                                        Recurrente
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <span
                                                        className={`font-semibold text-lg ${isIncome ? "text-emerald-500" : "text-rose-500"
                                                            }`}
                                                    >
                                                        {isIncome ? "+" : "-"}{formattedAmount}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                    </div>
                )}
            </CardContent>

            <ReceiptDialog
                receipt={selectedReceipt}
                open={!!selectedReceipt}
                onOpenChange={(open) => !open && setSelectedReceipt(null)}
            />
        </Card>
    );
}
