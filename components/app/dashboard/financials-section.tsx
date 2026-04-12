'use client';

import { DashboardAnalytics } from '@/app/[locale]/(dashboard)/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { DollarSign, TrendingUp, Clock, CheckCircle2 } from 'lucide-react';

type Financials = DashboardAnalytics['financials'];

// ── Formatters ────────────────────────────────────────────────────────────────
function formatCurrency(value: number, currency: string) {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
    }).format(value);
}

const METHOD_LABELS: Record<string, string> = {
    cash:         'Efectivo',
    transfer:     'Transferencia',
    card:         'Tarjeta',
    check:        'Cheque',
    gateway:      'Pasarela',
    other:        'Otro',
};

const METHOD_COLORS = ['hsl(var(--primary))', '#22c55e', '#f59e0b', '#6366f1', '#0ea5e9', '#94a3b8'];

// ── Tooltips ──────────────────────────────────────────────────────────────────
function AreaTooltip({ active, payload, label, currency }: {
    active?: boolean; payload?: { value: number }[]; label?: string; currency: string;
}) {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-sm">
            <p className="font-medium text-foreground">{label}</p>
            <p className="text-muted-foreground">{formatCurrency(payload[0].value, currency)}</p>
        </div>
    );
}

function MethodTooltip({ active, payload, currency }: {
    active?: boolean; payload?: { name: string; value: number; payload: { amount: number } }[]; currency: string;
}) {
    if (!active || !payload?.length) return null;
    const item = payload[0];
    return (
        <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-sm">
            <p className="font-medium">{METHOD_LABELS[item.name] ?? item.name}</p>
            <p className="text-muted-foreground">{item.value} pago{item.value !== 1 ? 's' : ''}</p>
            <p className="text-muted-foreground">{formatCurrency(item.payload.amount, currency)}</p>
        </div>
    );
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function FinKpi({
    label, value, desc, icon: Icon, accent,
}: {
    label: string; value: string; desc?: string;
    icon: React.ElementType; accent?: string;
}) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${accent ?? 'bg-muted'}`}>
                    <Icon className="h-4 w-4" />
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold tracking-tight">{value}</div>
                {desc && <p className="mt-1 text-xs text-muted-foreground">{desc}</p>}
            </CardContent>
        </Card>
    );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function FinancialsSection({ data }: { data: Financials }) {
    const { totalBilled, totalCollected, totalPending, collectionRate, currency, monthlyPayments, paymentMethods } = data;

    const pieMethods = paymentMethods.map((m, i) => ({
        ...m,
        name: m.method,
        fill: METHOD_COLORS[i % METHOD_COLORS.length],
    }));

    const hasData = totalBilled > 0 || totalCollected > 0;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-base font-semibold">Valor económico</h2>
                <p className="text-sm text-muted-foreground">Honorarios facturados y pagos recibidos</p>
            </div>

            {/* KPIs */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <FinKpi
                    label="Total facturado"
                    value={formatCurrency(totalBilled, currency)}
                    desc="Honorarios registrados"
                    icon={DollarSign}
                    accent="bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
                />
                <FinKpi
                    label="Total cobrado"
                    value={formatCurrency(totalCollected, currency)}
                    desc="Pagos confirmados"
                    icon={CheckCircle2}
                    accent="bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
                />
                <FinKpi
                    label="Por cobrar"
                    value={formatCurrency(totalPending, currency)}
                    desc="Saldo pendiente"
                    icon={Clock}
                    accent="bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400"
                />
                <FinKpi
                    label="Tasa de cobro"
                    value={`${collectionRate}%`}
                    desc="Sobre total facturado"
                    icon={TrendingUp}
                    accent={collectionRate >= 80
                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
                        : collectionRate >= 50
                            ? 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400'
                            : 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400'}
                />
            </div>

            {/* Charts */}
            {hasData ? (
                <div className="grid gap-4 lg:grid-cols-5">
                    <Card className="lg:col-span-3">
                        <CardHeader>
                            <CardTitle className="text-base">Pagos recibidos por mes</CardTitle>
                            <CardDescription>Monto cobrado en los últimos 12 meses</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={220}>
                                <AreaChart data={monthlyPayments} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="payGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                                    <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                                    <Tooltip content={<AreaTooltip currency={currency} />} />
                                    <Area
                                        type="monotone"
                                        dataKey="amount"
                                        stroke="hsl(var(--primary))"
                                        strokeWidth={2}
                                        fill="url(#payGrad)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle className="text-base">Métodos de pago</CardTitle>
                            <CardDescription>Distribución de pagos recibidos</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {pieMethods.length === 0 ? (
                                <p className="py-10 text-center text-sm text-muted-foreground">Sin pagos registrados</p>
                            ) : (
                                <ResponsiveContainer width="100%" height={220}>
                                    <PieChart>
                                        <Pie
                                            data={pieMethods}
                                            cx="50%"
                                            cy="45%"
                                            innerRadius={55}
                                            outerRadius={80}
                                            paddingAngle={2}
                                            dataKey="count"
                                        >
                                            {pieMethods.map((entry, i) => (
                                                <Cell key={i} fill={entry.fill} />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<MethodTooltip currency={currency} />} />
                                        <Legend
                                            iconType="circle"
                                            iconSize={8}
                                            formatter={(value) => (
                                                <span className="text-xs text-foreground">
                                                    {METHOD_LABELS[value] ?? value}
                                                </span>
                                            )}
                                            wrapperStyle={{ fontSize: 11 }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </CardContent>
                    </Card>
                </div>
            ) : (
                <Card>
                    <CardContent className="py-10 text-center text-sm text-muted-foreground">
                        Sin honorarios ni pagos registrados todavía
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
