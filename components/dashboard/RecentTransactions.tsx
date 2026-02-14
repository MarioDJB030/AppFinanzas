"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, ArrowDownLeft, ArrowRight } from "lucide-react";
import type { Transaction } from "@/types/database";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface RecentTransactionsProps {
    transactions: any[];
    currency?: string;
}

export default function RecentTransactions({ transactions, currency = "EUR" }: RecentTransactionsProps) {
    if (transactions.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Últimas Transacciones</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                    <ArrowUpRight className="w-12 h-12 mb-4 opacity-50" />
                    <p>No hay transacciones registradas</p>
                    <Button asChild variant="link" className="mt-2">
                        <Link href="/transactions">Añadir transacción</Link>
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Últimas Transacciones</CardTitle>
                <Button asChild variant="ghost" size="sm">
                    <Link href="/transactions" className="flex items-center gap-1">
                        Ver todas
                        <ArrowRight className="w-4 h-4" />
                    </Link>
                </Button>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {transactions.map((transaction) => {
                        const isIncome = transaction.category?.type === "income";
                        const formattedAmount = new Intl.NumberFormat("es-ES", {
                            style: "currency",
                            currency: "EUR",
                        }).format(Math.abs(transaction.amount));

                        return (
                            <div
                                key={transaction.id}
                                className="flex items-center justify-between p-3 rounded-xl bg-accent/30 hover:bg-accent/50 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div
                                        className={`p-2 rounded-lg ${isIncome ? "bg-emerald-500/10" : "bg-rose-500/10"
                                            }`}
                                    >
                                        {isIncome ? (
                                            <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
                                        ) : (
                                            <ArrowUpRight className="w-4 h-4 text-rose-500" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm">
                                            {transaction.description || transaction.category?.name || "Sin descripción"}
                                        </p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <Badge variant="secondary" className="text-xs">
                                                {transaction.category?.name || "Sin categoría"}
                                            </Badge>
                                            <span className="text-xs text-muted-foreground">
                                                {format(new Date(transaction.date), "d MMM", { locale: es })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className={`font-bold ${transaction.amount > 0 ? "text-emerald-500" : "text-foreground"}`}>
                                    {transaction.amount > 0 ? "+" : ""}
                                    {new Intl.NumberFormat("es-ES", {
                                        style: "currency",
                                        currency: currency,
                                    }).format(transaction.amount)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
