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
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                        {t('total_clients')}
                    </CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{totalClients}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                        {t('total_clients_desc')}
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                        {t('total_processes')}
                    </CardTitle>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{totalProcesses}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                        {t('total_processes_desc')}
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                        {t('completed_processes')}
                    </CardTitle>
                    <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{completedProcesses}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                        {t('completed_processes_desc')}
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
