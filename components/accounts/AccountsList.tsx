"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    MoreVertical,
    Trash2,
    Wallet,
    CreditCard,
    PiggyBank,
    Banknote,
    TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import type { Account } from "@/types/database";

interface AccountWithBalance extends Account {
    currentBalance: number;
}

interface AccountsListProps {
    accounts: AccountWithBalance[];
}

const typeConfig: Record<
    string,
    { label: string; icon: typeof Wallet; color: string }
> = {
    bank: {
        label: "Bancaria",
        icon: Wallet,
        color: "bg-blue-500/10 text-blue-500",
    },
    savings: {
        label: "Ahorro",
        icon: PiggyBank,
        color: "bg-emerald-500/10 text-emerald-500",
    },
    cash: {
        label: "Efectivo",
        icon: Banknote,
        color: "bg-amber-500/10 text-amber-500",
    },
    investment: {
        label: "Inversión",
        icon: TrendingUp,
        color: "bg-violet-500/10 text-violet-500",
    },
};

export default function AccountsList({ accounts }: AccountsListProps) {
    const router = useRouter();
    const supabase = createClient();

    const handleDelete = async (accountId: string) => {
        try {
            const { error } = await supabase
                .from("accounts")
                .delete()
                .eq("id", accountId);

            if (error) throw error;

            toast.success("Cuenta eliminada");
            router.refresh();
        } catch (error) {
            toast.error("Error al eliminar la cuenta");
            console.error(error);
        }
    };

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat("es-ES", {
            style: "currency",
            currency: "EUR",
        }).format(value);

    if (accounts.length === 0) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Wallet className="w-16 h-16 mb-4 opacity-50" />
                    <p className="text-lg font-medium">No hay cuentas</p>
                    <p className="text-sm mt-1">Añade tu primera cuenta para empezar</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-muted-foreground" />
                    Mis Cuentas
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                    {accounts.map((account) => {
                        const config = typeConfig[account.type] || typeConfig.checking;
                        const Icon = config.icon;
                        const isNegative = account.currentBalance < 0;

                        return (
                            <div
                                key={account.id}
                                className="p-4 rounded-xl border bg-card hover:bg-accent/30 transition-colors"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-3 rounded-xl ${config.color}`}>
                                            <Icon className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="font-semibold">{account.name}</p>
                                            <Badge variant="secondary" className="text-xs mt-1">
                                                {config.label}
                                            </Badge>
                                        </div>
                                    </div>

                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <MoreVertical className="w-4 h-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem
                                                onClick={() => handleDelete(account.id)}
                                                className="text-destructive"
                                            >
                                                <Trash2 className="w-4 h-4 mr-2" />
                                                Eliminar
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>

                                <div className="mt-4">
                                    <p className="text-xs text-muted-foreground">Saldo actual</p>
                                    <p
                                        className={`text-2xl font-bold ${isNegative ? "text-rose-500" : ""
                                            }`}
                                    >
                                        {formatCurrency(account.currentBalance)}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Balance inicial: {formatCurrency(account.initial_balance || 0)}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
