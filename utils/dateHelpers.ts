import { startOfDay, endOfDay, subMonths, addMonths, setDate, getDate, isBefore } from "date-fns";

export function getCustomMonthRange(date: Date, startDay: number) {
    // If startDay is 1, it's just the standard month
    // But for consistency, we treat it as a cycle from 1st to End of Month.
    // Actually, if startDay is 1, cycle is 1st of this month to last day of this month.

    // Normalizing startDay to valid range 1-31
    const safeStartDay = Math.max(1, Math.min(31, startDay));

    const currentDay = getDate(date);
    let startDate: Date;
    let endDate: Date;

    if (currentDay >= safeStartDay) {
        // e.g. Today is 15th, StartDay is 10th.
        // Cycle started on 10th of THIS month.
        startDate = startOfDay(setDate(date, safeStartDay));
        // Cycle ends on (10th of NEXT month) - 1 day
        // But simpler: Cycle is 10th Jan -> 9th Feb.
        endDate = endOfDay(subMonths(setDate(addMonths(date, 1), safeStartDay), 0));
        // Wait, setDate(addMonths(date,1), safeStartDay) gives 10th Feb. 
        // We want 9th Feb. So subtract 1 day.
        endDate = endOfDay(new Date(startDate));
        endDate.setMonth(endDate.getMonth() + 1);
        endDate.setDate(safeStartDay - 1);
    } else {
        // e.g. Today is 5th, StartDay is 10th.
        // Cycle started on 10th of PREVIOUS month.
        startDate = startOfDay(subMonths(setDate(date, safeStartDay), 1));

        endDate = endOfDay(setDate(date, safeStartDay - 1));
    }

    // Handle edge cases where "safeStartDay - 1" is 0 (should be last day of prev month) 
    // or setDate handles it automatically? setDate(0) sets it to last day of prev month. 
    // Yes, JS Date handles setDate(0) correctly.

    return { start: startDate, end: endDate };
}

export function formatCurrency(amount: number, currencyCode: string = "EUR"): string {
    return new Intl.NumberFormat("es-ES", {
        style: "currency",
        currency: currencyCode,
    }).format(amount);
}
