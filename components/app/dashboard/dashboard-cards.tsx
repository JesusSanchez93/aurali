'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, FileText, CheckCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface DashboardCardsProps {
    totalClients: number;
    totalProcesses: number;
    completedProcesses: number;
}

export default function DashboardCards({ totalClients, totalProcesses, completedProcesses }: DashboardCardsProps) {
    const t = useTranslations('dashboard.stats');

    return (
        <div className="grid gap-4 md:grid-cols-3">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                        {t('total_clients')}
                    </CardTitle>
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950">
                        <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold tracking-tight">{totalClients}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                        {t('total_clients_desc')}
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                        {t('total_processes')}
                    </CardTitle>
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-950">
                        <FileText className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold tracking-tight">{totalProcesses}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                        {t('total_processes_desc')}
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                        {t('completed_processes')}
                    </CardTitle>
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950">
                        <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold tracking-tight">{completedProcesses}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                        {t('completed_processes_desc')}
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
