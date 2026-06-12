function normalizeSupabaseUrl(url: string): string {
    return url
        .replace(/\/rest\/v1\/?$/i, "")
        .replace(/\/+$/, "");
}

export function getSupabaseEnv() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

    if (!url || !anonKey) {
        throw new Error(
            "Faltan variables de entorno de Supabase. Crea un archivo .env.local en la raíz con NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY, y reinicia el servidor (npm run dev)."
        );
    }

    if (!url.startsWith("https://") || !url.includes(".supabase.co")) {
        throw new Error(
            "NEXT_PUBLIC_SUPABASE_URL no parece válida. Debe ser la URL del proyecto, por ejemplo: https://tu-proyecto.supabase.co"
        );
    }

    return {
        url: normalizeSupabaseUrl(url),
        anonKey,
    };
}
