import { SupabaseClient } from "@supabase/supabase-js";
import { addDays, addWeeks, addMonths, addYears, isBefore, isEqual, startOfDay } from "date-fns";

type Frequency = "daily" | "weekly" | "biweekly" | "monthly" | "yearly";

/**
 * Calculate the next due date based on frequency
 */
function calculateNextDueDate(currentDueDate: Date, frequency: Frequency): Date {
    switch (frequency) {
        case "daily":
            return addDays(currentDueDate, 1);
        case "weekly":
            return addWeeks(currentDueDate, 1);
        case "biweekly":
            return addWeeks(currentDueDate, 2);
        case "monthly":
            return addMonths(currentDueDate, 1);
        case "yearly":
            return addYears(currentDueDate, 1);
        default:
            return addMonths(currentDueDate, 1);
    }
}

/**
 * Check for recurring payments that are due and process them
 * This function should be called when loading the dashboard
 * 
 * This function is designed to be silent:
 * - Returns early if no session is available
 * - Returns early if no recurring rules exist
 * - Only logs actual errors with real content
 */
export async function checkForRecurringPayments(
    supabase: SupabaseClient,
    userId: string
): Promise<{ processed: number; errors: string[] }> {
    // Early return if no userId provided
    if (!userId) {
        return { processed: 0, errors: [] };
    }

    try {
        // Check if we have a valid session before proceeding
        const { data: { session } } = await supabase.auth.getSession();

        // Silent return if no session - user might not be fully loaded yet
        if (!session) {
            return { processed: 0, errors: [] };
        }

        const today = startOfDay(new Date());
        const processed: string[] = [];
        const errors: string[] = [];

        // Fetch all active recurring rules where next_due_date is today or earlier
        // Using .select('*') without .single() to avoid PGRST116 error
        const { data: recurringRules, error: fetchError } = await supabase
            .from("recurring_rules")
            .select("*")
            .eq("user_id", userId)
            .eq("active", true)
            .lte("next_due_date", today.toISOString().split("T")[0]);

        // Only log errors if fetchError has real content
        if (fetchError && Object.keys(fetchError).length > 0) {
            // Check if it's a meaningful error (not just empty object)
            if (fetchError.message || fetchError.code) {
                console.error("Error fetching recurring rules:", fetchError);
                return { processed: 0, errors: [fetchError.message || "Unknown error"] };
            }
            // Silent return for empty error objects
            return { processed: 0, errors: [] };
        }

        // Silent return if no recurring rules found - this is normal
        if (!recurringRules || recurringRules.length === 0) {
            return { processed: 0, errors: [] };
        }

        // Process each due recurring rule
        for (const rule of recurringRules) {
            try {
                let currentDueDate = startOfDay(new Date(rule.next_due_date));

                // Process all missed payments up to today
                while (isBefore(currentDueDate, today) || isEqual(currentDueDate, today)) {
                    // Create the transaction
                    const { error: insertError } = await supabase.from("transactions").insert({
                        user_id: userId,
                        account_id: rule.account_id,
                        category_id: rule.category_id,
                        amount: rule.amount,
                        description: rule.description || `Pago recurrente`,
                        date: currentDueDate.toISOString().split("T")[0],
                        is_recurring: true,
                        recurring_rule_id: rule.id,
                    });

                    if (insertError) {
                        errors.push(`Error processing rule ${rule.id}: ${insertError.message}`);
                        break;
                    }

                    // Calculate next due date
                    currentDueDate = calculateNextDueDate(currentDueDate, rule.frequency as Frequency);
                }

                // Update the rule with the new next_due_date
                const { error: updateError } = await supabase
                    .from("recurring_rules")
                    .update({
                        next_due_date: currentDueDate.toISOString().split("T")[0],
                    })
                    .eq("id", rule.id);

                if (updateError) {
                    errors.push(`Error updating rule ${rule.id}: ${updateError.message}`);
                } else {
                    processed.push(rule.id);
                }
            } catch (err) {
                // Silent catch for individual rule processing errors
                if (err instanceof Error && err.message) {
                    errors.push(`Error processing rule ${rule.id}: ${err.message}`);
                }
            }
        }

        return { processed: processed.length, errors };
    } catch (err) {
        // Only log if it's a real error with content
        if (err instanceof Error && err.message) {
            console.error("Error in checkForRecurringPayments:", err.message);
            return { processed: 0, errors: [err.message] };
        }
        // Silent return for unknown/empty errors
        return { processed: 0, errors: [] };
    }
}
