"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function uploadReceipt(formData: FormData) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: "No autorizado" };
    }

    const file = formData.get("file") as File;
    const transactionId = formData.get("transactionId") as string;

    if (!file) {
        return { error: "No se ha proporcionado ningún archivo" };
    }

    // Validate file type (basic check)
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
        return { error: "Formato no soportado. Usa JPG, PNG o PDF." };
    }

    // Generate unique path
    const timestamp = Date.now();
    const fileExt = file.name.split(".").pop();
    const fileName = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9]/g, "_")}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

    try {
        // 1. Upload to Storage
        const { error: uploadError } = await supabase.storage
            .from("receipts")
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        // 2. Get Signed URL (since bucket might be private, publicUrl won't work for AI fetch)
        // We handle potential null data safely
        const { data: signedData } = await supabase.storage
            .from("receipts")
            .createSignedUrl(filePath, 60 * 5); // 5 minutes expiry, enough for AI processing

        const signedUrl = signedData?.signedUrl;

        // Get Public URL for DB (we store public URL usually, but for private buckets we might store path)
        const { data: { publicUrl } } = supabase.storage
            .from("receipts")
            .getPublicUrl(filePath);

        // 3. Insert into DB
        const { data: insertedReceipt, error: dbError } = await supabase
            .from("receipts")
            .insert({
                user_id: user.id,
                transaction_id: transactionId || null,
                file_url: publicUrl,
                name: file.name,
                file_type: file.type,
            })
            .select("id")
            .single();

        if (dbError) throw dbError;

        revalidatePath("/receipts");
        if (transactionId) revalidatePath("/transactions");

        return { success: true, data: { id: insertedReceipt.id, publicUrl, signedUrl, filePath } };

    } catch (error) {
        console.error("Error uploading receipt:", error);
        return { error: "Error al subir el recibo" };
    }
}

export async function deleteReceipt(receiptId: string, filePath?: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: "No autorizado" };

    try {
        // 1. Delete from DB
        const { error: dbError } = await supabase
            .from("receipts")
            .delete()
            .eq("id", receiptId)
            .eq("user_id", user.id);

        if (dbError) throw dbError;

        // 2. Delete from Storage
        // If filePath is missing, we might try to extract it from URL or just skip (but better to clean up)
        // Assuming filePath follows pattern: {user_id}/{filename} 
        // But without exact path it's hard. 
        if (filePath) {
            const { error: storageError } = await supabase.storage
                .from("receipts")
                .remove([filePath]);

            if (storageError) {
                console.error("Storage delete error (non-fatal):", storageError);
            }
        }

        revalidatePath("/receipts");
        return { success: true };
    } catch (error) {
        console.error("Error deleting receipt:", error);
        return { error: "Error al eliminar el recibo" };
    }
}

export async function linkReceipt(receiptId: string, transactionId: string | null) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: "No autorizado" };

    try {
        const { error } = await supabase
            .from("receipts")
            .update({ transaction_id: transactionId })
            .eq("id", receiptId)
            .eq("user_id", user.id);

        if (error) throw error;

        revalidatePath("/receipts");
        revalidatePath("/transactions");
        return { success: true };
    } catch (error) {
        console.error("Error linking receipt:", error);
        return { error: "Error al enlazar el recibo" };
    }
}

export async function createTransactionFromReceipt(
    receiptId: string,
    data: {
        amount: number;
        description: string;
        date: string;
        categoryId: string;
        accountId: string;
    }
) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: "No autorizado" };

    try {
        // 1. Create Transaction
        const { data: transaction, error: txError } = await supabase
            .from("transactions")
            .insert({
                user_id: user.id,
                amount: Math.abs(data.amount) * -1, // Expense is negative
                description: data.description,
                date: data.date,
                category_id: data.categoryId || null,
                account_id: data.accountId,
                is_recurring: false
            })
            .select()
            .single();

        if (txError) throw txError;

        // 2. Link Receipt
        const { error: linkError } = await supabase
            .from("receipts")
            .update({ transaction_id: transaction.id })
            .eq("id", receiptId);

        if (linkError) throw linkError;

        revalidatePath("/receipts");
        revalidatePath("/transactions");
        revalidatePath("/dashboard");

        return { success: true };
    } catch (error) {
        console.error("Error creating transaction from receipt:", error);
        return { error: "Error al crear la transacción" };
    }
}
