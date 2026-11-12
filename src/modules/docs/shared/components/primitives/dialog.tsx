'use client';
import { DialogContent as Content } from '@/components/shadcn/dialog';
export * from '@/components/shadcn/dialog';
export function DialogContent(props: React.ComponentProps<typeof Content>) { return <Content {...props} portalClassName="turnfin-docs" />; }
