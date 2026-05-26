'use client';

import { useState, useEffect } from 'react';

export interface MenuTreeNode {
  id: string;
  menuKey: string;
  label: string;
  icon?: string;
  route?: string;
  displayOrder: number;
  isActive: boolean;
  children: MenuTreeNode[];
}

const FALLBACK_MENUS: MenuTreeNode[] = [
  { id: '1', menuKey: 'admin-users', label: 'Users', icon: 'Users', route: '/admin/users', displayOrder: 1, isActive: true, children: [] },
  { id: '2', menuKey: 'admin-roles', label: 'Roles', icon: 'Shield', route: '/admin/roles', displayOrder: 2, isActive: true, children: [] },
  { id: '3', menuKey: 'admin-menus', label: 'Menus', icon: 'Menu', route: '/admin/menus', displayOrder: 3, isActive: true, children: [] },
];

export function useMenuTree() {
  const [menus, setMenus] = useState<MenuTreeNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    fetch('/api/v1/menus/tree', { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => setMenus(Array.isArray(data) ? data : FALLBACK_MENUS))
      .catch(() => setMenus(FALLBACK_MENUS))
      .finally(() => {
        clearTimeout(timeout);
        setLoading(false);
      });

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, []);

  return { menus, loading };
}
