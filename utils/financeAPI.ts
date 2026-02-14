// Finance API service for real-time data
// Using Frankfurter for currency exchange rates (free, no API key needed)
// For stocks, we'll use a simulated approach since free APIs have limitations

export interface ExchangeRates {
    base: string;
    date: string;
    rates: Record<string, number>;
}

export interface StockQuote {
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
    currency: string;
    name?: string;
}

// Cache for API responses (5 minutes TTL)
const cache: Map<string, { data: unknown; timestamp: number }> = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached<T>(key: string): T | null {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data as T;
    }
    return null;
}

function setCache(key: string, data: unknown): void {
    cache.set(key, { data, timestamp: Date.now() });
}

/**
 * Fetch exchange rates from Frankfurter API
 * Free API, no key needed
 * https://www.frankfurter.app/
 */
export async function getExchangeRates(
    base: string = "EUR",
    symbols?: string[]
): Promise<ExchangeRates | null> {
    const cacheKey = `rates:${base}:${symbols?.join(",") || "all"}`;
    const cached = getCached<ExchangeRates>(cacheKey);
    if (cached) return cached;

    try {
        let url = `https://api.frankfurter.app/latest?from=${base}`;
        if (symbols && symbols.length > 0) {
            url += `&to=${symbols.join(",")}`;
        }

        const response = await fetch(url, { next: { revalidate: 300 } });
        if (!response.ok) throw new Error("Failed to fetch exchange rates");

        const data = await response.json();
        const result: ExchangeRates = {
            base: data.base,
            date: data.date,
            rates: data.rates,
        };

        setCache(cacheKey, result);
        return result;
    } catch (error) {
        console.error("Error fetching exchange rates:", error);
        return null;
    }
}

/**
 * Convert amount between currencies
 */
export async function convertCurrency(
    amount: number,
    from: string,
    to: string
): Promise<number | null> {
    if (from === to) return amount;

    const rates = await getExchangeRates(from, [to]);
    if (!rates || !rates.rates[to]) return null;

    return amount * rates.rates[to];
}

/**
 * Simulated stock quotes for demo purposes
 * In production, you would use Alpha Vantage, Yahoo Finance, or similar
 * 
 * Note: Most free stock APIs have severe rate limits.
 * For production, consider:
 * - Alpha Vantage (5 calls/min free)
 * - Yahoo Finance (via yfinance)
 * - IEX Cloud
 * - Polygon.io
 */

const ALPHA_VANTAGE_KEY = process.env.NEXT_PUBLIC_ALPHA_VANTAGE_KEY;

/**
 * Fetch stock/crypto quote from Alpha Vantage
 * Includes caching and rate limit handling (5 calls/min)
 */
export async function getStockQuote(symbol: string): Promise<StockQuote | null> {
    if (!ALPHA_VANTAGE_KEY) {
        console.warn("Alpha Vantage API key is missing");
        return null;
    }

    const cacheKey = `stock:${symbol.toUpperCase()}`;
    const cached = getCached<StockQuote>(cacheKey);
    if (cached) return cached;

    try {
        const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        // Check for rate limit or error
        if (data["Note"] || data["Information"]) {
            console.warn(`Alpha Vantage API Limit reached for ${symbol}:`, data);
            return null; // Return null to trigger fallback to buy price
        }

        if (!data["Global Quote"] || Object.keys(data["Global Quote"]).length === 0) {
            console.warn(`No data found for ${symbol}`);
            return null;
        }

        const quoteData = data["Global Quote"];
        const price = parseFloat(quoteData["05. price"]);
        const change = parseFloat(quoteData["09. change"]);
        const changePercent = parseFloat(quoteData["10. change percent"].replace("%", ""));

        const result: StockQuote = {
            symbol: symbol.toUpperCase(),
            price,
            change,
            changePercent,
            currency: "USD", // Alpha Vantage standard for US stocks/crypto pairs usually
        };

        setCache(cacheKey, result);
        return result;
    } catch (error) {
        console.error(`Error fetching quote for ${symbol}:`, error);
        return null;
    }
}

/**
 * Get multiple stock quotes (sequential to be nice to the rate limit, or parallel if we dare)
 * For 5 calls/min, parallel for a list > 5 will fail.
 * Strategy: Try to fetch. If fail, return null (logic elsewhere handles fallback)
 */
export async function getMultipleStockQuotes(
    symbols: string[]
): Promise<Map<string, StockQuote>> {
    const quotes = new Map<string, StockQuote>();

    // We process sequentially to check cache first and avoid blasting the API if possible,
    // though for a list of new items, we will hit the limit.
    for (const symbol of symbols) {
        const quote = await getStockQuote(symbol);
        if (quote) {
            quotes.set(symbol.toUpperCase(), quote);
        }
        // Small delay to be nice? Not really helpful for 5/min limit unless we wait 12s.
        // We rely on the API returning "Note" and us handling the null.
    }

    return quotes;
}

/**
 * Get stock history (TIME_SERIES_DAILY)
 */
export interface StockHistoryItem {
    date: string;
    price: number;
}

export async function getStockHistory(symbol: string): Promise<StockHistoryItem[]> {
    const cacheKey = `history:${symbol.toUpperCase()}`;
    const cached = getCached<StockHistoryItem[]>(cacheKey);
    if (cached) return cached;

    if (!ALPHA_VANTAGE_KEY) return [];

    try {
        const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data["Note"] || data["Information"] || !data["Time Series (Daily)"]) {
            console.warn(`Alpha Vantage History Error for ${symbol}:`, data);
            return [];
        }

        const timeSeries = data["Time Series (Daily)"];
        const history: StockHistoryItem[] = Object.entries(timeSeries)
            .slice(0, 100) // Last 100 entries
            .map(([date, values]: [string, any]) => ({
                date,
                price: parseFloat(values["4. close"]),
            }))
            .reverse(); // Oldest to newest for chart

        setCache(cacheKey, history);
        return history;
    } catch (error) {
        console.error("Error fetching history:", error);
        return [];
    }
}

/**
 * Calculate portfolio value with current prices
 */
export async function calculatePortfolioValue(
    holdings: Array<{ symbol: string; quantity: number; avgBuyPrice: number }>
): Promise<{
    totalValue: number;
    totalCost: number;
    totalGain: number;
    totalGainPercent: number;
    holdings: Array<{
        symbol: string;
        quantity: number;
        avgBuyPrice: number;
        currentPrice: number;
        value: number;
        gain: number;
        gainPercent: number;
    }>;
}> {
    // Unique symbols to fetch
    const uniqueSymbols = Array.from(new Set(holdings.map((h) => h.symbol)));
    const quotes = await getMultipleStockQuotes(uniqueSymbols);

    let totalValue = 0;
    let totalCost = 0;

    const detailedHoldings = holdings.map((holding) => {
        const quote = quotes.get(holding.symbol.toUpperCase());
        // FALLBACK: If API limit reached or error, use avgBuyPrice (assume 0 movement/neutral)
        // This prevents the UI from showing $0 value or blocking render.
        const currentPrice = quote ? quote.price : holding.avgBuyPrice;

        const value = currentPrice * holding.quantity;
        const cost = holding.avgBuyPrice * holding.quantity;
        const gain = value - cost;
        const gainPercent = cost > 0 ? (gain / cost) * 100 : 0;

        totalValue += value;
        totalCost += cost;

        return {
            symbol: holding.symbol,
            quantity: holding.quantity,
            avgBuyPrice: holding.avgBuyPrice,
            currentPrice,
            value,
            gain,
            gainPercent,
        };
    });

    const totalGain = totalValue - totalCost;
    const totalGainPercent = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

    return {
        totalValue,
        totalCost,
        totalGain,
        totalGainPercent,
        holdings: detailedHoldings,
    };
}

