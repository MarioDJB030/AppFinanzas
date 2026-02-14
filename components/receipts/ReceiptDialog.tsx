"use client";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, FileText } from "lucide-react";
import type { Receipt } from "@/types/database";

interface ReceiptDialogProps {
    receipt: Receipt | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export default function ReceiptDialog({ receipt, open, onOpenChange }: ReceiptDialogProps) {
    if (!receipt) return null;

    const isPdf = receipt.file_type === "application/pdf";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl w-full h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        <span>{receipt.name}</span>
                        <Button variant="outline" size="sm" asChild>
                            <a href={receipt.file_url} target="_blank" rel="noopener noreferrer" download>
                                <Download className="w-4 h-4 mr-2" />
                                Descargar
                            </a>
                        </Button>
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-auto flex items-center justify-center bg-muted/20 rounded-md p-4">
                    {isPdf ? (
                        <div className="text-center space-y-4">
                            <FileText className="w-24 h-24 mx-auto text-muted-foreground" />
                            <p className="text-muted-foreground">Vista previa de PDF no disponible</p>
                            <Button asChild>
                                <a href={receipt.file_url} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="w-4 h-4 mr-2" />
                                    Abrir PDF
                                </a>
                            </Button>
                        </div>
                    ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={receipt.file_url}
                            alt={receipt.name}
                            className="max-w-full max-h-full object-contain rounded-md shadow-sm"
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
