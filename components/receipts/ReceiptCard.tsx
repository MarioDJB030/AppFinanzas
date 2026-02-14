"use client";

import { useState } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Trash2, Eye, Paperclip, Loader2 } from "lucide-react";
import type { Receipt } from "@/types/database";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { deleteReceipt } from "@/actions/receipts";
import { toast } from "sonner";

interface ReceiptCardProps {
    receipt: Receipt;
    onView: (receipt: Receipt) => void;
    onLink: (receipt: Receipt) => void;
}

export default function ReceiptCard({ receipt, onView, onLink }: ReceiptCardProps) {
    const [deleting, setDeleting] = useState(false);
    const isPdf = receipt.file_type === "application/pdf";

    const handleDelete = async () => {
        if (!confirm("¿Estás seguro de eliminar este recibo?")) return;
        setDeleting(true);
        const res = await deleteReceipt(receipt.id, receipt.file_path);
        if (res.error) {
            toast.error(res.error);
            setDeleting(false);
        } else {
            toast.success("Recibo eliminado");
        }
    };

    return (
        <Card className="group overflow-hidden hover:shadow-md transition-all">
            <CardContent className="p-0 aspect-square relative bg-muted/30 flex items-center justify-center overflow-hidden">
                {isPdf ? (
                    <FileText className="w-16 h-16 text-muted-foreground/50 group-hover:scale-110 transition-transform" />
                ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={receipt.file_url}
                        alt={receipt.name}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        loading="lazy"
                    />
                )}

                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button size="icon" variant="secondary" onClick={() => onView(receipt)}>
                        <Eye className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="secondary" onClick={() => onLink(receipt)}>
                        <Paperclip className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="destructive" onClick={handleDelete} disabled={deleting}>
                        {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </Button>
                </div>

                {receipt.transaction_id && (
                    <div className="absolute top-2 right-2">
                        <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
                            <Paperclip className="w-3 h-3 mr-1" />
                            Enlazado
                        </Badge>
                    </div>
                )}
            </CardContent>
            <CardFooter className="p-3 flex flex-col items-start gap-1">
                <p className="font-medium text-sm truncate w-full" title={receipt.name}>
                    {receipt.name}
                </p>
                <div className="flex justify-between w-full text-xs text-muted-foreground">
                    <span>
                        {receipt.created_at
                            ? format(new Date(receipt.created_at), "d MMM yyyy", { locale: es })
                            : ""}
                    </span>
                    <span>{receipt.file_size ? (receipt.file_size / 1024).toFixed(0) + " KB" : ""}</span>
                </div>
            </CardFooter>
        </Card>
    );
}
