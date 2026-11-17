import type { Category } from "@/types/database";

export type ColumnMapping = {
    date: string;
    amount: string;
    description: string;
};

export interface ParsedTable {
    headers: string[];
    rows: Record<string, string>[];
    isTradeRepublic: boolean;
    detectedBank: "imagin" | "trade_republic" | "generic";
}

export interface ReviewRow {
    id: string;
    date: string;
    amount: number;
    description: string;
    isTransfer: boolean;
    categoryId: string;
    selected: boolean;
    isDuplicate: boolean;
}

const EXCLUDED_TR_CATEGORIES = new Set(["TRADING"]);
const EXCLUDED_TR_TYPES = new Set([
    "BUY",
    "SELL",
    "BENEFITS_SAVEBACK",
    "DIVIDEND",
    "INTEREST_PAYMENT",
    "CORPORATE_ACTION",
]);

function normalizeText(value: string): string {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

const HEADER_KEYWORDS = [
    "fecha",
    "date",
    "datetime",
    "importe",
    "cantidad",
    "monto",
    "amount",
    "concepto",
    "descripcion",
    "description",
    "name",
    "category",
    "type",
];

/**
 * Detects the real header row (skipping bank metadata blocks such as Imagin's IBAN rows)
 * and converts the remaining rows into key-value records.
 */
export function buildTableFromMatrix(matrix: string[][]): ParsedTable {
    const nonEmptyRows = matrix.filter((row) =>
        row.some((cell) => String(cell ?? "").trim() !== "")
    );

    if (nonEmptyRows.length === 0) {
        return { headers: [], rows: [], isTradeRepublic: false, detectedBank: "generic" };
    }

    let headerRowIndex = 0;
    const scanLimit = Math.min(15, nonEmptyRows.length);

    for (let i = 0; i < scanLimit; i++) {
        const normalizedCells = nonEmptyRows[i].map((c) => normalizeText(String(c ?? "")));
        const hasIbanMeta = normalizedCells.some((c) => c === "iban" || c === "periodo");
        const keywordHits = normalizedCells.filter((c) =>
            HEADER_KEYWORDS.some((kw) => c === kw || c.includes(kw))
        ).length;

        if (!hasIbanMeta && keywordHits >= 2) {
            headerRowIndex = i;
            break;
        }
    }

    const rawHeaders = nonEmptyRows[headerRowIndex].map((h) => String(h ?? "").trim());
    const usedNames = new Map<string, number>();
    const headers = rawHeaders.map((h, idx) => {
        const base = h || `Columna_${idx + 1}`;
        const count = usedNames.get(base) ?? 0;
        usedNames.set(base, count + 1);
        return count === 0 ? base : `${base}_${count + 1}`;
    });

    const rows: Record<string, string>[] = [];
    for (let i = headerRowIndex + 1; i < nonEmptyRows.length; i++) {
        const rawRow = nonEmptyRows[i];
        const record: Record<string, string> = {};
        let hasAnyValue = false;

        headers.forEach((header, idx) => {
            const val = String(rawRow[idx] ?? "").trim();
            if (val !== "") hasAnyValue = true;
            record[header] = val;
        });

        if (hasAnyValue) {
            rows.push(record);
        }
    }

    const normalizedHeaders = new Set(headers.map(normalizeText));
    const isTradeRepublic =
        normalizedHeaders.has("category") &&
        normalizedHeaders.has("type") &&
        (normalizedHeaders.has("amount") || normalizedHeaders.has("transaction_id"));

    const isImagin =
        normalizedHeaders.has("concepto") &&
        normalizedHeaders.has("fecha") &&
        normalizedHeaders.has("importe");

    const detectedBank = isTradeRepublic
        ? "trade_republic"
        : isImagin
          ? "imagin"
          : "generic";

    return { headers, rows, isTradeRepublic, detectedBank };
}

/**
 * Auto-maps date, amount, and description columns from detected headers.
 */
export function detectColumnMapping(headers: string[]): ColumnMapping {
    const findHeader = (candidates: string[]) => {
        for (const candidate of candidates) {
            const match = headers.find((h) => normalizeText(h) === candidate);
            if (match) return match;
        }
        for (const candidate of candidates) {
            const match = headers.find((h) => normalizeText(h).includes(candidate));
            if (match) return match;
        }
        return "";
    };

    return {
        date: findHeader(["fecha", "date", "datetime", "fecha valor", "f. valor"]),
        amount: findHeader(["importe", "amount", "cantidad", "monto", "valor"]),
        description: findHeader(["concepto", "name", "descripcion", "description", "detalle"]),
    };
}

/**
 * Parses a date string into YYYY-MM-DD without timezone-induced day shifts.
 */
export function parseNormalizedDate(raw: string): string | null {
    const value = raw.trim();
    if (!value) return null;

    // ISO: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss...
    const isoMatch = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
    if (isoMatch) {
        return formatValidDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
    }

    // European: DD/MM/YYYY, DD-MM-YYYY, DD/MM/YY
    const euMatch = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:\s.*)?$/);
    if (euMatch) {
        let year = Number(euMatch[3]);
        if (year < 100) year += 2000;
        const month = Number(euMatch[2]);
        const day = Number(euMatch[1]);
        return formatValidDate(year, month, day);
    }

    return null;
}

function formatValidDate(year: number, month: number, day: number): string | null {
    if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
        return null;
    }
    const check = new Date(Date.UTC(year, month - 1, day));
    if (
        check.getUTCFullYear() !== year ||
        check.getUTCMonth() !== month - 1 ||
        check.getUTCDate() !== day
    ) {
        return null;
    }
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Parses amounts in European (-22,94EUR / 1.441,13EUR) or US/ISO (-22.94) format.
 */
export function parseAmount(raw: string): number {
    let clean = raw.replace(/[€$£\sEURUSD]/gi, "").trim();
    if (!clean) return Number.NaN;

    const isNegative = clean.startsWith("-") || clean.endsWith("-");
    clean = clean.replace(/[-+]/g, "");

    if (clean.includes(",") && clean.lastIndexOf(",") > clean.lastIndexOf(".")) {
        clean = clean.replace(/\./g, "").replace(",", ".");
    } else {
        clean = clean.replace(/,/g, "");
    }

    const num = Number.parseFloat(clean);
    if (Number.isNaN(num)) return Number.NaN;
    return isNegative ? -Math.abs(num) : num;
}

/**
 * Returns true if a Trade Republic row is an investment/yield operation rather than cash flow.
 */
export function isTradeRepublicInvestmentRow(row: Record<string, string>): boolean {
    const category = getFieldCaseInsensitive(row, "category").toUpperCase();
    const type = getFieldCaseInsensitive(row, "type").toUpperCase();

    return (
        EXCLUDED_TR_CATEGORIES.has(category) ||
        EXCLUDED_TR_CATEGORIES.has(type) ||
        EXCLUDED_TR_TYPES.has(category) ||
        EXCLUDED_TR_TYPES.has(type)
    );
}

/**
 * Extracts the best description for a row, prioritizing name -> description -> counterparty_name
 * for Trade Republic statements when using the default description column.
 */
export function resolveRowDescription(
    row: Record<string, string>,
    mappedDescriptionCol: string,
    isTradeRepublic: boolean
): string {
    const mapped = mappedDescriptionCol ? (row[mappedDescriptionCol] ?? "").trim() : "";
    if (mapped) return mapped;

    if (isTradeRepublic) {
        return (
            getFieldCaseInsensitive(row, "name") ||
            getFieldCaseInsensitive(row, "description") ||
            getFieldCaseInsensitive(row, "counterparty_name")
        );
    }

    return "";
}

export function isLikelyTransfer(description: string, row?: Record<string, string>): boolean {
    const trType = row ? getFieldCaseInsensitive(row, "type").toUpperCase() : "";
    if (trType === "TRANSFER_INSTANT_INBOUND" || trType === "TRANSFER_INSTANT_OUTBOUND") {
        return true;
    }
    return /transferencia|tranferencia|env[ií]o de dinero|traspaso|\(a .+\)|\(desde .+\)/i.test(
        description
    );
}

const CATEGORY_KEYWORD_RULES: Array<{ keywords: RegExp; categoryNames: string[] }> = [
    {
        keywords: /\b(dia|mercadona|lidl|carrefour|alcampo|aldi|consum|eroski|burger|burguer|kebab|tacobell|taco bell|just eat|glovo|uber eats|mcdonald|dominos|restaurante|helado|comida|hsn|melatonina)\b/i,
        categoryNames: ["alimentacion", "supermercado", "comida"],
    },
    {
        keywords: /\b(amazon|aliexpress|pccomponentes|mediamarkt|zara|primark|decathlon|corte ingles)\b/i,
        categoryNames: ["compras"],
    },
    {
        keywords: /\b(gym|xfitness|x-fitness|fitness|farmacia|clinica|dentista|medico|wegovy|salud)\b/i,
        categoryNames: ["salud"],
    },
    {
        keywords: /\b(gasolina|repsol|cepsa|bp|shell|uber|cabify|renfe|metro|bus|bono transporte|parking|peaje)\b/i,
        categoryNames: ["transporte"],
    },
    {
        keywords: /\b(leroy merlin|bricodepot|ikea|alquiler|hipoteca|iberdrola|endesa|naturgy|comunidad|ferreteria)\b/i,
        categoryNames: ["vivienda", "hogar"],
    },
    {
        keywords: /\b(netflix|spotify|youtube|hbo|disney|twitch|cine|steam|eneba|playstation|nintendo|piscina)\b/i,
        categoryNames: ["entretenimiento", "ocio"],
    },
    {
        keywords: /\b(digi|movistar|orange|vodafone|pepephone|lowi|fibra|icloud|google one)\b/i,
        categoryNames: ["servicios"],
    },
    {
        keywords: /\b(nomina|salario|sueldo)\b/i,
        categoryNames: ["salario"],
    },
];

export function suggestCategoryId(
    description: string,
    amount: number,
    categories: Category[],
    defaultCategoryId: string
): string {
    for (const rule of CATEGORY_KEYWORD_RULES) {
        if (rule.keywords.test(description)) {
            const matched = categories.find((c) =>
                rule.categoryNames.includes(normalizeText(c.name))
            );
            if (matched) return matched.id;
        }
    }

    if (defaultCategoryId) return defaultCategoryId;

    const fallbackName = amount >= 0 ? "otros ingresos" : "otros gastos";
    return (
        categories.find((c) => normalizeText(c.name) === fallbackName)?.id ||
        categories[0]?.id ||
        ""
    );
}

function getFieldCaseInsensitive(row: Record<string, string>, target: string): string {
    const entry = Object.entries(row).find(([k]) => normalizeText(k) === target);
    return entry ? entry[1].trim() : "";
}
