'use client';

import { useEffect, useState } from 'react';
import { Plus, GripVertical, Pencil, Trash2 } from 'lucide-react';
import { DynamicIcon } from '@/widgets/sidebar';

interface Menu {
  id: string;
  menuKey: string;
  label: string;
  icon?: string;
  route?: string;
  isActive: boolean;
  displayOrder: number;
  children: Menu[];
  permissions?: { role: { id: string; name: string } }[];
}

export default function MenusPage() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null);

  const fetchMenus = () => {
    fetch('/api/v1/menus/all')
      .then((r) => r.json())
      .then((d) => setMenus(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchMenus(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('이 메뉴를 삭제하시겠습니까?')) return;
    await fetch(`/api/v1/menus/${id}`, { method: 'DELETE' });
    fetchMenus();
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData);

    const method = editingMenu ? 'PATCH' : 'POST';
    const url = editingMenu ? `/api/v1/menus/${editingMenu.id}` : '/api/v1/menus';

    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    setShowForm(false);
    setEditingMenu(null);
    fetchMenus();
  };

  function MenuRow({ menu, depth = 0 }: { menu: Menu; depth?: number }) {
    return (
      <>
        <tr className="border-b hover:bg-muted/30">
          <td className="px-4 py-3" style={{ paddingLeft: `${16 + depth * 24}px` }}>
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
              <DynamicIcon name={menu.icon} className="text-muted-foreground" />
              <span className="font-medium">{menu.label}</span>
              <span className="text-xs text-muted-foreground">({menu.menuKey})</span>
            </div>
          </td>
          <td className="px-4 py-3 text-sm text-muted-foreground">{menu.route || '-'}</td>
          <td className="px-4 py-3">
            <span className={`rounded-full px-2 py-0.5 text-xs ${menu.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {menu.isActive ? 'Active' : 'Inactive'}
            </span>
          </td>
          <td className="px-4 py-3">
            <div className="flex gap-1">
              {menu.permissions?.map((p) => (
                <span key={p.role.id} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                  {p.role.name}
                </span>
              ))}
            </div>
          </td>
          <td className="px-4 py-3">
            <div className="flex gap-1">
              <button onClick={() => { setEditingMenu(menu); setShowForm(true); }} className="rounded p-1 hover:bg-accent">
                <Pencil className="h-4 w-4" />
              </button>
              <button onClick={() => handleDelete(menu.id)} className="rounded p-1 hover:bg-destructive/10 text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </td>
        </tr>
        {menu.children?.map((child) => (
          <MenuRow key={child.id} menu={child} depth={depth + 1} />
        ))}
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Menus</h1>
        <button
          onClick={() => { setEditingMenu(null); setShowForm(true); }}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Add Menu
        </button>
      </div>

      {/* Form Dialog */}
      {showForm && (
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">{editingMenu ? 'Edit Menu' : 'New Menu'}</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Menu Key</label>
              <input name="menuKey" defaultValue={editingMenu?.menuKey} required className="w-full rounded border px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Label</label>
              <input name="label" defaultValue={editingMenu?.label} required className="w-full rounded border px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Icon (Lucide name)</label>
              <input name="icon" defaultValue={editingMenu?.icon} className="w-full rounded border px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Route</label>
              <input name="route" defaultValue={editingMenu?.route} className="w-full rounded border px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2 flex gap-2 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="rounded border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
              <button type="submit" className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">Save</button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left text-sm font-medium">Menu</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Route</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Permissions</th>
              <th className="px-4 py-3 text-left text-sm font-medium w-20">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
            ) : menus.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No menus. Click "Add Menu" to create.</td></tr>
            ) : (
              menus.map((menu) => <MenuRow key={menu.id} menu={menu} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
