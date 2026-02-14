"use client";

import { useEffect, useState } from "react";
import { UserSettings } from "@/types/database";
import { getUserSettings, updateUserSettings, resetUserAccount } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { User, Settings2, Trash2, Download, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";

export default function SettingsPage() {
    const [settings, setSettings] = useState<UserSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [email, setEmail] = useState("");

    // Form states
    const [username, setUsername] = useState("");
    const [currency, setCurrency] = useState("EUR");
    const [startDay, setStartDay] = useState("1");

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const data = await getUserSettings();
            if (data) {
                setSettings(data);
                setUsername(data.username);
                setCurrency(data.currency);
                setStartDay(data.start_day_of_month.toString());
            }

            // Get email from auth
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.email) setEmail(user.email);

        } catch (error) {
            console.error(error);
            toast.error("Error cargando configuración");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveProfile = async () => {
        setSaving(true);
        try {
            await updateUserSettings({ username });
            toast.success("Perfil actualizado");
        } catch (error) {
            toast.error("Error al guardar perfil");
        } finally {
            setSaving(false);
        }
    };

    const handleSavePreferences = async () => {
        setSaving(true);
        try {
            await updateUserSettings({
                currency,
                start_day_of_month: parseInt(startDay)
            });
            toast.success("Preferencias actualizadas");
        } catch (error) {
            toast.error("Error al guardar preferencias");
        } finally {
            setSaving(false);
        }
    };

    const handleResetAccount = async () => {
        try {
            await resetUserAccount();
            toast.success("Cuenta reiniciada correctamente");
            // Optional: Redirect or refresh
            window.location.href = "/dashboard";
        } catch (error) {
            toast.error("Error al reiniciar cuenta");
        }
    };

    const handleExportData = async () => {
        try {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: transactions } = await supabase
                .from("transactions")
                .select("*, category:categories(name), account:accounts(name)")
                .eq("user_id", user.id);

            if (!transactions) {
                toast.info("No hay datos para exportar");
                return;
            }

            // Convert to CSV
            const headers = ["Fecha", "Descripción", "Monto", "Categoría", "Cuenta", "Tipo"];
            const rows = transactions.map(t => [
                t.date,
                t.description || "",
                t.amount,
                t.category?.name || "Sin categoría",
                t.account?.name || "Desconocido",
                t.amount >= 0 ? "Ingreso" : "Gasto"
            ]);

            const csvContent = [
                headers.join(","),
                ...rows.map(row => row.join(","))
            ].join("\n");

            // Download
            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `finanzas_export_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            toast.success("Datos exportados");

        } catch (error) {
            console.error(error);
            toast.error("Error al exportar datos");
        }
    };

    if (loading) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>;
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold">Configuración</h1>

            <Tabs defaultValue="profile" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="profile" className="flex items-center gap-2">
                        <User className="w-4 h-4" /> Perfil
                    </TabsTrigger>
                    <TabsTrigger value="preferences" className="flex items-center gap-2">
                        <Settings2 className="w-4 h-4" /> Preferencias
                    </TabsTrigger>
                    <TabsTrigger value="advanced" className="flex items-center gap-2">
                        <Trash2 className="w-4 h-4" /> Avanzado
                    </TabsTrigger>
                </TabsList>

                {/* PROFILE TAB */}
                <TabsContent value="profile">
                    <Card>
                        <CardHeader>
                            <CardTitle>Perfil de Usuario</CardTitle>
                            <CardDescription>Gestiona tu información personal.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1">
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" value={email} disabled className="bg-muted" />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="username">Nombre de Usuario</Label>
                                <Input
                                    id="username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                />
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button onClick={handleSaveProfile} disabled={saving}>
                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Guardar Cambios
                            </Button>
                        </CardFooter>
                    </Card>
                </TabsContent>

                {/* PREFERENCES TAB */}
                <TabsContent value="preferences">
                    <Card>
                        <CardHeader>
                            <CardTitle>Preferencias de la App</CardTitle>
                            <CardDescription>Personaliza tu experiencia financiera.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1">
                                <Label>Moneda Principal</Label>
                                <Select value={currency} onValueChange={setCurrency}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecciona moneda" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="EUR">Euro (€)</SelectItem>
                                        <SelectItem value="USD">Dólar ($)</SelectItem>
                                        <SelectItem value="GBP">Libra (£)</SelectItem>
                                        <SelectItem value="MXN">Peso Mexicano ($)</SelectItem>
                                        <SelectItem value="COP">Peso Colombiano ($)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="startDay">Día de Inicio del Mes</Label>
                                <Input
                                    id="startDay"
                                    type="number"
                                    min="1"
                                    max="31"
                                    value={startDay}
                                    onChange={(e) => setStartDay(e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Usado para calcular tus presupuestos y resúmenes mensuales.
                                </p>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button onClick={handleSavePreferences} disabled={saving}>
                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                <Save className="w-4 h-4 mr-2" />
                                Guardar Preferencias
                            </Button>
                        </CardFooter>
                    </Card>
                </TabsContent>

                {/* ADVANCED TAB */}
                <TabsContent value="advanced">
                    <div className="grid gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Exportar Datos</CardTitle>
                                <CardDescription>Descarga todas tus transacciones en formato CSV.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button variant="outline" onClick={handleExportData} className="w-full sm:w-auto">
                                    <Download className="w-4 h-4 mr-2" />
                                    Exportar a CSV
                                </Button>
                            </CardContent>
                        </Card>

                        <Card className="border-destructive/50">
                            <CardHeader>
                                <CardTitle className="text-destructive">Zona de Peligro</CardTitle>
                                <CardDescription>Acciones irreversibles para tu cuenta.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" className="w-full sm:w-auto">
                                            <Trash2 className="w-4 h-4 mr-2" />
                                            Resetear Cuenta
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Esta acción eliminará permanentemente todas tus transacciones, cuentas, presupuestos y metas.
                                                Esta acción no se puede deshacer.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleResetAccount} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                                Sí, borrar todo
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
