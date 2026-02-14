"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import type { Category, Budget } from "@/types/database";

const formSchema = z.object({
    category_id: z.string().min(1, "Debes seleccionar una categoría"),
    amount_limit: z.coerce.number().min(1, "El límite debe ser mayor a 0"),
});

interface BudgetFormProps {
    categories: Category[];
    existingBudget?: Budget; // If passed, it's edit mode
    trigger?: React.ReactNode;
}

export default function BudgetForm({ categories, existingBudget, trigger }: BudgetFormProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            category_id: existingBudget?.category_id || "",
            amount_limit: existingBudget?.amount_limit || 0,
        },
    });

    useEffect(() => {
        if (existingBudget && open) {
            form.reset({
                category_id: existingBudget.category_id,
                amount_limit: existingBudget.amount_limit,
            });
        } else if (!existingBudget && open) {
            form.reset({
                category_id: "",
                amount_limit: 0,
            });
        }
    }, [existingBudget, open, form]);

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                toast.error("No autenticado");
                return;
            }

            // Upsert operation
            const { error } = await supabase
                .from("budgets")
                .upsert({
                    user_id: user.id,
                    category_id: values.category_id,
                    amount_limit: values.amount_limit,
                    period: "monthly",
                }, {
                    onConflict: "user_id, category_id" // Use the unique constraint
                });

            if (error) throw error;

            toast.success(existingBudget ? "Presupuesto actualizado" : "Presupuesto creado");
            setOpen(false);
            router.refresh();
        } catch (error) {
            console.error(error);
            toast.error("Error al guardar el presupuesto");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button className="gap-2">
                        <Plus className="w-4 h-4" /> Nuevo Presupuesto
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{existingBudget ? "Editar Presupuesto" : "Crear Nuevo Presupuesto"}</DialogTitle>
                    <DialogDescription>
                        Define un límite mensual para controlar tus gastos en esta categoría.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="category_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Categoría</FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                        disabled={!!existingBudget} // Disable changing category in edit mode
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecciona una categoría" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {categories.map((cat) => (
                                                <SelectItem key={cat.id} value={cat.id}>
                                                    <span className="flex items-center gap-2">
                                                        <span>{cat.icon}</span>
                                                        {cat.name}
                                                    </span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="amount_limit"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Límite Mensual (€)</FormLabel>
                                    <FormControl>
                                        <Input type="number" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-end gap-2 pt-4">
                            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={loading}>
                                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Guardar
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
