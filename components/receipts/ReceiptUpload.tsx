"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { uploadReceipt } from "@/actions/receipts";
import { processReceiptAi } from "@/actions/processReceiptAi";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import ScanResultDialog from "./ScanResultDialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { Account, Category } from "@/types/database";

interface ReceiptUploadProps {
    transactions?: {
        id: string;
        description?: string;
        amount: number;
        date: string;
        category?: { name: string };
    }[];
    accounts: Account[];
    categories: Category[];
}

export default function ReceiptUpload({ transactions = [], accounts, categories }: ReceiptUploadProps) {
    const [uploading, setUploading] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [selectedTransactionId, setSelectedTransactionId] = useState<string>("");
    const [scanData, setScanData] = useState<any>(null);
    const [uploadedReceiptId, setUploadedReceiptId] = useState<string | null>(null);
    const [showScanDialog, setShowScanDialog] = useState(false);

    const router = useRouter();

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (acceptedFiles.length === 0) return;

        setUploading(true);
        const file = acceptedFiles[0];
        const formData = new FormData();
        formData.append("file", file);
        if (selectedTransactionId && selectedTransactionId !== "none") {
            formData.append("transactionId", selectedTransactionId);
        }

        try {
            // 1. Upload Receipt
            const res = await uploadReceipt(formData);
            if (res.error) {
                toast.error(res.error);
                setUploading(false);
                return;
            }

            toast.success("Recibo subido correctamente");

            // If linked manually, stop here
            if (selectedTransactionId && selectedTransactionId !== "none") {
                router.refresh();
                setUploading(false);
                return;
            }

            // 2. Process with AI (if not manually linked)
            if (res.data?.id && res.data?.publicUrl) {
                setUploadedReceiptId(res.data.id);
                setAnalyzing(true);

                // Use public URL for AI (assuming it's accessible or we handle it in server action)
                // Note: uploadReceipt should return publicUrl and ID.
                // We need to update uploadReceipt to return this info.

                try {
                    const aiRes = await processReceiptAi(res.data.publicUrl);
                    if (aiRes.success && aiRes.data) {
                        setScanData(aiRes.data);
                        setShowScanDialog(true);
                        toast.info("¡Datos extraídos! Verifica la información.");
                    } else {
                        // AI Failed but upload success
                        toast.warning("El ticket se subió pero no pudimos leer los datos automáticamente.");
                        router.refresh();
                    }
                } catch (aiError) {
                    console.error(aiError);
                    toast.warning("Error al procesar con IA");
                    router.refresh();
                }
            } else {
                router.refresh();
            }

        } catch (error) {
            console.error(error);
            toast.error("Error al subir el archivo");
        } finally {
            setUploading(false);
            setAnalyzing(false);
            setSelectedTransactionId("");
        }
    }, [router, selectedTransactionId]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'image/jpeg': [],
            'image/png': [],
            'application/pdf': []
        },
        maxSize: 20 * 1024 * 1024, // 20MB
        disabled: uploading || analyzing
    });

    return (
        <div className="space-y-4">
            <div
                {...getRootProps()}
                className={cn(
                    "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors flex flex-col items-center justify-center gap-4 bg-muted/20 hover:bg-muted/40",
                    isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25",
                    (uploading || analyzing) ? "opacity-50 cursor-not-allowed" : ""
                )}
            >
                <input {...getInputProps()} />
                {analyzing ? (
                    <div className="flex flex-col items-center gap-2 animate-pulse">
                        <Sparkles className="w-10 h-10 text-yellow-500 animate-spin-slow" />
                        <p className="text-sm font-medium text-yellow-600">✨ La IA está leyendo tu ticket...</p>
                    </div>
                ) : uploading ? (
                    <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-10 h-10 animate-spin text-primary" />
                        <p className="text-sm font-medium">Subiendo archivo...</p>
                    </div>
                ) : (
                    <>
                        <div className="p-4 rounded-full bg-background shadow-sm">
                            <Upload className="w-8 h-8 text-primary" />
                        </div>
                        <div className="space-y-1">
                            <p className="font-medium">
                                {isDragActive ? "Suelta el archivo aquí" : "Arrastra un recibo o haz clic para subir"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Soporta JPG, PNG y PDF (Máx. 20MB)
                            </p>
                        </div>
                    </>
                )}
            </div>

            {transactions.length > 0 && (
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">Enlazar a transacción (opcional):</span>
                    <Select value={selectedTransactionId} onValueChange={setSelectedTransactionId} disabled={uploading || analyzing}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Seleccionar transacción reciente..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">Ninguna (Crear nueva con IA)</SelectItem>
                            {transactions.map((tx) => (
                                <SelectItem key={tx.id} value={tx.id}>
                                    {tx.date} - {tx.description || "Sin descripción"} ({tx.amount}€)
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            <ScanResultDialog
                open={showScanDialog}
                onOpenChange={(open) => {
                    setShowScanDialog(open);
                    if (!open) {
                        setScanData(null);
                        setUploadedReceiptId(null);
                        router.refresh();
                    }
                }}
                scanData={scanData}
                receiptId={uploadedReceiptId || ""}
                accounts={accounts}
                categories={categories}
            />
        </div>
    );
}
