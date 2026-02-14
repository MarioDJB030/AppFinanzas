"use client";

import { useState, useCallback } from "react";
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
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Upload,
    FileSpreadsheet,
    Loader2,
    Check,
    X,
    ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { Account, Category } from "@/types/database";

interface CSVImporterProps {
    accounts: Account[];
    categories: Category[];
}

type ColumnMapping = {
    date: string;
    amount: string;
    description: string;
};

export default function CSVImporter({ accounts, categories }: CSVImporterProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [step, setStep] = useState<"upload" | "map" | "review" | "complete">("upload");
    const [file, setFile] = useState<File | null>(null);
    const [headers, setHeaders] = useState<string[]>([]);
    const [data, setData] = useState<Record<string, string>[]>([]);
    const [mapping, setMapping] = useState<ColumnMapping>({
        date: "",
        amount: "",
        description: "",
    });
    const [accountId, setAccountId] = useState("");
    const [categoryId, setCategoryId] = useState("");
    const [loading, setLoading] = useState(false);
    const [importResult, setImportResult] = useState<{ success: number; failed: number }>({ success: 0, failed: 0 });

    const router = useRouter();
    const supabase = createClient();

    const parseFile = useCallback((file: File) => {
        const extension = file.name.split(".").pop()?.toLowerCase();

        if (extension === "csv") {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    if (results.data.length > 0) {
                        setHeaders(Object.keys(results.data[0] as Record<string, string>));
                        setData(results.data as Record<string, string>[]);
                        setStep("map");
                    }
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
                    const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { raw: false });

                    if (jsonData.length > 0) {
                        setHeaders(Object.keys(jsonData[0]));
                        setData(jsonData);
                        setStep("map");
                    }
                } catch (error) {
                    toast.error("Error al leer el archivo Excel", {
                        description: String(error),
                    });
                }
            };
            reader.readAsBinaryString(file);
        } else {
            toast.error("Formato no soportado", {
                description: "Por favor, usa un archivo .csv o .xlsx",
            });
        }
    }, []);

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

    const handleImport = async () => {
        if (!mapping.date || !mapping.amount || !accountId) {
            toast.error("Por favor, completa todos los campos requeridos");
            return;
        }

        setLoading(true);
        let success = 0;
        let failed = 0;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("No user");

            for (const row of data) {
                try {
                    const dateValue = row[mapping.date];

                    // Robust helper to parse amounts
                    const parseAmount = (value: string): number => {
                        // Remove currency symbols and whitespace
                        let cleanValue = value.replace(/[€\sEUR]/gi, "").trim();

                        // Check if it's a negative number (some banks use "10.00-" or "-10.00")
                        const isNegative = cleanValue.includes("-");
                        cleanValue = cleanValue.replace("-", "");

                        // Handle European format (1.234,56) vs US/Standard (1,234.56)
                        // If there is a comma and it's practically at the end (2 decimals), it's likely a decimal separator
                        // or if there are multiple dots, dots are thousands separators.
                        if (cleanValue.includes(",") && cleanValue.lastIndexOf(",") > cleanValue.lastIndexOf(".")) {
                            // Replace dots (thousands) with empty string, replace comma with dot
                            cleanValue = cleanValue.replace(/\./g, "").replace(",", ".");
                        } else {
                            // Replace commas (thousands) with empty string, keep dot as decimal
                            cleanValue = cleanValue.replace(/,/g, "");
                        }

                        const amount = parseFloat(cleanValue);
                        return isNegative ? -amount : amount;
                    };

                    const amountValue = parseAmount(row[mapping.amount]);
                    const descriptionValue = mapping.description ? row[mapping.description] : "";

                    // Parse date (try multiple formats)
                    let parsedDate: Date;
                    if (dateValue.includes("/")) {
                        const parts = dateValue.split("/");
                        if (parts[2].length === 4) {
                            // DD/MM/YYYY
                            parsedDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                        } else {
                            // MM/DD/YY
                            parsedDate = new Date(dateValue);
                        }
                    } else {
                        parsedDate = new Date(dateValue);
                    }

                    if (isNaN(parsedDate.getTime()) || isNaN(amountValue)) {
                        failed++;
                        continue;
                    }

                    // Smart Category Assignment
                    let finalCategoryId = categoryId;

                    if (!finalCategoryId) {
                        if (amountValue >= 0) {
                            // Find "Otros Ingresos" or first income category
                            const incomeCat = categories.find(c => c.name === "Otros Ingresos" && c.type === "income")
                                || categories.find(c => c.type === "income");
                            if (incomeCat) finalCategoryId = incomeCat.id;
                        } else {
                            // Find "Otros Gastos" or first expense category
                            const expenseCat = categories.find(c => c.name === "Otros Gastos" && c.type === "expense")
                                || categories.find(c => c.type === "expense");
                            if (expenseCat) finalCategoryId = expenseCat.id;
                        }
                    }

                    // Fallback if still no category (should allow null in DB? Assuming schema requires it based on previous code)
                    // If your schema allows null category_id, you can skip this. But let's assume we need one.
                    // If we absolutely can't find one, we might skip or let it fail constraint if schema enforces it.

                    const { error } = await supabase.from("transactions").insert({
                        user_id: user.id,
                        account_id: accountId,
                        category_id: finalCategoryId,
                        amount: amountValue,
                        description: descriptionValue,
                        date: parsedDate.toISOString().split("T")[0],
                        is_recurring: false,
                    });

                    if (error) {
                        failed++;
                    } else {
                        success++;
                    }
                } catch {
                    failed++;
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
        setMapping({ date: "", amount: "", description: "" });
        setAccountId("");
        setCategoryId("");
        setStep("upload");
        setImportResult({ success: 0, failed: 0 });
    };

    const handleClose = () => {
        setIsOpen(false);
        setTimeout(resetImporter, 300);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    Importar CSV
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5" />
                        Importar Transacciones
                    </DialogTitle>
                    <DialogDescription>
                        {step === "upload" && "Sube un archivo CSV o Excel con tus transacciones"}
                        {step === "map" && "Mapea las columnas del archivo con los campos requeridos"}
                        {step === "review" && "Revisa y confirma la importación"}
                        {step === "complete" && "Importación completada"}
                    </DialogDescription>
                </DialogHeader>

                {/* Step indicators */}
                <div className="flex items-center justify-center gap-2 py-2">
                    {["upload", "map", "review", "complete"].map((s, i) => (
                        <div key={s} className="flex items-center">
                            <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${step === s
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
                                    className={`w-8 h-0.5 ${["upload", "map", "review", "complete"].indexOf(step) > i
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

                {/* Step: Map columns */}
                {step === "map" && (
                    <div className="space-y-4">
                        <Card>
                            <CardContent className="p-4">
                                <p className="text-sm text-muted-foreground mb-2">
                                    Archivo: <span className="font-medium text-foreground">{file?.name}</span>
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    Filas: <span className="font-medium text-foreground">{data.length}</span>
                                </p>
                            </CardContent>
                        </Card>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Columna de Fecha *</Label>
                                <Select value={mapping.date} onValueChange={(v) => setMapping({ ...mapping, date: v })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar columna" />
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

                            <div className="space-y-2">
                                <Label>Columna de Cantidad *</Label>
                                <Select value={mapping.amount} onValueChange={(v) => setMapping({ ...mapping, amount: v })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar columna" />
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

                            <div className="space-y-2">
                                <Label>Columna de Descripción</Label>
                                <Select value={mapping.description} onValueChange={(v) => setMapping({ ...mapping, description: v })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar columna (opcional)" />
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

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Cuenta destino *</Label>
                                    <Select value={accountId} onValueChange={setAccountId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar" />
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

                                <div className="space-y-2">
                                    <Label>Categoría *</Label>
                                    <Select value={categoryId} onValueChange={setCategoryId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {categories.map((c) => (
                                                <SelectItem key={c.id} value={c.id}>
                                                    {c.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setStep("upload")}>
                                Atrás
                            </Button>
                            <Button
                                onClick={() => setStep("review")}
                                disabled={!mapping.date || !mapping.amount || !accountId}
                            >
                                Continuar
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </DialogFooter>
                    </div>
                )}

                {/* Step: Review */}
                {step === "review" && (
                    <div className="space-y-4">
                        <Card>
                            <CardContent className="p-4 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Transacciones a importar:</span>
                                    <span className="font-medium">{data.length}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Cuenta:</span>
                                    <span className="font-medium">{accounts.find((a) => a.id === accountId)?.name}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Categoría:</span>
                                    <span className="font-medium">{categories.find((c) => c.id === categoryId)?.name}</span>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Preview */}
                        <div className="max-h-48 overflow-auto rounded-lg border">
                            <table className="w-full text-sm">
                                <thead className="bg-muted sticky top-0">
                                    <tr>
                                        <th className="p-2 text-left font-medium">Fecha</th>
                                        <th className="p-2 text-left font-medium">Cantidad</th>
                                        <th className="p-2 text-left font-medium">Descripción</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.slice(0, 5).map((row, i) => (
                                        <tr key={i} className="border-t">
                                            <td className="p-2">{row[mapping.date]}</td>
                                            <td className="p-2">{row[mapping.amount]}</td>
                                            <td className="p-2 truncate max-w-[150px]">
                                                {mapping.description ? row[mapping.description] : "-"}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {data.length > 5 && (
                                <p className="p-2 text-center text-sm text-muted-foreground">
                                    ...y {data.length - 5} más
                                </p>
                            )}
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setStep("map")}>
                                Atrás
                            </Button>
                            <Button onClick={handleImport} disabled={loading}>
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Importando...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-4 h-4 mr-2" />
                                        Importar {data.length} transacciones
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
