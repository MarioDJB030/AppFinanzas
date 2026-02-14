"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

interface Transaction {
    category: { name: string };
    amount: number;
    type: string;
}

interface Budget {
    category_id: string;
    amount: number;
    categories?: { name: string };
}

export async function getFinancialAdvice(transactions: any[], budgets: any[], currency: string = "EUR") {
    try {
        console.log("🔍 Checking Google API Key...");
        const apiKey = process.env.GOOGLE_API_KEY;
        if (!apiKey || apiKey.length === 0) {
            console.error("❌ GOOGLE_API_KEY is missing or empty.");
            throw new Error("GOOGLE_API_KEY is not set");
        }
        console.log("✅ Google API Key found (Length: " + apiKey.length + ")");

        // 1. Data Aggregation & Simplification
        const expensesByCategory: Record<string, number> = {};
        let totalSpent = 0;

        // Process transactions (only expenses)
        transactions.forEach((t) => {
            if (t.amount < 0 || (t.category && t.category.type === 'expense')) {
                const categoryName = t.category?.name || "Sin categoría";
                const amount = Math.abs(t.amount);
                expensesByCategory[categoryName] = (expensesByCategory[categoryName] || 0) + amount;
                totalSpent += amount;
            }
        });

        // Prepare Budgets info
        const budgetInfo: Record<string, number> = {};
        budgets.forEach((b) => {
            const catName = b.categories?.name || "Desconocido";
            budgetInfo[catName] = b.amount;
        });

        // 2. Construct Prompt Payload
        const payload = {
            totalSpent,
            categoriesBreakdown: expensesByCategory,
            budgets: budgetInfo
        };

        const prompt = `
Eres un asesor financiero experto y motivador. Analiza estos datos de gastos mensuales agregados por categoría: ${JSON.stringify(payload)}.
La moneda del usuario es: "${currency}".

Genera una respuesta en Markdown con:

📊 **Resumen Rápido**: Una frase sobre mi salud financiera (ej: "Vas genial", "Cuidado con los gastos hormiga").

💡 **3 Consejos Clave**: Acciones específicas basadas en las categorías donde más gasto (ej: si es "Restaurantes", sugiere cocinar más). Comparando con presupuestos si existen.

🚀 **Frase Motivadora**: Para cerrar.

Mantén el tono amigable y usa emojis. No uses H1 (#), usa negritas (**text**) y listas.
`;

        // 3. Call Gemini API
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        return text;

    } catch (error) {
        console.error("Error in getFinancialAdvice:", error);
        return "Lo siento, no pude analizar tus datos en este momento. Inténtalo más tarde.";
    }
}
