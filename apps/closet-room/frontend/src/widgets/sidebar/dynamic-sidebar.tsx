'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { ChevronDown, ChevronRight, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DynamicIcon } from './dynamic-icon';
import { useMenuTree, type MenuTreeNode } from './use-menu-tree';

function MenuItem({ item, pathname, depth = 0 }: { item: MenuTreeNode; pathname: string; depth?: number }) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = item.children?.length > 0;
  const isActive = pathname === item.route || pathname.startsWith((item.route || '') + '/');

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className={cn(
            'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
            'hover:bg-accent',
          )}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          <DynamicIcon name={item.icon} />
          <span className="flex-1 text-left">{item.label}</span>
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
        {expanded && (
          <div>
            {item.children.map((child) => (
              <MenuItem key={child.id} item={child} pathname={pathname} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.route || '#'}
      className={cn(
        'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
        isActive ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-accent text-foreground',
      )}
      style={{ paddingLeft: `${12 + depth * 16}px` }}
    >
      <DynamicIcon name={item.icon} />
      <span>{item.label}</span>
    </Link>
  );
}

export function DynamicSidebar() {
  const pathname = usePathname();
  const { menus, loading } = useMenuTree();

  return (
    <aside className="flex h-screen w-60 flex-col border-r bg-card">
      {/* Header */}
      <div className="flex h-14 items-center border-b px-4">
        <span className="text-lg font-bold">closet-room</span>
      </div>

      {/* Menu */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {loading ? (
          <div className="space-y-2 p-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 rounded bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          menus.map((item) => <MenuItem key={item.id} item={item} pathname={pathname} />)
        )}
      </nav>

      {/* Footer */}
      <div className="border-t p-2">
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span>로그아웃</span>
        </button>
      </div>
    </aside>
  );
}
