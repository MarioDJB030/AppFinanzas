import type { SupabaseClient } from "@supabase/supabase-js";
import type { Transaction } from "@/types/database";

export type TransactionKind = "income" | "expense" | "transfer" | "adjustment";

type KindLike = {
    kind?: string | null;
    amount?: number | null;
};

export function getTransactionKind(t: KindLike): TransactionKind {
    if (t.kind === "income" || t.kind === "expense" || t.kind === "transfer" || t.kind === "adjustment") {
        return t.kind;
    }
    return (t.amount ?? 0) >= 0 ? "income" : "expense";
}

export function isNeutralKind(t: KindLike): boolean {
    const kind = getTransactionKind(t);
    return kind === "transfer" || kind === "adjustment";
}

export function countsInStats(t: KindLike): boolean {
    return !isNeutralKind(t);
}

export function kindFromAmount(amount: number): "income" | "expense" {
    return amount >= 0 ? "income" : "expense";
}

export async function insertLinkedTransfer(
    supabase: SupabaseClient,
    params: {
        userId: string;
        fromAccountId: string;
        toAccountId: string;
        amount: number;
        date: string;
        originDescription: string;
        destDescription: string;
    }
) {
    const absAmount = Math.abs(params.amount);

    const { data, error } = await supabase
        .from("transactions")
        .insert([
            {
                user_id: params.userId,
                account_id: params.fromAccountId,
                category_id: null,
                amount: -absAmount,
                description: params.originDescription,
                date: params.date,
                is_recurring: false,
                kind: "transfer",
            },
            {
                user_id: params.userId,
                account_id: params.toAccountId,
                category_id: null,
                amount: absAmount,
                description: params.destDescription,
                date: params.date,
                is_recurring: false,
                kind: "transfer",
            },
        ])
        .select("id");

    if (error) throw error;
    if (!data || data.length < 2) {
        throw new Error("No se pudieron crear las dos partes de la transferencia");
    }

    const [outTx, inTx] = data;
    const { error: linkError } = await supabase
        .from("transactions")
        .update({ linked_transaction_id: inTx.id })
        .eq("id", outTx.id);
    if (linkError) throw linkError;

    const { error: linkError2 } = await supabase
        .from("transactions")
        .update({ linked_transaction_id: outTx.id })
        .eq("id", inTx.id);
    if (linkError2) throw linkError2;
}

export function collectDeleteIds(transactions: Transaction[], selectedIds: Iterable<string>): string[] {
    const byId = new Map(transactions.map((t) => [t.id, t]));
    const ids = new Set<string>();

    for (const id of selectedIds) {
        ids.add(id);
        const linked = byId.get(id)?.linked_transaction_id;
        if (linked) ids.add(linked);
    }

    return Array.from(ids);
}
