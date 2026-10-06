'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { FilePlus2, ReceiptText, Truck } from 'lucide-react';
import { ModuleShell } from '@/components/workspace/module-shell';
import type { PurchasingActor } from '@/lib/purchasing/access';

/** Purchasing's pages in the shared workspace frame. */
export function PurchasingShell({ who, children }: { who: PurchasingActor; children: ReactNode }) {
  const pathname = usePathname();
  const links = [
    { href: '/purchasing', label: 'Orders', icon: ReceiptText, active: pathname === '/purchasing' || /^\/purchasing\/(?!new|suppliers)/.test(pathname) },
    ...(who.request ? [{ href: '/purchasing/new', label: 'New order', icon: FilePlus2, active: pathname.startsWith('/purchasing/new') }] : []),
    { href: '/purchasing/suppliers', label: 'Suppliers', icon: Truck, active: pathname.startsWith('/purchasing/suppliers') },
  ];
  return (
    <ModuleShell module="Purchasing" id="purchasing" who={who} links={links} scopeNote="Only the sites you cover">
      {children}
    </ModuleShell>
  );
}
