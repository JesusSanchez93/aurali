import { Languages } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/routing';
import { useParams } from 'next/navigation';
import { ES, GB } from 'country-flag-icons/react/3x2';

import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function LanguageSwitcher() {
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();
    const params = useParams();

    function onLocaleChange(nextLocale: string) {
        router.replace(
            // @ts-expect-error -- TypeScript doesn't know that the params match the pathname
            { pathname, params },
            { locale: nextLocale }
        );
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 px-3 h-9">
                    <span className="font-medium uppercase text-xs">{locale}</span>
                    <div className="w-5 h-5 overflow-hidden rounded-full shadow-sm border border-muted">
                        <div className="w-full h-full scale-[1.5] flex items-center justify-center">
                            {locale === 'es' ? <ES /> : <GB />}
                        </div>
                    </div>
                    <Languages className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem
                    onClick={() => onLocaleChange('es')}
                    disabled={locale === 'es'}
                    className={`gap-3 py-2 cursor-pointer ${locale === 'es' ? 'font-bold bg-muted' : ''}`}
                >
                    <div className="w-5 h-5 overflow-hidden rounded-full shadow-sm border border-muted">
                        <div className="w-full h-full scale-[1.5] flex items-center justify-center">
                            <ES />
                        </div>
                    </div>
                    <span className="text-sm">Español (ES)</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => onLocaleChange('en')}
                    disabled={locale === 'en'}
                    className={`gap-3 py-2 cursor-pointer ${locale === 'en' ? 'font-bold bg-muted' : ''}`}
                >
                    <div className="w-5 h-5 overflow-hidden rounded-full shadow-sm border border-muted">
                        <div className="w-full h-full scale-[1.5] flex items-center justify-center">
                            <GB />
                        </div>
                    </div>
                    <span className="text-sm">English (EN)</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
