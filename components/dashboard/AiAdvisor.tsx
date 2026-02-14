"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Bot, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { getFinancialAdvice } from "@/actions/getFinancialAdvice";

interface AiAdvisorProps {
    transactions: any[];
    budgets: any[];
    currency?: string;
}

export default function AiAdvisor({ transactions, budgets, currency = "EUR" }: AiAdvisorProps) {
    const [loading, setLoading] = useState(false);
    const [advice, setAdvice] = useState<string | null>(null);

    const handleAnalyze = async () => {
        setLoading(true);
        try {
            const result = await getFinancialAdvice(transactions, budgets, currency);
            setAdvice(result);
        } catch (error) {
            console.error(error);
            setAdvice("Hubo un error al conectar con el asistente.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="col-span-full border-2 border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-blue-500/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-semibold flex items-center gap-2 text-primary">
                    <Bot className="w-5 h-5 text-purple-600" />
                    Financial Coach IA
                </CardTitle>
                {!advice && !loading && (
                    <Sparkles className="w-4 h-4 text-yellow-500 animate-pulse" />
                )}
            </CardHeader>
            <CardContent>
                {!advice ? (
                    <div className="flex flex-col items-center justify-center py-6 gap-4">
                        <p className="text-muted-foreground text-center max-w-md">
                            Deja que nuestra IA analice tus patrones de gasto y te dé consejos personalizados para mejorar tu ahorro.
                        </p>
                        <Button
                            onClick={handleAnalyze}
                            disabled={loading}
                            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold shadow-lg transition-all hover:scale-105"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Analizando tus finanzas...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4 mr-2" />
                                    Analizar mis gastos con IA
                                </>
                            )}
                        </Button>
                    </div>
                ) : (
                    <div className="prose prose-sm dark:prose-invert max-w-none animate-in fade-in duration-500">
                        <ReactMarkdown>{advice}</ReactMarkdown>
                        <div className="mt-4 flex justify-end">
                            <Button variant="ghost" size="sm" onClick={() => setAdvice(null)} className="text-xs text-muted-foreground">
                                Cerrar análisis
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
