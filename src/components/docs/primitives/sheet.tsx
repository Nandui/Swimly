'use client';
import { SheetContent as Content } from '@/components/shadcn/sheet';
export * from '@/components/shadcn/sheet';
export function SheetContent(props: React.ComponentProps<typeof Content>) { return <Content {...props} portalClassName="turnfin-docs" />; }
