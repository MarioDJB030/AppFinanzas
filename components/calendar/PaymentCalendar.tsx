"use client";

import { useState } from "react";
import Calendar from "react-calendar";
import 'react-calendar/dist/Calendar.css';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, ArrowUpRight, ArrowDownLeft, RefreshCw } from "lucide-react";
import { format, isSameDay } from "date-fns";
import { es } from "date-fns/locale";

interface CalendarEvent {
    date: string;
    type: "income" | "expense";
    amount: number;
    description: string;
    isPast: boolean;
    isRecurring?: boolean;
}

interface PaymentCalendarProps {
    events: CalendarEvent[];
}

type ValuePiece = Date | null;
type Value = ValuePiece | [ValuePiece, ValuePiece];

export default function PaymentCalendar({ events }: PaymentCalendarProps) {
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [value, setValue] = useState<Value>(new Date());

    // Get events for a specific date
    const getEventsForDate = (date: Date) => {
        return events.filter((e) => isSameDay(new Date(e.date), date));
    };

    // Check if date has events
    const hasEventsOnDate = (date: Date) => {
        return events.some((e) => isSameDay(new Date(e.date), date));
    };

    // Get event types for a date (for markers)
    const getEventTypesForDate = (date: Date) => {
        const dateEvents = getEventsForDate(date);
        const types = new Set(dateEvents.map((e) => e.type));
        return {
            hasIncome: types.has("income"),
            hasExpense: types.has("expense"),
            hasRecurring: dateEvents.some((e) => e.isRecurring),
        };
    };

    const selectedDateEvents = getEventsForDate(selectedDate);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5 text-muted-foreground" />
                    Calendario de Pagos
                </CardTitle>
            </CardHeader>
            <CardContent>
                <Calendar
                    onChange={(v) => {
                        setValue(v);
                        if (v instanceof Date) {
                            setSelectedDate(v);
                        }
                    }}
                    value={value}
                    locale="es-ES"
                    tileContent={({ date, view }) => {
                        if (view !== "month") return null;
                        if (!hasEventsOnDate(date)) return null;

                        const { hasIncome, hasExpense, hasRecurring } = getEventTypesForDate(date);

                        return (
                            <div className="flex justify-center gap-0.5 mt-1">
                                {hasExpense && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                )}
                                {hasIncome && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                )}
                                {hasRecurring && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                )}
                            </div>
                        );
                    }}
                    tileClassName={({ date }) => {
                        if (hasEventsOnDate(date)) {
                            return "has-events";
                        }
                        return "";
                    }}
                />

                {/* Legend */}
                <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t text-sm">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-rose-500" />
                        <span className="text-muted-foreground">Gastos</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-muted-foreground">Ingresos</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="text-muted-foreground">Recurrente</span>
                    </div>
                </div>

                {/* Selected Date Events */}
                {selectedDateEvents.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                        <h4 className="font-medium mb-3">
                            {format(selectedDate, "d 'de' MMMM, yyyy", { locale: es })}
                        </h4>
                        <div className="space-y-2">
                            {selectedDateEvents.map((event, index) => (
                                <div
                                    key={index}
                                    className="flex items-center justify-between p-3 rounded-lg bg-accent/30"
                                >
                                    <div className="flex items-center gap-2">
                                        {event.type === "expense" ? (
                                            <ArrowUpRight className="w-4 h-4 text-rose-500" />
                                        ) : (
                                            <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
                                        )}
                                        <span className="text-sm">{event.description}</span>
                                        {event.isRecurring && (
                                            <Badge variant="secondary" className="text-xs">
                                                <RefreshCw className="w-3 h-3 mr-1" />
                                                Recurrente
                                            </Badge>
                                        )}
                                        {!event.isPast && (
                                            <Badge variant="outline" className="text-xs">
                                                Programado
                                            </Badge>
                                        )}
                                    </div>
                                    <span
                                        className={`font-medium ${event.type === "expense" ? "text-rose-500" : "text-emerald-500"
                                            }`}
                                    >
                                        {event.type === "expense" ? "-" : "+"}
                                        {new Intl.NumberFormat("es-ES", {
                                            style: "currency",
                                            currency: "EUR",
                                        }).format(Math.abs(event.amount))}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
