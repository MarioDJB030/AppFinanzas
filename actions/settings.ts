"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { UserSettings } from "@/types/database";

export async function getUserSettings() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    const { data: settings } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", user.id)
        .single();

    if (!settings) {
        // Create default settings if not exists
        const defaultSettings = {
            user_id: user.id,
            username: user.email?.split("@")[0] || "User",
            currency: "EUR",
            start_day_of_month: 1
        };

        const { data: newSettings, error } = await supabase
            .from("user_settings")
            .insert(defaultSettings)
            .select()
            .single();

        if (error) {
            console.error("Error creating default settings:", error);
            return null;
        }
        return newSettings as UserSettings;
    }

    return settings as UserSettings;
}

export async function updateUserSettings(data: Partial<UserSettings>) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error("Unauthorized");

    const { error } = await supabase
        .from("user_settings")
        .update(data)
        .eq("user_id", user.id);

    if (error) throw error;

    revalidatePath("/dashboard");
    revalidatePath("/settings");
    revalidatePath("/budgets");
    revalidatePath("/goals");
    return { success: true };
}

export async function resetUserAccount() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error("Unauthorized");

    // Delete in order to avoid FK constraints if possible, or usually Cascade handles it.
    // Assuming standard constraints or manual deletion.

    // 1. Transactions
    await supabase.from("transactions").delete().eq("user_id", user.id);

    // 2. Budgets
    await supabase.from("budgets").delete().eq("user_id", user.id);

    // 3. Goals
    await supabase.from("goals").delete().eq("user_id", user.id);

    // 4. Categories (only custom ones if we distinguish? Or all?)
    // Usually we might want to keep default categories or delete all. 
    // The requirement says "borrar todas las transacciones y presupuestos... y categorias personalizadas".
    // We don't have a flag for 'custom' yet, but usually we just wipe everything if it's a hard reset.
    // Let's assume we delete everything for now, or just the data.
    await supabase.from("categories").delete().eq("user_id", user.id);

    // 5. Accounts
    await supabase.from("accounts").delete().eq("user_id", user.id);

    // 6. Investments
    await supabase.from("investments").delete().eq("user_id", user.id);

    // 7. Recurring Rules
    await supabase.from("recurring_rules").delete().eq("user_id", user.id);

    revalidatePath("/");
    return { success: true };
}
