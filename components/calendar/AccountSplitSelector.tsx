"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import type { Account } from "@/types/database";

export type SplitMode = "percentage" | "fixed";

export interface SplitState {
    accountId: string;
    active: boolean;
    value: number;
}

interface AccountSplitSelectorProps {
    accounts: Account[];
    splits: SplitState[];
    setSplits: (splits: SplitState[]) => void;
    splitMode: SplitMode;
    setSplitMode: (mode: SplitMode) => void;
    totalAmount: number;
}

export default function AccountSplitSelector({
    accounts,
    splits,
    setSplits,
    splitMode,
    setSplitMode,
    totalAmount
}: AccountSplitSelectorProps) {

    const handleToggleAccount = (accountId: string, checked: boolean) => {
        setSplits(
            splits.map((s) =>
                s.accountId === accountId ? { ...s, active: checked, value: checked ? s.value : 0 } : s
            )
        );
    };

    const handleValueChange = (accountId: string, value: string) => {
        const numValue = parseFloat(value) || 0;
        setSplits(
            splits.map((s) =>
                s.accountId === accountId ? { ...s, value: numValue } : s
            )
        );
    };

    // Calculate totals based on active splits
    const activeSplits = splits.filter((s) => s.active);
    const currentTotal = activeSplits.reduce((sum, s) => sum + s.value, 0);
    
    // Target is either 100 (%) or totalAmount (fixed)
    const targetTotal = splitMode === "percentage" ? 100 : totalAmount;
    
    // Avoid division by zero
    const progressPercentage = targetTotal > 0 
        ? Math.min((currentTotal / targetTotal) * 100, 100) 
        : 0;

    const isComplete = currentTotal === targetTotal && activeSplits.length > 0 && targetTotal > 0;
    const isOver = currentTotal > targetTotal;

    return (
        <div className="space-y-4 p-4 border rounded-xl bg-card">
            <div className="flex items-center justify-between">
                <Label className="font-semibold">Cuentas de reparto</Label>
                <div className="flex items-center gap-2">
                    <Label htmlFor="split-mode" className="text-sm text-muted-foreground">Cantidad fija</Label>
                    <Switch
                        id="split-mode"
                        checked={splitMode === "percentage"}
                        onCheckedChange={(checked) => {
                            setSplitMode(checked ? "percentage" : "fixed");
                            // Reset values when switching modes to avoid invalid states
                            setSplits(splits.map(s => ({ ...s, value: 0 })));
                        }}
                    />
                    <Label htmlFor="split-mode" className="text-sm font-medium">Porcentaje (%)</Label>
                </div>
            </div>

            <div className="space-y-3">
                {accounts.map((account) => {
                    const splitState = splits.find((s) => s.accountId === account.id);
                    if (!splitState) return null;

                    return (
                        <div key={account.id} className="flex items-center gap-4">
                            <div className="flex items-center space-x-2 flex-1">
                                <Checkbox
                                    id={`split-account-${account.id}`}
                                    checked={splitState.active}
                                    onCheckedChange={(c) => handleToggleAccount(account.id, c === true)}
                                />
                                <Label
                                    htmlFor={`split-account-${account.id}`}
                                    className="cursor-pointer flex-1 truncate font-medium"
                                >
                                    {account.name}
                                </Label>
                            </div>
                            
                            <div className="w-32 relative">
                                {splitState.active ? (
                                    <div className="relative">
                                        <Input
                                            type="number"
                                            step={splitMode === "percentage" ? "1" : "0.01"}
                                            min="0"
                                            max={splitMode === "percentage" ? "100" : undefined}
                                            value={splitState.value || ""}
                                            onChange={(e) => handleValueChange(account.id, e.target.value)}
                                            className={`pr-8 ${isOver && splitState.value > 0 ? "border-rose-500 focus-visible:ring-rose-500" : ""}`}
                                            placeholder="0"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                                            {splitMode === "percentage" ? "%" : "€"}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="h-10 border border-transparent"></div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="pt-4 border-t space-y-2">
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total distribuido:</span>
                    <span className={`font-bold ${isComplete ? 'text-emerald-500' : isOver ? 'text-rose-500' : 'text-amber-500'}`}>
                        {currentTotal} {splitMode === "percentage" ? "%" : "€"} 
                        / {targetTotal} {splitMode === "percentage" ? "%" : "€"}
                    </span>
                </div>
                <Progress 
                    value={progressPercentage} 
                    className={`h-2 ${isComplete ? '[&>div]:bg-emerald-500' : isOver ? '[&>div]:bg-rose-500' : '[&>div]:bg-amber-500'}`} 
                />
                
                {isOver && (
                    <p className="text-xs text-rose-500">
                        Has superado el {targetTotal}{splitMode === "percentage" ? "%" : "€"}. Por favor, ajusta los valores.
                    </p>
                )}
                {!isComplete && !isOver && targetTotal > 0 && (
                    <p className="text-xs text-amber-500">
                        Aún falta por asignar {targetTotal - currentTotal}{splitMode === "percentage" ? "%" : "€"}.
                    </p>
                )}
            </div>
        </div>
    );
}
