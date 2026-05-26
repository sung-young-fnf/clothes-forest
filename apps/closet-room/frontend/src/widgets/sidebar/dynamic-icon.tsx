'use client';

import * as LucideIcons from 'lucide-react';
import { cn } from '@/lib/utils';

type IconComponent = React.ComponentType<{ className?: string }>;

interface DynamicIconProps {
  name?: string;
  className?: string;
}

export function DynamicIcon({ name, className }: DynamicIconProps) {
  if (!name) return null;
  const iconMap = LucideIcons as unknown as Record<string, IconComponent>;
  const Icon = iconMap[name] || LucideIcons.Circle;
  return <Icon className={cn('h-4 w-4 shrink-0', className)} />;
}
