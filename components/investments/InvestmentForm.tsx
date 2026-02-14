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
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2, LineChart, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getStockQuote } from "@/utils/financeAPI";

// Predefined list of popular assets
const POPULAR_ASSETS = [
    // Stocks
    { value: "AAPL", label: "Apple Inc.", type: "stock" },
    { value: "MSFT", label: "Microsoft Corp.", type: "stock" },
    { value: "GOOGL", label: "Alphabet Inc.", type: "stock" },
    { value: "AMZN", label: "Amazon.com Inc.", type: "stock" },
    { value: "NVDA", label: "NVIDIA Corp.", type: "stock" },
    { value: "TSLA", label: "Tesla Inc.", type: "stock" },
    { value: "META", label: "Meta Platforms Inc.", type: "stock" },
    // Crypto
    { value: "BTC", label: "Bitcoin", type: "crypto" },
    { value: "ETH", label: "Ethereum", type: "crypto" },
    { value: "SOL", label: "Solana", type: "crypto" },
    // ETFs
    { value: "SPY", label: "SPDR S&P 500 ETF", type: "etf" },
    { value: "VOO", label: "Vanguard S&P 500 ETF", type: "etf" },
    { value: "QQQ", label: "Invesco QQQ Trust", type: "etf" },
];

const investmentTypes = [
    { value: "stock", label: "Acción" },
    { value: "crypto", label: "Criptomoneda" },
    { value: "etf", label: "ETF" },
];

const currencies = [
    { value: "EUR", label: "Euro (€)" },
    { value: "USD", label: "Dólar ($)" },
    { value: "GBP", label: "Libra (£)" },
];

export default function InvestmentForm() {
    const [isOpen, setIsOpen] = useState(false);
    const [openCombobox, setOpenCombobox] = useState(false);
    const [symbol, setSymbol] = useState("");
    const [name, setName] = useState("");
    const [quantity, setQuantity] = useState("");
    const [avgBuyPrice, setAvgBuyPrice] = useState("");
    const [type, setType] = useState("stock");
    const [currency, setCurrency] = useState("EUR");
    const [loading, setLoading] = useState(false);

    const router = useRouter();
    const supabase = createClient();

    const handleSelectAsset = (currentValue: string) => {
        const asset = POPULAR_ASSETS.find((a) => a.value === currentValue);
        if (asset) {
            setSymbol(asset.value);
            setName(asset.label);
            setType(asset.type);
        } else {
            // Custom asset
            setSymbol(currentValue.toUpperCase());
        }
        setOpenCombobox(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("No user");

            // Try to fetch initial price, but don't block saving if it fails
            let initialPrice = parseFloat(avgBuyPrice); // Default to buy price
            try {
                const quote = await getStockQuote(symbol);
                if (quote && quote.price > 0) {
                    initialPrice = quote.price;
                }
            } catch (err) {
                console.warn("Failed to fetch initial price, using buy price", err);
            }

            const { error } = await supabase.from("investments").insert({
                user_id: user.id,
                symbol: symbol.toUpperCase(),
                name: name || symbol.toUpperCase(),
                quantity: parseFloat(quantity),
                avg_buy_price: parseFloat(avgBuyPrice),
                current_price: initialPrice,
                last_updated: new Date().toISOString(),
                asset_type: (
                    type === "Acción" ? "stock" :
                        type === "Criptomoneda" ? "crypto" :
                            type === "ETF" ? "etf" :
                                type
                ),
                currency,
            });

            if (error) throw error;

            toast.success("Inversión añadida correctamente");
            setIsOpen(false);
            resetForm();
            router.refresh();
        } catch (error) {
            toast.error("Error al guardar la inversión");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setSymbol("");
        setName("");
        setQuantity("");
        setAvgBuyPrice("");
        setType("stock");
        setCurrency("EUR");
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Nueva Inversión
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <LineChart className="w-5 h-5" />
                        Nueva Inversión
                    </DialogTitle>
                    <DialogDescription>
                        Añade una nueva inversión a tu portafolio
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-4">
                        {/* Symbol Selection */}
                        <div className="space-y-2">
                            <Label>Activo (Símbolo)</Label>
                            <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={openCombobox}
                                        className="w-full justify-between"
                                    >
                                        {symbol
                                            ? POPULAR_ASSETS.find((asset) => asset.value === symbol)?.label || symbol
                                            : "Buscar activo..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0">
                                    <Command>
                                        <CommandInput placeholder="Buscar empresa o símbolo..." />
                                        <CommandList>
                                            <CommandEmpty>
                                                <div className="p-2 text-sm text-center">
                                                    <p className="text-muted-foreground mb-2">No encontrado.</p>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="w-full"
                                                        onClick={() => {
                                                            // Logic to handle custom input from search would go here if CommandInput exposed value easily 
                                                            // For now, user has to pick from list or we need a different UI for custom
                                                            // Simplified: User can just type in a separate input if not found? 
                                                            // OR better: Just show a button to "Use custom symbol"
                                                            toast.info("Por favor selecciona de la lista o usa el campo de texto abajo si implementamos uno híbrido.");
                                                        }}
                                                    >
                                                        Usa el campo manual si no está en la lista
                                                    </Button>
                                                </div>
                                            </CommandEmpty>
                                            <CommandGroup heading="Populares">
                                                {POPULAR_ASSETS.map((asset) => (
                                                    <CommandItem
                                                        key={asset.value}
                                                        value={asset.value + " " + asset.label}
                                                        onSelect={() => handleSelectAsset(asset.value)}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                symbol === asset.value ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        <span className="font-mono mr-2">{asset.value}</span>
                                                        <span className="text-muted-foreground">{asset.label}</span>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>

                            {/* Fallback for custom symbol if not in list */}
                            <div className="flex gap-2 items-center">
                                <Input
                                    placeholder="O escribe el símbolo manual (ej: VTI)"
                                    value={symbol}
                                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                                    className="uppercase font-mono"
                                />
                            </div>
                        </div>

                        {/* Name */}
                        <div className="space-y-2">
                            <Label htmlFor="name">Nombre (opcional)</Label>
                            <Input
                                id="name"
                                placeholder="Ej: Apple Inc."
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>

                        {/* Type and Currency */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Tipo</Label>
                                <Select value={type} onValueChange={setType}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {investmentTypes.map((t) => (
                                            <SelectItem key={t.value} value={t.value}>
                                                {t.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Moneda</Label>
                                <Select value={currency} onValueChange={setCurrency}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {currencies.map((c) => (
                                            <SelectItem key={c.value} value={c.value}>
                                                {c.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Quantity and Price */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="quantity">Cantidad</Label>
                                <Input
                                    id="quantity"
                                    type="number"
                                    step="0.0001"
                                    placeholder="0"
                                    value={quantity}
                                    onChange={(e) => setQuantity(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="avgBuyPrice">Precio medio de compra</Label>
                                <Input
                                    id="avgBuyPrice"
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={avgBuyPrice}
                                    onChange={(e) => setAvgBuyPrice(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        {/* Total cost preview */}
                        {quantity && avgBuyPrice && (
                            <div className="p-3 rounded-lg bg-accent/50">
                                <p className="text-sm text-muted-foreground">Coste total</p>
                                <p className="text-lg font-semibold">
                                    {new Intl.NumberFormat("es-ES", {
                                        style: "currency",
                                        currency,
                                    }).format(parseFloat(quantity) * parseFloat(avgBuyPrice))}
                                </p>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading || !symbol || !quantity || !avgBuyPrice}>
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Guardando...
                                </>
                            ) : (
                                <>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Añadir
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
