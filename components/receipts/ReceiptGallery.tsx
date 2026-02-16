"use client";

import { useState } from "react";
import type { Receipt } from "@/types/database";
import ReceiptCard from "./ReceiptCard";
import ReceiptDialog from "./ReceiptDialog";
import LinkReceiptDialog from "./LinkReceiptDialog";
import { Search } from "lucide-react";

interface ReceiptGalleryProps {
    receipts: Receipt[];
    transactions?: {
        id: string;
        description?: string;
        amount: number;
        date: string;
        category?: { name: string };
    }[];
}

export default function ReceiptGallery({ receipts, transactions = [] }: ReceiptGalleryProps) {
    const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
    const [receiptToLink, setReceiptToLink] = useState<Receipt | null>(null);

    if (receipts.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No has subido ningún recibo todavía</p>
            </div>
        );
    }

    return (
        <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {receipts.map((receipt) => (
                    <ReceiptCard
                        key={receipt.id}
                        receipt={receipt}
                        onView={(r) => setSelectedReceipt(r)}
                        onLink={(r) => setReceiptToLink(r)}
                    />
                ))}
            </div>

            <ReceiptDialog
                receipt={selectedReceipt}
                open={!!selectedReceipt}
                onOpenChange={(open) => !open && setSelectedReceipt(null)}
            />

            <LinkReceiptDialog
                receipt={receiptToLink}
                open={!!receiptToLink}
                onOpenChange={(open) => !open && setReceiptToLink(null)}
                recentTransactions={transactions}
            />
        </>
    );
}
