"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Upload,
    FileSpreadsheet,
    Loader2,
    Check,
    X,
    ArrowRight,
    AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { Account, Category } from "@/types/database";
import { kindFromAmount } from "@/utils/transactionKind";
import {
    buildTableFromMatrix,
    detectColumnMapping,
    isLikelyTransfer,
    isTradeRepublicInvestmentRow,
    parseAmount,
    parseNormalizedDate,
    resolveRowDescription,
    suggestCategoryId,
    type ColumnMapping,
    type ReviewRow,
} from "@/utils/csvImportHelpers";

interface CSVImporterProps {
    accounts: Account[];
    categories: Category[];
}

const BANK_LABELS: Record<"imagin" | "trade_republic" | "generic", string> = {
    imagin: "Imagin / CaixaBank detectado",
    trade_republic: "Trade Republic detectado",
    generic: "CSV / Excel genérico",
};

export default function CSVImporter({ accounts, categories }: CSVImporterProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [step, setStep] = useState<"upload" | "map" | "review" | "complete">("upload");
    const [file, setFile] = useState<File | null>(null);
    const [headers, setHeaders] = useState<string[]>([]);
    const [data, setData] = useState<Record<string, string>[]>([]);
    const [isTradeRepublic, setIsTradeRepublic] = useState(false);
    const [detectedBank, setDetectedBank] = useState<"imagin" | "trade_republic" | "generic">("generic");
    const [mapping, setMapping] = useState<ColumnMapping>({
        date: "",
        amount: "",
        description: "",
    });
    const [accountId, setAccountId] = useState("");
    const [defaultCategoryId, setDefaultCategoryId] = useState("");
    const [minDate, setMinDate] = useState("");
    const [excludeTrInvestments, setExcludeTrInvestments] = useState(true);
    const [reviewRows, setReviewRows] = useState<ReviewRow[]>([]);
    const [preparingReview, setPreparingReview] = useState(false);
    const [loading, setLoading] = useState(false);
    const [importResult, setImportResult] = useState<{ success: number; failed: number }>({
        success: 0,
        failed: 0,
    });

    const router = useRouter();
    const supabase = createClient();

    const sortedCategories = useMemo(
        () => [...categories].sort((a, b) => a.name.localeCompare(b.name, "es")),
        [categories]
    );

    const applyParsedMatrix = useCallback((matrix: string[][]) => {
        const parsed = buildTableFromMatrix(matrix);
        if (parsed.headers.length === 0 || parsed.rows.length === 0) {
            toast.error("El archivo no contiene filas válidas para importar");
            return;
        }
        setHeaders(parsed.headers);
        setData(parsed.rows);
        setIsTradeRepublic(parsed.isTradeRepublic);
        setDetectedBank(parsed.detectedBank);
        setExcludeTrInvestments(parsed.isTradeRepublic);
        setMapping(detectColumnMapping(parsed.headers));
        setStep("map");
    }, []);

    const parseFile = useCallback(
        (selectedFile: File) => {
            const extension = selectedFile.name.split(".").pop()?.toLowerCase();

            if (extension === "csv") {
                Papa.parse<string[]>(selectedFile, {
                    header: false,
                    skipEmptyLines: true,
                    complete: (results) => {
                        applyParsedMatrix(results.data);
                    },
                    error: (error) => {
                        toast.error("Error al leer el archivo CSV", {
                            description: error.message,
                        });
                    },
                });
            } else if (extension === "xlsx" || extension === "xls") {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const workbook = XLSX.read(e.target?.result, { type: "binary" });
                        const sheetName = workbook.SheetNames[0];
                        const sheet = workbook.Sheets[sheetName];
                        const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, {
                            header: 1,
                            raw: false,
                        });
                        applyParsedMatrix(matrix);
                    } catch (error) {
                        toast.error("Error al leer el archivo Excel", {
                            description: String(error),
                        });
                    }
                };
                reader.readAsBinaryString(selectedFile);
            } else {
                toast.error("Formato no soportado", {
                    description: "Por favor, usa un archivo .csv, .xlsx o .xls",
                });
            }
        },
        [applyParsedMatrix]
    );

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            parseFile(selectedFile);
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) {
            setFile(droppedFile);
            parseFile(droppedFile);
        }
    };

    const filteredPreviewCount = useMemo(() => {
        if (!mapping.date || !mapping.amount) return 0;
        let count = 0;
        for (const row of data) {
            if (isTradeRepublic && excludeTrInvestments && isTradeRepublicInvestmentRow(row)) {
                continue;
            }
            const parsedDate = parseNormalizedDate(row[mapping.date] ?? "");
            const parsedAmount = parseAmount(row[mapping.amount] ?? "");
            if (!parsedDate || Number.isNaN(parsedAmount)) continue;
            if (minDate && parsedDate < minDate) continue;
            count++;
        }
        return count;
    }, [data, mapping, isTradeRepublic, excludeTrInvestments, minDate]);

    const handlePrepareReview = async () => {
        if (!mapping.date || !mapping.amount || !accountId) {
            toast.error("Por favor, completa todos los campos requeridos");
            return;
        }

        setPreparingReview(true);
        try {
            const candidateRows: Array<{
                date: string;
                amount: number;
                description: string;
                rawRow: Record<string, string>;
            }> = [];

            for (const row of data) {
                if (isTradeRepublic && excludeTrInvestments && isTradeRepublicInvestmentRow(row)) {
                    continue;
                }
                const parsedDate = parseNormalizedDate(row[mapping.date] ?? "");
                const parsedAmount = parseAmount(row[mapping.amount] ?? "");
                if (!parsedDate || Number.isNaN(parsedAmount)) continue;
                if (minDate && parsedDate < minDate) continue;

                const description = resolveRowDescription(row, mapping.description, isTradeRepublic);
                candidateRows.push({
                    date: parsedDate,
                    amount: parsedAmount,
                    description,
                    rawRow: row,
                });
            }

            if (candidateRows.length === 0) {
                toast.error("No quedan filas válidas con los filtros actuales");
                return;
            }

            const earliestDate = candidateRows.reduce(
                (min, r) => (r.date < min ? r.date : min),
                candidateRows[0].date
            );

            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) throw new Error("No user");

            const { data: existingTxs, error: existingError } = await supabase
                .from("transactions")
                .select("date, amount")
                .eq("user_id", user.id)
                .eq("account_id", accountId)
                .gte("date", earliestDate);

            if (existingError) throw existingError;

            const existingCounts = new Map<string, number>();
            for (const tx of existingTxs ?? []) {
                const key = `${tx.date}|${Number(tx.amount).toFixed(2)}`;
                existingCounts.set(key, (existingCounts.get(key) ?? 0) + 1);
            }

            const prepared: ReviewRow[] = candidateRows.map((item, idx) => {
                const key = `${item.date}|${item.amount.toFixed(2)}`;
                const remainingDupes = existingCounts.get(key) ?? 0;
                const isDuplicate = remainingDupes > 0;
                if (isDuplicate) {
                    existingCounts.set(key, remainingDupes - 1);
                }

                const isTransfer = isLikelyTransfer(item.description, item.rawRow);
                const suggestedCategory = isTransfer
                    ? ""
                    : suggestCategoryId(
                          item.description,
                          item.amount,
                          sortedCategories,
                          defaultCategoryId
                      );

                return {
                    id: `${idx}-${item.date}-${item.amount}`,
                    date: item.date,
                    amount: item.amount,
                    description: item.description,
                    isTransfer,
                    categoryId: suggestedCategory,
                    selected: !isDuplicate,
                    isDuplicate,
                };
            });

            setReviewRows(prepared);
            setStep("review");
        } catch (error) {
            console.error(error);
            toast.error("Error al preparar la revisión");
        } finally {
            setPreparingReview(false);
        }
    };

    const selectedRows = useMemo(() => reviewRows.filter((r) => r.selected), [reviewRows]);
    const duplicateCount = useMemo(() => reviewRows.filter((r) => r.isDuplicate).length, [reviewRows]);
    const allSelected = reviewRows.length > 0 && selectedRows.length === reviewRows.length;

    const toggleAllRows = () => {
        const next = !allSelected;
        setReviewRows((prev) => prev.map((r) => ({ ...r, selected: next })));
    };

    const updateReviewRow = (id: string, patch: Partial<ReviewRow>) => {
        setReviewRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    };

    const applyDefaultCategoryToEmpty = (catId: string) => {
        setDefaultCategoryId(catId);
        if (!catId) return;
        setReviewRows((prev) =>
            prev.map((r) => (r.isTransfer ? r : { ...r, categoryId: catId }))
        );
    };

    const handleImport = async () => {
        if (selectedRows.length === 0 || !accountId) {
            toast.error("Selecciona al menos una transacción para importar");
            return;
        }

        setLoading(true);
        let success = 0;
        let failed = 0;

        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) throw new Error("No user");

            const payloads = selectedRows.map((row) => ({
                user_id: user.id,
                account_id: accountId,
                category_id: row.isTransfer ? null : row.categoryId || null,
                amount: Number(row.amount.toFixed(2)),
                description: row.description.trim() || null,
                date: row.date,
                is_recurring: false,
                kind: row.isTransfer ? ("transfer" as const) : kindFromAmount(row.amount),
            }));

            const chunkSize = 100;
            for (let i = 0; i < payloads.length; i += chunkSize) {
                const chunk = payloads.slice(i, i + chunkSize);
                const { error } = await supabase.from("transactions").insert(chunk);
                if (error) {
                    failed += chunk.length;
                } else {
                    success += chunk.length;
                }
            }

            setImportResult({ success, failed });
            setStep("complete");
            router.refresh();
        } catch (error) {
            toast.error("Error al importar", {
                description: String(error),
            });
        } finally {
            setLoading(false);
        }
    };

    const resetImporter = () => {
        setFile(null);
        setHeaders([]);
        setData([]);
        setIsTradeRepublic(false);
        setDetectedBank("generic");
        setMapping({ date: "", amount: "", description: "" });
        setAccountId("");
        setDefaultCategoryId("");
        setMinDate("");
        setExcludeTrInvestments(true);
        setReviewRows([]);
        setStep("upload");
        setImportResult({ success: 0, failed: 0 });
    };

    const handleClose = () => {
        setIsOpen(false);
        setTimeout(resetImporter, 300);
    };

    const formatMoney = (val: number) =>
        new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(val);

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    Importar CSV
                </Button>
            </DialogTrigger>
            <DialogContent
                className={
                    step === "review"
                        ? "sm:max-w-4xl max-h-[90vh] flex flex-col"
                        : "sm:max-w-lg max-h-[90vh] overflow-y-auto"
                }
            >
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5" />
                        Importar Transacciones
                    </DialogTitle>
                    <DialogDescription>
                        {step === "upload" && "Sube un archivo CSV o Excel de Imagin, Trade Republic u otro banco"}
                        {step === "map" && "Verifica las columnas y aplica filtros antes de revisar"}
                        {step === "review" && "Revisa, edita o desmarca movimientos antes de importar"}
                        {step === "complete" && "Importación completada"}
                    </DialogDescription>
                </DialogHeader>

                {/* Step indicators */}
                <div className="flex items-center justify-center gap-2 py-2 shrink-0">
                    {["upload", "map", "review", "complete"].map((s, i) => (
                        <div key={s} className="flex items-center">
                            <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                                    step === s
                                        ? "bg-primary text-primary-foreground"
                                        : ["upload", "map", "review", "complete"].indexOf(step) > i
                                          ? "bg-primary/20 text-primary"
                                          : "bg-muted text-muted-foreground"
                                }`}
                            >
                                {["upload", "map", "review", "complete"].indexOf(step) > i ? (
                                    <Check className="w-4 h-4" />
                                ) : (
                                    i + 1
                                )}
                            </div>
                            {i < 3 && (
                                <div
                                    className={`w-8 h-0.5 ${
                                        ["upload", "map", "review", "complete"].indexOf(step) > i
                                            ? "bg-primary"
                                            : "bg-muted"
                                    }`}
                                />
                            )}
                        </div>
                    ))}
                </div>

                {/* Step: Upload */}
                {step === "upload" && (
                    <div
                        className="border-2 border-dashed border-muted rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                        onDrop={handleDrop}
                        onDragOver={(e) => e.preventDefault()}
                        onClick={() => document.getElementById("file-input")?.click()}
                    >
                        <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="font-medium mb-1">Arrastra tu archivo aquí</p>
                        <p className="text-sm text-muted-foreground mb-4">
                            o haz clic para seleccionar
                        </p>
                        <Badge variant="secondary">.csv, .xlsx, .xls</Badge>
                        <input
                            id="file-input"
                            type="file"
                            accept=".csv,.xlsx,.xls"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                    </div>
                )}

                {/* Step: Map columns & filters */}
                {step === "map" && (
                    <div className="space-y-4">
                        <Card>
                            <CardContent className="p-4 flex items-center justify-between gap-2">
                                <div className="space-y-1">
                                    <p className="text-sm text-muted-foreground">
                                        Archivo: <span className="font-medium text-foreground">{file?.name}</span>
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        Filas leídas: <span className="font-medium text-foreground">{data.length}</span>
                                        {mapping.date && mapping.amount && (
                                            <span className="ml-2 text-xs">
                                                ({filteredPreviewCount} tras filtros)
                                            </span>
                                        )}
                                    </p>
                                </div>
                                <Badge variant="secondary">{BANK_LABELS[detectedBank]}</Badge>
                            </CardContent>
                        </Card>

                        <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1.5">
                                    <Label>Fecha *</Label>
                                    <Select
                                        value={mapping.date}
                                        onValueChange={(v) => setMapping({ ...mapping, date: v })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Columna" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {headers.map((h) => (
                                                <SelectItem key={h} value={h}>
                                                    {h}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1.5">
                                    <Label>Importe *</Label>
                                    <Select
                                        value={mapping.amount}
                                        onValueChange={(v) => setMapping({ ...mapping, amount: v })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Columna" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {headers.map((h) => (
                                                <SelectItem key={h} value={h}>
                                                    {h}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1.5">
                                    <Label>Descripción</Label>
                                    <Select
                                        value={mapping.description}
                                        onValueChange={(v) => setMapping({ ...mapping, description: v })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Opcional" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {headers.map((h) => (
                                                <SelectItem key={h} value={h}>
                                                    {h}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label>Cuenta destino *</Label>
                                    <Select value={accountId} onValueChange={setAccountId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar cuenta" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {accounts.map((a) => (
                                                <SelectItem key={a.id} value={a.id}>
                                                    {a.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1.5">
                                    <Label>Categoría por defecto</Label>
                                    <Select value={defaultCategoryId} onValueChange={setDefaultCategoryId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Auto por palabras clave" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {sortedCategories.map((c) => (
                                                <SelectItem key={c.id} value={c.id}>
                                                    {c.icon ? `${c.icon} ` : ""}
                                                    {c.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Pre-import filters */}
                            <div className="rounded-lg border p-3 space-y-3 bg-muted/20">
                                <div className="flex items-center justify-between gap-3">
                                    <Label htmlFor="import-min-date" className="text-sm font-medium shrink-0">
                                        Importar desde
                                    </Label>
                                    <Input
                                        id="import-min-date"
                                        type="date"
                                        value={minDate}
                                        onChange={(e) => setMinDate(e.target.value)}
                                        className="max-w-[180px]"
                                    />
                                </div>

                                {isTradeRepublic && (
                                    <label className="flex items-start gap-2.5 text-sm cursor-pointer">
                                        <Checkbox
                                            checked={excludeTrInvestments}
                                            onCheckedChange={(checked) =>
                                                setExcludeTrInvestments(Boolean(checked))
                                            }
                                            className="mt-0.5"
                                        />
                                        <span>
                                            Excluir operaciones de inversión y rendimientos{" "}
                                            <span className="text-muted-foreground">
                                                (TRADING, Saveback, Dividendos, Intereses)
                                            </span>
                                        </span>
                                    </label>
                                )}
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setStep("upload")}>
                                Atrás
                            </Button>
                            <Button
                                onClick={handlePrepareReview}
                                disabled={
                                    !mapping.date ||
                                    !mapping.amount ||
                                    !accountId ||
                                    preparingReview ||
                                    filteredPreviewCount === 0
                                }
                            >
                                {preparingReview ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Analizando...
                                    </>
                                ) : (
                                    <>
                                        Revisar ({filteredPreviewCount})
                                        <ArrowRight className="w-4 h-4 ml-2" />
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </div>
                )}

                {/* Step: Interactive Review */}
                {step === "review" && (
                    <div className="flex flex-col gap-3 min-h-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 bg-muted/20 shrink-0">
                            <div className="text-sm space-y-0.5">
                                <p>
                                    Cuenta:{" "}
                                    <span className="font-semibold">
                                        {accounts.find((a) => a.id === accountId)?.name}
                                    </span>{" "}
                                    · Seleccionadas:{" "}
                                    <span className="font-semibold">
                                        {selectedRows.length} / {reviewRows.length}
                                    </span>
                                </p>
                                {duplicateCount > 0 && (
                                    <p className="text-xs text-amber-600 flex items-center gap-1">
                                        <AlertTriangle className="w-3.5 h-3.5" />
                                        {duplicateCount} posibles duplicados detectados (desmarcados por defecto)
                                    </p>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                <Label className="text-xs text-muted-foreground whitespace-nowrap">
                                    Aplicar categoría a todas:
                                </Label>
                                <Select
                                    value={defaultCategoryId}
                                    onValueChange={applyDefaultCategoryToEmpty}
                                >
                                    <SelectTrigger className="w-[180px] h-8 text-xs">
                                        <SelectValue placeholder="Elegir categoría" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {sortedCategories.map((c) => (
                                            <SelectItem key={c.id} value={c.id}>
                                                {c.icon ? `${c.icon} ` : ""}
                                                {c.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="flex-1 min-h-0 overflow-auto rounded-lg border">
                            <table className="w-full text-sm">
                                <thead className="bg-muted sticky top-0 z-10">
                                    <tr>
                                        <th className="p-2 w-9 text-center">
                                            <Checkbox
                                                checked={allSelected}
                                                onCheckedChange={toggleAllRows}
                                                aria-label="Seleccionar todas"
                                            />
                                        </th>
                                        <th className="p-2 text-left font-medium w-[105px]">Fecha</th>
                                        <th className="p-2 text-left font-medium">Descripción</th>
                                        <th className="p-2 text-right font-medium w-[110px]">Importe</th>
                                        <th className="p-2 text-left font-medium w-[140px]">Tipo</th>
                                        <th className="p-2 text-left font-medium w-[180px]">Categoría</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reviewRows.map((row) => (
                                        <tr
                                            key={row.id}
                                            className={`border-t transition-colors ${
                                                row.selected ? "" : "opacity-50 bg-muted/20"
                                            }`}
                                        >
                                            <td className="p-2 text-center">
                                                <Checkbox
                                                    checked={row.selected}
                                                    onCheckedChange={(checked) =>
                                                        updateReviewRow(row.id, {
                                                            selected: Boolean(checked),
                                                        })
                                                    }
                                                />
                                            </td>
                                            <td className="p-2 font-mono text-xs whitespace-nowrap">
                                                {row.date}
                                            </td>
                                            <td className="p-2">
                                                <div className="space-y-1">
                                                    <Input
                                                        value={row.description}
                                                        onChange={(e) =>
                                                            updateReviewRow(row.id, {
                                                                description: e.target.value,
                                                            })
                                                        }
                                                        className="h-8 text-xs"
                                                        placeholder="Sin descripción"
                                                    />
                                                    {row.isDuplicate && (
                                                        <Badge
                                                            variant="outline"
                                                            className="text-[10px] py-0 px-1.5 bg-amber-500/10 text-amber-600 border-amber-500/30"
                                                        >
                                                            Posible duplicado
                                                        </Badge>
                                                    )}
                                                </div>
                                            </td>
                                            <td
                                                className={`p-2 text-right font-semibold whitespace-nowrap ${
                                                    row.isTransfer
                                                        ? "text-blue-500"
                                                        : row.amount >= 0
                                                          ? "text-emerald-500"
                                                          : "text-rose-500"
                                                }`}
                                            >
                                                {row.amount >= 0 ? "+" : ""}
                                                {formatMoney(row.amount)}
                                            </td>
                                            <td className="p-2">
                                                <Select
                                                    value={row.isTransfer ? "transfer" : "standard"}
                                                    onValueChange={(v) =>
                                                        updateReviewRow(row.id, {
                                                            isTransfer: v === "transfer",
                                                            categoryId:
                                                                v === "transfer"
                                                                    ? ""
                                                                    : row.categoryId ||
                                                                      suggestCategoryId(
                                                                          row.description,
                                                                          row.amount,
                                                                          sortedCategories,
                                                                          defaultCategoryId
                                                                      ),
                                                        })
                                                    }
                                                >
                                                    <SelectTrigger className="h-8 text-xs">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="standard">
                                                            {row.amount >= 0 ? "Ingreso" : "Gasto"}
                                                        </SelectItem>
                                                        <SelectItem value="transfer">
                                                            Transferencia
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </td>
                                            <td className="p-2">
                                                {row.isTransfer ? (
                                                    <span className="text-xs text-muted-foreground italic">
                                                        Sin categoría
                                                    </span>
                                                ) : (
                                                    <Select
                                                        value={row.categoryId}
                                                        onValueChange={(v) =>
                                                            updateReviewRow(row.id, { categoryId: v })
                                                        }
                                                    >
                                                        <SelectTrigger className="h-8 text-xs">
                                                            <SelectValue placeholder="Categoría" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {sortedCategories.map((c) => (
                                                                <SelectItem key={c.id} value={c.id}>
                                                                    {c.icon ? `${c.icon} ` : ""}
                                                                    {c.name}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <DialogFooter className="shrink-0">
                            <Button variant="outline" onClick={() => setStep("map")}>
                                Atrás
                            </Button>
                            <Button
                                onClick={handleImport}
                                disabled={loading || selectedRows.length === 0}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Importando...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-4 h-4 mr-2" />
                                        Importar {selectedRows.length} transacciones
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </div>
                )}

                {/* Step: Complete */}
                {step === "complete" && (
                    <div className="text-center py-6">
                        <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                            <Check className="w-8 h-8 text-emerald-500" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">Importación completada</h3>
                        <div className="flex justify-center gap-4 mb-4">
                            <div className="flex items-center gap-2 text-emerald-500">
                                <Check className="w-4 h-4" />
                                <span>{importResult.success} exitosas</span>
                            </div>
                            {importResult.failed > 0 && (
                                <div className="flex items-center gap-2 text-rose-500">
                                    <X className="w-4 h-4" />
                                    <span>{importResult.failed} fallidas</span>
                                </div>
                            )}
                        </div>
                        <Button onClick={handleClose}>Cerrar</Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
