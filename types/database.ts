// Database types based on existing Supabase schema

export interface Profile {
    id: string;
    email: string;
    currency: string;
    created_at?: string;
    updated_at?: string;
}

export interface UserSettings {
    user_id: string;
    username: string;
    currency: string;
    start_day_of_month: number;
    created_at?: string;
    updated_at?: string;
}

export interface Account {
    id: string;
    user_id: string;
    name: string;
    type: "bank" | "cash" | "savings" | "investment";
    initial_balance: number;
    created_at?: string;
    updated_at?: string;
}

export interface Category {
    id: string;
    user_id: string;
    name: string;
    type: "income" | "expense";
    icon: string;
    created_at?: string;
}

export interface Transaction {
    id: string;
    user_id: string;
    account_id: string;
    category_id: string;
    amount: number;
    description?: string;
    date: string;
    is_recurring: boolean;
    recurring_rule_id?: string;
    created_at?: string;
    // Joined fields
    account?: Account;
    category?: Category;
    receipts?: Receipt[];
}

export interface Receipt {
    id: string;
    user_id: string;
    transaction_id?: string | null;
    file_url: string;
    // file_path: string; // Removed or optional based on DB mismatch
    file_path?: string;
    name: string; // Renamed from file_name
    file_size?: number; // Made optional
    file_type: string;
    created_at?: string;
}

export interface RecurringRule {
    id: string;
    user_id: string;
    account_id: string;
    category_id: string;
    description?: string;
    frequency: "daily" | "weekly" | "biweekly" | "monthly" | "yearly";
    start_date: string;
    next_due_date: string;
    amount: number;
    active: boolean;
    created_at?: string;
    // Joined fields
    account?: Account;
    category?: Category;
}

export interface Investment {
    id: string;
    user_id: string;
    symbol: string;
    name?: string;
    quantity: number;
    avg_buy_price: number;
    currency: string;
    asset_type: "stock" | "crypto" | "etf" | "bond" | "other";
    current_price?: number;
    last_updated?: string;
    created_at?: string;
    updated_at?: string;
}

export interface Budget {
    id: string;
    user_id: string;
    category_id: string;
    amount_limit: number;
    period: string; // 'monthly'
    created_at?: string;
    updated_at?: string;
    // Joined fields
    category?: Category;
}

// API Response types
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
}

// Dashboard types
export interface BalanceSummary {
    totalBalance: number;
    totalIncome: number;
    totalExpenses: number;
    accountBalances: {
        account: Account;
        balance: number;
    }[];
}

export interface CategoryExpense {
    category: string;
    icon: string;
    amount: number;
    percentage: number;
    color: string;
}

export interface Goal {
    id: string;
    user_id: string;
    name: string;
    target_amount: number;
    current_amount: number;
    deadline?: string;
    icon: string;
    is_pinned?: boolean;
    created_at?: string;
}
