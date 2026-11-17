"use client";

import { useEffect, useState } from "react";
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
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    ArrowUpRight,
    ArrowDownLeft,
    ArrowLeftRight,
    Search,
    Filter,
    Calendar,
    Wallet,
    Tag,
    Trash2,
    Paperclip,
    Pencil,
    Loader2,
} from "lucide-react";
import type { Transaction, Account, Category, Receipt } from "@/types/database";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { createClient } from "@/utils/supabase/client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { collectDeleteIds, getTransactionKind } from "@/utils/transactionKind";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import ReceiptDialog from "@/components/receipts/ReceiptDialog";
import EditTransactionDialog from "@/components/transactions/EditTransactionDialog";

interface TransactionsListProps {
    transactions: Transaction[];
    accounts: Account[];
    categories?: Category[];
    currency?: string;
}

export default function TransactionsList({
    transactions,
    accounts,
    categories = [],
    currency = "EUR",
}: TransactionsListProps) {
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense" | "transfer" | "adjustment">("all");
    const [dateRange, setDateRange] = useState<"all" | "today" | "week" | "month">("all");
    const [accountFilter, setAccountFilter] = useState<string>("all");
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const [categoryFilter, setCategoryFilter] = useState(searchParams.get("category") || "all");

    useEffect(() => {
        setCategoryFilter(searchParams.get("category") || "all");
    }, [searchParams]);

    const handleCategoryChange = (value: string) => {
        setCategoryFilter(value);
        const params = new URLSearchParams(searchParams.toString());
        if (value === "all") {
            params.delete("category");
        } else {
            params.set("category", value);
        }
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname);
    };

    // Modal states
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
    const [isDeletingSingle, setIsDeletingSingle] = useState(false);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
    const [isSelectionMode, setIsSelectionMode] = useState(false);

    const supabase = createClient();
    const router = useRouter();

    // Filter transactions
    const filteredTransactions = transactions.filter((t) => {
        const kind = getTransactionKind(t);

        // Search filter
        const searchMatch =
            search === "" ||
            Boolean(t.description?.toLowerCase().includes(search.toLowerCase())) ||
            Boolean(t.category?.name.toLowerCase().includes(search.toLowerCase())) ||
            Boolean(t.account?.name.toLowerCase().includes(search.toLowerCase()));

        // Type filter
        let typeMatch = true;
        if (typeFilter === "income") {
            typeMatch = kind === "income";
        } else if (typeFilter === "expense") {
            typeMatch = kind === "expense";
        } else if (typeFilter === "transfer") {
            typeMatch = kind === "transfer";
        } else if (typeFilter === "adjustment") {
            typeMatch = kind === "adjustment";
        }

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

        let categoryMatch = true;
        if (categoryFilter === "uncategorized") {
            categoryMatch = !t.category_id;
        } else if (categoryFilter !== "all") {
            categoryMatch = t.category_id === categoryFilter;
        }

        return searchMatch && typeMatch && dateMatch && accountMatch && categoryMatch;
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

    // Toggle selection of a transaction
    const toggleSelection = (id: string) => {
        const newSelected = new Set(selectedItems);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedItems(newSelected);
    };

    // Toggle all visible transactions
    const toggleAll = () => {
        if (selectedItems.size === filteredTransactions.length) {
            setSelectedItems(new Set());
        } else {
            const allIds = new Set(filteredTransactions.map((t) => t.id));
            setSelectedItems(allIds);
        }
    };

    // Handle bulk delete
    const handleBulkDelete = async () => {
        if (!confirm(`¿Estás seguro de que quieres eliminar ${selectedItems.size} transacciones?`)) return;

        try {
            const ids = collectDeleteIds(transactions, selectedItems);
            const { error } = await supabase
                .from("transactions")
                .delete()
                .in("id", ids);

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

    // Handle single direct delete
    const handleConfirmSingleDelete = async () => {
        if (!transactionToDelete) return;

        setIsDeletingSingle(true);
        try {
            const ids = collectDeleteIds(transactions, [transactionToDelete.id]);
            const { error } = await supabase
                .from("transactions")
                .delete()
                .in("id", ids);

            if (error) throw error;

            toast.success("Transacción eliminada correctamente");
            setTransactionToDelete(null);
            router.refresh();
        } catch (error) {
            toast.error("Error al eliminar la transacción");
            console.error(error);
        } finally {
            setIsDeletingSingle(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row gap-4 justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-muted-foreground" />
                        Historial de Transacciones
                    </CardTitle>

                    {/* Action Bar */}
                    <div className="flex flex-wrap gap-2 items-center">
                        {selectedItems.size > 0 && (
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={handleBulkDelete}
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
                                placeholder="Buscar transacción..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9"
                            />
                        </div>

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
                                <SelectItem value="transfer">Transferencias</SelectItem>
                                <SelectItem value="adjustment">Reconciliar</SelectItem>
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
                                <SelectItem value="all">Todo el tiempo</SelectItem>
                                <SelectItem value="today">Hoy</SelectItem>
                                <SelectItem value="week">Última semana</SelectItem>
                                <SelectItem value="month">Último mes</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Category Filter */}
                        <Select
                            value={categoryFilter}
                            onValueChange={handleCategoryChange}
                        >
                            <SelectTrigger className="w-44">
                                <Tag className="w-4 h-4 mr-2" />
                                <SelectValue placeholder="Categoría" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas las categorías</SelectItem>
                                <SelectItem value="uncategorized">Sin categoría</SelectItem>
                                {[...categories]
                                    .sort((a, b) => a.name.localeCompare(b.name, "es"))
                                    .map((category) => (
                                        <SelectItem key={category.id} value={category.id}>
                                            {category.icon ? `${category.icon} ` : ""}{category.name}
                                        </SelectItem>
                                    ))}
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
                            .map(([date, groupList]) => (
                                <div key={date}>
                                    <h3 className="text-sm font-medium text-muted-foreground mb-3">
                                        {format(new Date(date), "EEEE, d 'de' MMMM", { locale: es })}
                                    </h3>
                                    <div className="space-y-2">
                                        {groupList.map((transaction) => {
                                            const kind = getTransactionKind(transaction);
                                            const isIncome = transaction.amount >= 0;
                                            const isTransfer = kind === "transfer";
                                            const isAdjustment = kind === "adjustment";
                                            const formattedAmount = new Intl.NumberFormat("es-ES", {
                                                style: "currency",
                                                currency: currency,
                                            }).format(Math.abs(transaction.amount));

                                            return (
                                                <div
                                                    key={transaction.id}
                                                    className={`group flex items-center justify-between p-3.5 sm:p-4 rounded-xl transition-all cursor-pointer ${
                                                        selectedItems.has(transaction.id)
                                                            ? "bg-primary/10 border-primary border"
                                                            : "bg-accent/30 hover:bg-accent/60 border border-transparent hover:border-border"
                                                    }`}
                                                    onClick={() => {
                                                        if (isSelectionMode) {
                                                            toggleSelection(transaction.id);
                                                        } else {
                                                            setEditingTransaction(transaction);
                                                        }
                                                    }}
                                                    onContextMenu={(e) => {
                                                        e.preventDefault();
                                                        if (!isSelectionMode) {
                                                            setIsSelectionMode(true);
                                                            toggleSelection(transaction.id);
                                                        }
                                                    }}
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        {isSelectionMode && (
                                                            <Checkbox
                                                                checked={selectedItems.has(transaction.id)}
                                                                onCheckedChange={() => toggleSelection(transaction.id)}
                                                            />
                                                        )}
                                                        <div
                                                            className={`p-2.5 rounded-xl shrink-0 ${
                                                                isTransfer || isAdjustment
                                                                    ? "bg-blue-500/10 text-blue-500"
                                                                    : isIncome
                                                                    ? "bg-emerald-500/10 text-emerald-500"
                                                                    : "bg-rose-500/10 text-rose-500"
                                                            }`}
                                                        >
                                                            {isTransfer || isAdjustment ? (
                                                                <ArrowLeftRight className="w-5 h-5" />
                                                            ) : isIncome ? (
                                                                <ArrowDownLeft className="w-5 h-5" />
                                                            ) : (
                                                                <ArrowUpRight className="w-5 h-5" />
                                                            )}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="font-medium text-sm sm:text-base flex items-center gap-2 truncate">
                                                                <span className="truncate">
                                                                    {transaction.description ||
                                                                        transaction.category?.name ||
                                                                        "Sin descripción"}
                                                                </span>
                                                                {transaction.receipts && transaction.receipts.length > 0 && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-6 w-6 text-muted-foreground hover:text-primary shrink-0"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            if (transaction.receipts && transaction.receipts.length > 0) {
                                                                                setSelectedReceipt(transaction.receipts[0]);
                                                                            }
                                                                        }}
                                                                    >
                                                                        <Paperclip className="w-3.5 h-3.5" />
                                                                    </Button>
                                                                )}
                                                            </p>
                                                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1">
                                                                {transaction.category ? (
                                                                    <Badge variant="secondary" className="text-xs">
                                                                        {transaction.category.icon ? `${transaction.category.icon} ` : ""}
                                                                        {transaction.category.name}
                                                                    </Badge>
                                                                ) : isTransfer ? (
                                                                    <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-500 border-blue-500/20">
                                                                        <ArrowLeftRight className="w-3 h-3 mr-1 inline" />
                                                                        Transferencia
                                                                    </Badge>
                                                                ) : isAdjustment ? (
                                                                    <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/20">
                                                                        Reconciliar
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge variant="secondary" className="text-xs">
                                                                        Sin categoría
                                                                    </Badge>
                                                                )}

                                                                <span className="text-xs text-muted-foreground font-medium">
                                                                    {transaction.account?.name}
                                                                </span>

                                                                {transaction.is_recurring && (
                                                                    <Badge variant="outline" className="text-xs">
                                                                        Recurrente
                                                                    </Badge>
                                                                )}

                                                                {transaction.goal && (
                                                                    <Badge variant="outline" className="text-xs border-primary/50 text-primary">
                                                                        {transaction.goal.icon} {transaction.goal.name}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Amount and direct action buttons */}
                                                    <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-3">
                                                        <span
                                                            className={`font-bold text-base sm:text-lg ${
                                                                isTransfer || isAdjustment
                                                                    ? "text-blue-500"
                                                                    : isIncome
                                                                    ? "text-emerald-500"
                                                                    : "text-rose-500"
                                                            }`}
                                                        >
                                                            {isIncome ? "+" : "-"}{formattedAmount}
                                                        </span>

                                                        {/* Direct action buttons (edit and delete) */}
                                                        {!isSelectionMode && (
                                                            <div className="flex items-center gap-0.5 sm:gap-1">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-background/80"
                                                                    title="Modificar transacción"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setEditingTransaction(transaction);
                                                                    }}
                                                                >
                                                                    <Pencil className="w-3.5 h-3.5" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                                    title="Borrar transacción"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setTransactionToDelete(transaction);
                                                                    }}
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                    </div>
                )}
            </CardContent>

            {/* Edit Transaction Dialog */}
            <EditTransactionDialog
                transaction={editingTransaction}
                open={!!editingTransaction}
                onOpenChange={(open) => !open && setEditingTransaction(null)}
                accounts={accounts}
                categories={categories}
            />

            {/* Quick single-delete confirmation dialog */}
            <AlertDialog
                open={!!transactionToDelete}
                onOpenChange={(open) => !open && setTransactionToDelete(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar esta transacción?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción eliminará el registro seleccionado permanentemente y recalculará
                            el balance de tu cuenta.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeletingSingle}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmSingleDelete}
                            disabled={isDeletingSingle}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeletingSingle ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Eliminando...
                                </>
                            ) : (
                                "Eliminar"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Receipt Dialog */}
            <ReceiptDialog
                receipt={selectedReceipt}
                open={!!selectedReceipt}
                onOpenChange={(open) => !open && setSelectedReceipt(null)}
            />
        </Card>
    );
}
