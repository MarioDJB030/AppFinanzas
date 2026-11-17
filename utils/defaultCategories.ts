import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Default categories to create for new users
 */
const DEFAULT_CATEGORIES = [
    { name: "Salario", type: "both", icon: "💰" },
    { name: "Freelance", type: "both", icon: "💻" },
    { name: "Inversiones", type: "both", icon: "📈" },
    { name: "Otros Ingresos", type: "both", icon: "💵" },
    { name: "Alimentación", type: "both", icon: "🍔" },
    { name: "Transporte", type: "both", icon: "🚗" },
    { name: "Vivienda", type: "both", icon: "🏠" },
    { name: "Entretenimiento", type: "both", icon: "🎬" },
    { name: "Salud", type: "both", icon: "🏥" },
    { name: "Compras", type: "both", icon: "🛒" },
    { name: "Servicios", type: "both", icon: "📱" },
    { name: "Otros Gastos", type: "both", icon: "📦" },
];

/**
 * Create default categories for a new user
 */
export async function createDefaultCategories(
    supabase: SupabaseClient,
    userId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const categoriesToInsert = DEFAULT_CATEGORIES.map((cat) => ({
            user_id: userId,
            name: cat.name,
            type: cat.type,
            icon: cat.icon,
        }));

        const { error } = await supabase
            .from("categories")
            .insert(categoriesToInsert);

        if (error) {
            console.error("Error creating default categories:", error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (err) {
        console.error("Error in createDefaultCategories:", err);
        return { success: false, error: String(err) };
    }
}

/**
 * Check if user has any categories, if not create defaults
 */
export async function ensureUserHasCategories(
    supabase: SupabaseClient,
    userId: string
): Promise<void> {
    const { data: categories } = await supabase
        .from("categories")
        .select("id")
        .eq("user_id", userId)
        .limit(1);

    if (!categories || categories.length === 0) {
        await createDefaultCategories(supabase, userId);
    }
}
