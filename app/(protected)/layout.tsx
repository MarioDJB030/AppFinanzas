"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    LayoutDashboard,
    Wallet,
    ArrowUpDown,
    Calendar,
    TrendingUp,
    Menu,
    LogOut,
    Settings,
    User,
    PieChart,
    Trophy,
    Receipt,
} from "lucide-react";
import { toast } from "sonner";

const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Cuentas", href: "/accounts", icon: Wallet },
    { name: "Transacciones", href: "/transactions", icon: ArrowUpDown },
    { name: "Calendario", href: "/calendar", icon: Calendar },
    { name: "Inversiones", href: "/investments", icon: TrendingUp },
    { name: "Presupuestos", href: "/budgets", icon: PieChart },
    { name: "Metas", href: "/goals", icon: Trophy },
    { name: "Recibos", href: "/receipts", icon: Receipt },
    { name: "Configuración", href: "/settings", icon: Settings },
];

function NavLink({ item, onClick }: { item: typeof navigation[0]; onClick?: () => void }) {
    const pathname = usePathname();
    const isActive = pathname === item.href;
    const Icon = item.icon;

    return (
        <Link
            href={item.href}
            onClick={onClick}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${isActive
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
        >
            <Icon className="w-5 h-5" />
            <span className="font-medium">{item.name}</span>
        </Link>
    );
}

function Sidebar({ onNavClick }: { onNavClick?: () => void }) {
    return (
        <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="px-4 py-6">
                <Link href="/dashboard" className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                        <Wallet className="w-5 h-5 text-primary" />
                    </div>
                    <span className="text-xl font-bold">FinanzApp</span>
                </Link>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 space-y-1">
                {navigation.map((item) => (
                    <NavLink key={item.name} item={item} onClick={onNavClick} />
                ))}
            </nav>

            {/* Footer */}
            <div className="px-3 py-4 border-t border-border">
                <p className="text-xs text-muted-foreground text-center">
                    © 2025 FinanzApp
                </p>
            </div>
        </div>
    );
}

function UserMenu() {
    const router = useRouter();
    const supabase = createClient();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        toast.success("Sesión cerrada");
        router.push("/auth/login");
        router.refresh();
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/10 text-primary">
                            <User className="w-5 h-5" />
                        </AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                    <Link href="/settings" className="w-full flex items-center cursor-pointer">
                        <Settings className="w-4 h-4 mr-2" />
                        Configuración
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                    <LogOut className="w-4 h-4 mr-2" />
                    Cerrar sesión
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export default function ProtectedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="min-h-screen bg-background">
            {/* Desktop Sidebar */}
            <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col border-r border-border bg-card">
                <Sidebar />
            </aside>

            {/* Mobile Sidebar */}
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                <SheetTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="lg:hidden fixed top-4 left-4 z-50"
                    >
                        <Menu className="w-5 h-5" />
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 p-0">
                    <SheetTitle className="sr-only">Menú de navegación</SheetTitle>
                    <Sidebar onNavClick={() => setSidebarOpen(false)} />
                </SheetContent>
            </Sheet>

            {/* Main Content */}
            <div className="lg:pl-64">
                {/* Top Bar */}
                <header className="sticky top-0 z-40 flex h-16 items-center justify-end gap-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-8">
                    <UserMenu />
                </header>

                {/* Page Content */}
                <main className="p-4 lg:p-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
