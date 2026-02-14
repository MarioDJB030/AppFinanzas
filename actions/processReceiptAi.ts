"use server";

import { createClient } from "@/utils/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

export async function processReceiptAi(fileUrl: string) {
    try {
        const supabase = await createClient();

        // 1. Robust logic to extract ONLY the relative path
        let filePath = fileUrl;

        // If it's an absolute URL (Supabase), cut everything before the bucket
        if (fileUrl.startsWith('http')) {
            // Find '/receipts/' segment which indicates the start of path inside the bucket
            const parts = fileUrl.split('/receipts/');
            if (parts.length > 1) {
                // Keep the last part (e.g., 'user_id/photo.png')
                filePath = parts.pop()!;
            }
        }

        // Decode in case of spaces (%20) or other chars
        filePath = decodeURIComponent(filePath || '');

        console.log("📂 Clean Path for Storage:", filePath); // CRITICAL LOG FOR DEBUGGING

        if (!filePath) throw new Error("Ruta de archivo inválida");

        // 2. Download using the clean path
        const { data, error } = await supabase.storage
            .from("receipts")
            .download(filePath);

        if (error || !data) {
            console.error("Storage download error:", error);
            throw new Error(`Error al descargar de Storage: ${error?.message}`);
        }

        // 2. Convert Blob to Buffer to Base64
        const buffer = Buffer.from(await data.arrayBuffer());
        const base64 = buffer.toString("base64");
        const mimeType = data.type || "image/jpeg";

        // 3. Prepare Gemini Request
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `Actúa como un experto contable. Analiza esta imagen de un ticket o factura y extrae los datos en formato JSON puro.
Esquema: { "amount": number, "merchant": string, "date": "YYYY-MM-DD", "category_suggestion": string, "confidence": number }
Si no estás seguro de algún dato, devuelve null en ese campo. Responde SOLO el JSON sin bloques de código markdown.`;

        const imagePart = {
            inlineData: {
                data: base64,
                mimeType: mimeType,
            },
        };

        // 4. Generate Content
        const result = await model.generateContent([prompt, imagePart]);
        const text = result.response.text();

        // 5. Parse JSON
        const cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim();
        const json = JSON.parse(cleanedText);

        return { success: true, data: json };

    } catch (error) {
        console.error("Error processing receipt with AI:", error);
        return { error: "No se pudo procesar el ticket con IA." };
    }
}
