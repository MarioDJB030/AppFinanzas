"use client";

import { useState } from "react";
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
    DialogFooter,
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Plus } from "lucide-react";

const formSchema = z.object({
    name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
    icon: z.string().min(1, "Debes seleccionar un icono/emoji"),
    target_amount: z.coerce.number().min(1, "El objetivo debe ser mayor a 0"),
    deadline: z.string().optional(),
});

export default function GoalForm() {
    const [open, setOpen] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    const form = useForm({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            icon: "🎯",
            target_amount: 0,
            deadline: "",
        },
    });

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase.from("goals").insert({
                user_id: user.id,
                name: values.name,
                icon: values.icon,
                target_amount: values.target_amount,
                current_amount: 0, // Starts at 0
                deadline: values.deadline || null,
            });

            if (error) throw error;

            toast.success("Meta creada correctamente");
            setOpen(false);
            form.reset();
            router.refresh();
        } catch (error) {
            console.error(error);
            toast.error("Error al crear la meta");
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Nueva Meta
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Nueva Meta de Ahorro</DialogTitle>
                    <DialogDescription>
                        Define tu objetivo y empieza a ahorrar.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid grid-cols-4 gap-4">
                            <FormField
                                control={form.control}
                                name="icon"
                                render={({ field }) => (
                                    <FormItem className="col-span-1">
                                        <FormLabel>Icono</FormLabel>
                                        <FormControl>
                                            <Input {...field} className="text-center text-2xl" placeholder="🎯" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem className="col-span-3">
                                        <FormLabel>Nombre</FormLabel>
                                        <FormControl>
                                            <Input {...field} placeholder="Ej: Vacaciones" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={form.control}
                            name="target_amount"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Objetivo (€)</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="0.01" {...field} value={field.value as number} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="deadline"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Fecha Límite (Opcional)</FormLabel>
                                    <FormControl>
                                        <Input type="date" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Crear Meta
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
