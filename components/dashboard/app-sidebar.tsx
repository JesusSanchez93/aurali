'use client';

import {
  Home, Scale, Settings, Users, ShieldCheck, BookOpen,
  Sparkles, Building2, FileText, ChevronRight, Workflow, IdCard,
} from 'lucide-react';
import { Logo } from '@/components/common/logo';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { useState } from 'react';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Collapsible,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Link } from '@/i18n/routing';
import { usePathname as useNextPathname } from 'next/navigation';
import { NavUser } from './nav-user';
import { useTranslations } from 'next-intl';
import { useProfile } from '@/components/providers/profile-provider';

type NavItem = {
  titleKey: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  sub?: { titleKey: string; url: string; icon: React.ComponentType<{ className?: string }> }[];
};

const SETTINGS_SUB = [
  { titleKey: 'workflows',   url: '/settings/workflows',    icon: Workflow  },
  { titleKey: 'formats',     url: '/settings/document-templates', icon: FileText  },
  { titleKey: 'ai_variables',url: '/settings/ai-variables', icon: Sparkles  },
  { titleKey: 'banks',           url: '/settings/banks',        icon: Building2 },
  { titleKey: 'document_types', url: '/settings/documents',    icon: IdCard    },
];

export const userItems: NavItem[] = [
  { titleKey: 'analytics', url: '/analytics',     icon: Home  },
  { titleKey: 'processes', url: '/legal-process', icon: Scale },
  { titleKey: 'clients',   url: '/clients',       icon: Users },
  { titleKey: 'settings',  url: '/settings',      icon: Settings, sub: SETTINGS_SUB },
];

export const adminUserItems: NavItem[] = [
  { titleKey: 'analytics', url: '/analytics',     icon: Home  },
  { titleKey: 'processes', url: '/legal-process', icon: Scale },
  { titleKey: 'clients',   url: '/clients',       icon: Users },
  { titleKey: 'users',     url: '/settings/users',icon: Users },
  { titleKey: 'settings',  url: '/settings',      icon: Settings, sub: SETTINGS_SUB },
];

export const adminItems: NavItem[] = [
  { titleKey: 'analytics',     url: '/analytics',       icon: Home       },
  { titleKey: 'admin_clients', url: '/admin/clients',   icon: Users      },
  { titleKey: 'workflows',     url: '/admin/workflows', icon: ShieldCheck},
  { titleKey: 'catalog',       url: '/admin/catalog',   icon: BookOpen   },
];

// ── Variants ──────────────────────────────────────────────────────────────────

const menuVariants: Variants = {
  hidden: { height: 0, opacity: 0 },
  visible: {
    height: 'auto',
    opacity: 1,
    transition: {
      height: { duration: 0.22, ease: [0.4, 0, 0.2, 1] },
      opacity: { duration: 0.18, ease: 'easeOut' },
      when: 'beforeChildren',
      staggerChildren: 0.045,
    },
  },
  exit: {
    height: 0,
    opacity: 0,
    transition: {
      height: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
      opacity: { duration: 0.12, ease: 'easeIn' },
      when: 'afterChildren',
      staggerChildren: 0.03,
      staggerDirection: -1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: -10 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 28 } },
  exit:    { opacity: 0, y: -6, transition: { duration: 0.1 } },
};

const navContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
};

const navItemVariants: Variants = {
  hidden: { opacity: 0, x: -12 },
  visible: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 300, damping: 26 } },
};

// ── Collapsible nav item ───────────────────────────────────────────────────────

type CollapsibleItemProps = {
  item: NavItem;
  pathname: string;
  t: (key: string) => string;
  isMobile: boolean;
  setOpenMobile: (open: boolean) => void;
};

function NavCollapsibleItem({ item, pathname, t, isMobile, setOpenMobile }: CollapsibleItemProps) {
  const isParentActive = item.sub!.some(
    (s) => pathname === s.url || pathname.startsWith(s.url + '/'),
  );
  const [open, setOpen] = useState(isParentActive);

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton isActive={isParentActive} size={isMobile ? 'lg' : 'default'}>
            <item.icon />
            <span>{t(item.titleKey)}</span>
            <motion.span
              className="ml-auto"
              animate={{ rotate: open ? 90 : 0 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            >
              <ChevronRight className="h-4 w-4" />
            </motion.span>
          </SidebarMenuButton>
        </CollapsibleTrigger>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              variants={menuVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              style={{ overflow: 'hidden' }}
            >
              <SidebarMenuSub>
                {item.sub!.map((sub) => {
                  const isSubActive = pathname === sub.url || pathname.startsWith(sub.url + '/');
                  return (
                    <motion.div key={sub.titleKey} variants={itemVariants}>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          asChild
                          isActive={isSubActive}
                          size={isMobile ? 'md' : 'sm'}
                        >
                          <Link
                            href={sub.url}
                            onClick={() => isMobile && setOpenMobile(false)}
                          >
                            <sub.icon className="h-3.5 w-3.5" />
                            <span>{t(sub.titleKey)}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </motion.div>
                  );
                })}
              </SidebarMenuSub>
            </motion.div>
          )}
        </AnimatePresence>
      </SidebarMenuItem>
    </Collapsible>
  );
}

// ── AppSidebar ─────────────────────────────────────────────────────────────────

export function AppSidebar() {
  // next/navigation returns the full path including locale prefix (e.g. /es/settings)
  // Strip it so URL comparisons match the item.url values (e.g. /settings)
  const rawPathname = useNextPathname();
  const pathname = rawPathname.replace(/^\/(es|en)(\/|$)/, '/').replace(/\/$/, '') || '/';
  const t = useTranslations('common.nav');
  const profile = useProfile();
  const { setOpenMobile, isMobile } = useSidebar();

  const isSuperAdmin = profile?.system_role === 'SUPERADMIN';
  const isImpersonating = isSuperAdmin && !!profile?.current_organization_id;
  const isOrgAdmin = profile?.org_role === 'ORG_ADMIN';
  const items = isSuperAdmin && !isImpersonating
    ? adminItems
    : isOrgAdmin
      ? adminUserItems
      : userItems;

  return (
    <Sidebar variant="inset">
      <SidebarHeader className="px-4 py-3">
        <Logo size={22} />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <motion.div
                variants={navContainerVariants}
                initial="hidden"
                animate="visible"
              >
                {items.map((item) => {
                  if (item.sub) {
                    return (
                      <motion.div key={item.titleKey} variants={navItemVariants}>
                        <NavCollapsibleItem
                          item={item}
                          pathname={pathname}
                          t={t}
                          isMobile={isMobile}
                          setOpenMobile={setOpenMobile}
                        />
                      </motion.div>
                    );
                  }

                  const isActive =
                    pathname === item.url || pathname.startsWith(item.url + '/');
                  return (
                    <motion.div key={item.titleKey} variants={navItemVariants}>
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          size={isMobile ? 'lg' : 'default'}
                        >
                          <Link
                            href={item.url}
                            onClick={() => isMobile && setOpenMobile(false)}
                          >
                            <item.icon />
                            <span>{t(item.titleKey)}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </motion.div>
                  );
                })}
              </motion.div>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
