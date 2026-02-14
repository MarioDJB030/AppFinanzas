"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2, Tag } from "lucide-react";
import { toast } from "sonner";

const ICONS = [
    { value: "🍔", label: "🍔 Alimentación" },
    { value: "🚗", label: "🚗 Transporte" },
    { value: "🏠", label: "🏠 Vivienda" },
    { value: "🎬", label: "🎬 Entretenimiento" },
    { value: "🏥", label: "🏥 Salud" },
    { value: "🛒", label: "🛒 Compras" },
    { value: "📱", label: "📱 Servicios" },
    { value: "💰", label: "💰 Dinero" },
    { value: "💻", label: "💻 Trabajo" },
    { value: "📈", label: "📈 Inversiones" },
    { value: "✈️", label: "✈️ Viajes" },
    { value: "🎁", label: "🎁 Regalos" },
    { value: "📚", label: "📚 Educación" },
    { value: "👕", label: "👕 Ropa" },
    { value: "🐕", label: "🐕 Mascotas" },
    { value: "📦", label: "📦 Otros" },
];

interface CategoryFormProps {
    type?: "income" | "expense";
    variant?: "default" | "outline" | "ghost";
    size?: "default" | "sm" | "lg" | "icon";
    showIcon?: boolean;
}

export default function CategoryForm({
    type: initialType,
    variant = "outline",
    size = "sm",
    showIcon = true
}: CategoryFormProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [name, setName] = useState("");
    const [type, setType] = useState<"income" | "expense">(initialType || "expense");
    const [icon, setIcon] = useState("📦");
    const [loading, setLoading] = useState(false);

    const router = useRouter();
    const supabase = createClient();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("No user");

            const { error } = await supabase.from("categories").insert({
                user_id: user.id,
                name,
                type,
                icon,
            });

            if (error) throw error;

            toast.success("Categoría creada");
            setIsOpen(false);
            resetForm();
            router.refresh();
        } catch (error) {
            toast.error("Error al crear la categoría");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setName("");
        setType(initialType || "expense");
        setIcon("📦");
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant={variant} size={size} className="gap-1">
                    <Plus className="w-4 h-4" />
                    {showIcon && <span>Categoría</span>}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Tag className="w-5 h-5" />
                        Nueva Categoría
                    </DialogTitle>
                    <DialogDescription>
                        Crea una categoría para organizar tus transacciones
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Nombre</Label>
                            <Input
                                id="name"
                                placeholder="Ej: Supermercado, Netflix..."
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Tipo</Label>
                                <Select
                                    value={type}
                                    onValueChange={(v) => setType(v as "income" | "expense")}
                                    disabled={!!initialType}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="expense">Gasto</SelectItem>
                                        <SelectItem value="income">Ingreso</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Icono</Label>
                                <Select value={icon} onValueChange={setIcon}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ICONS.map((i) => (
                                            <SelectItem key={i.value} value={i.value}>
                                                {i.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Guardando...
                                </>
                            ) : (
                                <>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Crear
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
