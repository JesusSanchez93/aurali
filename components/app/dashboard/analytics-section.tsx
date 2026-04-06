'use client';

import { DashboardAnalytics } from '@/app/[locale]/(dashboard)/actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
    TrendingUp, TrendingDown, Activity, Archive,
    XCircle, CheckCircle2, BarChart3, Percent,
} from 'lucide-react';

// ── Status colors ────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
    draft:               '#94a3b8',
    pending_client_data: '#f59e0b',
    completed:           '#3b82f6',
    approved:            '#22c55e',
    paid:                '#10b981',
    documents_approved:  '#14b8a6',
    documents_sent:      '#0ea5e9',
    documents_received:  '#6366f1',
    finished:            '#a855f7',
    archived:            '#71717a',
    declined:            '#ef4444',
};

const STATUS_LABELS: Record<string, string> = {
    draft:               'Borrador',
    pending_client_data: 'En proceso',
    completed:           'Completado',
    approved:            'Aprobado',
    paid:                'Pagado',
    documents_approved:  'Docs. aprobados',
    documents_sent:      'Docs. enviados',
    documents_received:  'Docs. recibidos',
    finished:            'Finalizado',
    archived:            'Archivado',
    declined:            'Declinado',
};

// ── Custom tooltip ────────────────────────────────────────────────────────────
function BarTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-sm">
            <p className="font-medium text-foreground">{label}</p>
            <p className="text-muted-foreground">{payload[0].value} procesos</p>
        </div>
    );
}

function PieTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number; payload: { status: string } }[] }) {
    if (!active || !payload?.length) return null;
    const item = payload[0];
    return (
        <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-sm">
            <p className="font-medium">{STATUS_LABELS[item.payload.status] ?? item.name}</p>
            <p className="text-muted-foreground">{item.value} procesos</p>
        </div>
    );
}

function HorizontalTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-sm">
            <p className="font-medium">{label}</p>
            <p className="text-muted-foreground">{payload[0].value} casos</p>
        </div>
    );
}

// ── KPI card ─────────────────────────────────────────────────────────────────
function KpiCard({
    label, value, desc, icon: Icon, accent,
}: {
    label: string;
    value: string | number;
    desc?: string;
    icon: React.ElementType;
    accent?: string;
}) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{label}</CardTitle>
                <Icon className={`h-4 w-4 ${accent ?? 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                {desc && <p className="text-xs text-muted-foreground mt-1">{desc}</p>}
            </CardContent>
        </Card>
    );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AnalyticsSection({ data }: { data: DashboardAnalytics }) {
    const { kpis, statusDistribution, monthlyVolume, topBanks, fraudFactors } = data;

    const pieStat = statusDistribution.map((d) => ({
        ...d,
        name: STATUS_LABELS[d.status] ?? d.status,
        fill: STATUS_COLORS[d.status] ?? '#94a3b8',
    }));

    return (
        <div className="space-y-6">
            {/* ── KPIs ──────────────────────────────────────────────────────── */}
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
                <KpiCard
                    label="Total procesos"
                    value={kpis.total}
                    desc="Histórico completo"
                    icon={BarChart3}
                />
                <KpiCard
                    label="Activos"
                    value={kpis.active}
                    desc="En curso ahora"
                    icon={Activity}
                    accent="text-amber-500"
                />
                <KpiCard
                    label="Finalizados"
                    value={kpis.finished}
                    desc="Cerrados con éxito"
                    icon={CheckCircle2}
                    accent="text-purple-500"
                />
                <KpiCard
                    label="Archivados"
                    value={kpis.archived}
                    desc="Suspendidos"
                    icon={Archive}
                    accent="text-zinc-500"
                />
                <KpiCard
                    label="Declinados"
                    value={kpis.declined}
                    desc="No continuaron"
                    icon={XCircle}
                    accent="text-red-500"
                />
                <KpiCard
                    label="Conversión"
                    value={`${kpis.conversionRate}%`}
                    desc="Procesos finalizados"
                    icon={kpis.conversionRate >= 50 ? TrendingUp : TrendingDown}
                    accent={kpis.conversionRate >= 50 ? 'text-green-500' : 'text-red-400'}
                />
            </div>

            {/* ── Volume + Status distribution ──────────────────────────────── */}
            <div className="grid gap-4 lg:grid-cols-5">
                <Card className="lg:col-span-3">
                    <CardHeader>
                        <CardTitle className="text-base">Volumen mensual</CardTitle>
                        <CardDescription>Procesos abiertos en los últimos 12 meses</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={monthlyVolume} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                                <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                                <Tooltip content={<BarTooltip />} cursor={{ fill: 'hsl(var(--muted))' }} />
                                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={36} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-base">Distribución por estado</CardTitle>
                        <CardDescription>Composición actual del portafolio</CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-center justify-center">
                        {pieStat.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-10">Sin datos</p>
                        ) : (
                            <ResponsiveContainer width="100%" height={220}>
                                <PieChart>
                                    <Pie
                                        data={pieStat}
                                        cx="50%"
                                        cy="45%"
                                        innerRadius={55}
                                        outerRadius={80}
                                        paddingAngle={2}
                                        dataKey="count"
                                    >
                                        {pieStat.map((entry, i) => (
                                            <Cell key={i} fill={entry.fill} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<PieTooltip />} />
                                    <Legend
                                        iconType="circle"
                                        iconSize={8}
                                        formatter={(value) => <span className="text-xs text-foreground">{value}</span>}
                                        wrapperStyle={{ fontSize: 11 }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* ── Top banks + Fraud factors ─────────────────────────────────── */}
            <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Bancos más afectados</CardTitle>
                        <CardDescription>Cantidad de casos por entidad bancaria</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {topBanks.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-6 text-center">Sin datos bancarios</p>
                        ) : (
                            <ResponsiveContainer width="100%" height={Math.max(180, topBanks.length * 36)}>
                                <BarChart
                                    layout="vertical"
                                    data={topBanks}
                                    margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                                    <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                                    <YAxis type="category" dataKey="bank" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={110} />
                                    <Tooltip content={<HorizontalTooltip />} cursor={{ fill: 'hsl(var(--muted))' }} />
                                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} maxBarSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Factores de fraude</CardTitle>
                        <CardDescription>Incidencia de cada factor en los casos registrados</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {fraudFactors.every((f) => f.count === 0) ? (
                            <p className="text-sm text-muted-foreground py-6 text-center">Sin datos de fraude</p>
                        ) : (
                            <div className="space-y-3 pt-1">
                                {fraudFactors.map((f) => (
                                    <div key={f.factor}>
                                        <div className="flex items-center justify-between text-sm mb-1">
                                            <span className="text-foreground">{f.factor}</span>
                                            <span className="text-muted-foreground tabular-nums">
                                                {f.count} <span className="text-xs">({f.pct}%)</span>
                                            </span>
                                        </div>
                                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-amber-500 transition-all duration-700"
                                                style={{ width: `${f.pct}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* ── Percent tooltip ─────────────────────────────────────────────── */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Percent className="h-3 w-3" />
                <span>Los porcentajes de factores de fraude se calculan sobre el total de casos con información bancaria registrada.</span>
            </div>
        </div>
    );
}
