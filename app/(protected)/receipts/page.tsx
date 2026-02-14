import { createClient } from "@/utils/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import ReceiptUpload from "@/components/receipts/ReceiptUpload";
import ReceiptGallery from "@/components/receipts/ReceiptGallery";
import { Receipt } from "lucide-react";

export default async function ReceiptsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    const { data: receiptsData } = await supabase
        .from("receipts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

    // Process receipts to generate Signed URLs (in case bucket is private) and extract paths
    const receipts = await Promise.all((receiptsData || []).map(async (receipt) => {
        // Try to extract path from URL if file_path is missing
        // Public URL format: .../storage/v1/object/public/receipts/{path}
        let filePath = receipt.file_path;

        if (!filePath && receipt.file_url && receipt.file_url.includes("/receipts/")) {
            const parts = receipt.file_url.split("/receipts/");
            if (parts.length > 1) {
                filePath = parts[1]; // Get everything after /receipts/
            }
        }

        // Use Signed URL if we have a path
        if (filePath) {
            const { data: signedData } = await supabase.storage
                .from("receipts")
                .createSignedUrl(filePath, 60 * 60); // 1 hour expiry

            if (signedData?.signedUrl) {
                return {
                    ...receipt,
                    file_url: signedData.signedUrl,
                    file_path: filePath
                };
            }
        }

        return {
            ...receipt,
            file_path: filePath // Ensure path is passed if we found it
        };
    }));

    // Fetch recent transactions for linking
    const { data: rawTransactions } = await supabase
        .from("transactions")
        .select("id, description, amount, date, category:categories(name)")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .limit(10);

    // Fetch accounts and categories for AI Transaction creation
    const { data: accounts } = await supabase
        .from("accounts")
        .select("*")
        .eq("user_id", user.id)
        .order("name");

    const { data: categories } = await supabase
        .from("categories")
        .select("*")
        .eq("user_id", user.id)
        .order("name");

    // Transform to fix type issues
    const recentTransactions = rawTransactions?.map(t => ({
        ...t,
        category: Array.isArray(t.category) ? t.category[0] : t.category
    })) || [];

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Gestor de Recibos</h1>
                    <p className="text-muted-foreground">Sube y organiza tus facturas y tickets</p>
                </div>
            </div>

            <div className="grid gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Receipt className="w-5 h-5" />
                            Subir nuevo documento
                        </CardTitle>
                        <CardDescription>
                            Arrastra archivos aquí o haz clic para seleccionar
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ReceiptUpload
                            transactions={recentTransactions}
                            accounts={accounts || []}
                            categories={categories || []}
                        />
                    </CardContent>
                </Card>

                <div className="space-y-4">
                    <h2 className="text-xl font-semibold">Tus Documentos</h2>
                    <ReceiptGallery receipts={receipts || []} transactions={recentTransactions} />
                </div>
            </div>
        </div>
    );
}
