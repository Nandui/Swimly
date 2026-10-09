'use client';
import { AlertDialogContent as Content } from '@/components/shadcn/alert-dialog';
export * from '@/components/shadcn/alert-dialog';
export function AlertDialogContent(props: React.ComponentProps<typeof Content>) { return <Content {...props} portalClassName="turnfin-docs" />; }
