"use client";

import { useEffect, useState } from "react";
import { Search, Package, Plus, X, Loader2, Archive, MapPin, Warehouse, Pencil } from "lucide-react";
import { useSession } from "next-auth/react";
import { hasPermission } from "@/lib/permissions";
import { useToast } from "@/components/ui/toast";

interface InventoryItem {
  id: string;
  title: string;
  description: string | null;
  itemCode: string;
  quantity: number;
  unit: string;
  location: string;
  condition: string;
  supplier: string;
  assignedTo: string;
  serialNumber: string;
  purchaseDate: string | null;
  status: string;
  createdAt: string;
  uploadedBy: { name: string } | null;
}

interface InventoryForm {
  title: string;
  itemCode: string;
  quantity: number;
  unit: string;
  location: string;
  condition: string;
  supplier: string;
  assignedTo: string;
  serialNumber: string;
  purchaseDate: string;
  description: string;
}

const emptyForm: InventoryForm = {
  title: "",
  itemCode: "",
  quantity: 1,
  unit: "pcs",
  location: "Main Office",
  condition: "GOOD",
  supplier: "",
  assignedTo: "",
  serialNumber: "",
  purchaseDate: "",
  description: "",
};

const conditionColors: Record<string, string> = {
  NEW: "bg-emerald-100 text-emerald-700",
  GOOD: "bg-blue-100 text-blue-700",
  FAIR: "bg-amber-100 text-amber-700",
  POOR: "bg-red-100 text-red-700",
};

const statusColors: Record<string, string> = {
  APPROVED: "bg-green-100 text-green-700",
  PENDING_REVIEW: "bg-amber-100 text-amber-700",
  ARCHIVED: "bg-slate-100 text-slate-700",
  REJECTED: "bg-red-100 text-red-700",
};

export default function InventoryPage() {
  const { data: session } = useSession();
  const { showToast } = useToast();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [form, setForm] = useState<InventoryForm>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const canManage = session?.user?.role ? hasPermission(session.user.role, "inventory:manage") : false;

  const loadInventory = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/inventory");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load inventory");
      setItems(data.data || []);
    } catch (error: any) {
      showToast("error", error.message || "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, []);

  const filteredItems = items.filter((item) => {
    const haystack = `${item.title} ${item.itemCode} ${item.location} ${item.assignedTo} ${item.supplier}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.title.trim()) nextErrors.title = "Item name is required";
    if (!form.location.trim()) nextErrors.location = "Location is required";
    if (form.quantity < 0) nextErrors.quantity = "Quantity must not be negative";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) {
      showToast("error", "Please fix the form errors");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/inventory", {
        method: editingItemId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingItemId ? { id: editingItemId, ...form } : form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save inventory item");
      showToast("success", editingItemId ? "Inventory item updated" : "Inventory item saved successfully");
      setShowModal(false);
      setEditingItemId(null);
      setForm(emptyForm);
      await loadInventory();
    } catch (error: any) {
      showToast("error", error.message || "Failed to save inventory item");
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (id: string) => {
    try {
      const res = await fetch(`/api/inventory?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to archive item");
      showToast("success", "Inventory item archived");
      await loadInventory();
    } catch (error: any) {
      showToast("error", error.message || "Failed to archive item");
    }
  };

  const inputCls = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";
  const errCls = "mt-1 text-xs text-red-600";

  const startEditingItem = (item: InventoryItem) => {
    setForm({
      title: item.title,
      itemCode: item.itemCode,
      quantity: item.quantity,
      unit: item.unit,
      location: item.location,
      condition: item.condition,
      supplier: item.supplier,
      assignedTo: item.assignedTo,
      serialNumber: item.serialNumber,
      purchaseDate: item.purchaseDate?.slice(0, 10) || "",
      description: item.description || "",
    });
    setErrors({});
    setEditingItemId(item.id);
    setShowModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventory</h1>
          <p className="mt-1 text-sm text-slate-500">Track school property, supplies, and assigned equipment</p>
        </div>
        {canManage && (
          <button onClick={() => { setEditingItemId(null); setForm(emptyForm); setShowModal(true); }} className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800">
            <Plus className="h-4 w-4" /> Add Item
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by item, code, or location..."
          className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:max-w-sm"
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Package className="h-4 w-4 text-blue-600" /> Inventory Items
          </div>
          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">{filteredItems.length} items</span>
        </div>

        {loading ? (
          <div className="space-y-3 p-6">
            {[...Array(5)].map((_, index) => (
              <div key={index} className="h-12 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Warehouse className="h-10 w-10 text-slate-300" />
            <p className="mt-3 text-base font-medium text-slate-700">No inventory items found</p>
            <p className="mt-1 text-sm text-slate-500">Add a new school property or supply to begin tracking it.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Qty</th>
                  <th className="px-4 py-3 font-medium">Location</th>
                  <th className="px-4 py-3 font-medium">Condition</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Assigned To</th>
                  {canManage && <th className="px-4 py-3 font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{item.title}</div>
                      {item.description && <div className="text-xs text-slate-500">{item.description}</div>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{item.itemCode || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{item.quantity} {item.unit}</td>
                    <td className="px-4 py-3 text-slate-600">
                      <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {item.location}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${conditionColors[item.condition] || "bg-slate-100 text-slate-700"}`}>
                        {item.condition}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[item.status] || "bg-slate-100 text-slate-700"}`}>
                        {item.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{item.assignedTo || "—"}</td>
                    {canManage && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <button type="button" onClick={() => startEditingItem(item)} className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900">
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </button>
                          <button type="button" onClick={() => handleArchive(item.id)} className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100">
                            <Archive className="h-3.5 w-3.5" /> Archive
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900">{editingItemId ? "Edit Inventory Item" : "Add Inventory Item"}</h2>
              <button onClick={() => setShowModal(false)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="max-h-[75vh] space-y-4 overflow-y-auto p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">Item Name *</label>
                  <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} />
                  {errors.title && <p className={errCls}>{errors.title}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Item Code</label>
                  <input type="text" value={form.itemCode} onChange={(e) => setForm({ ...form, itemCode: e.target.value })} placeholder="INV-001" className={inputCls} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Serial Number</label>
                  <input type="text" value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} placeholder="Optional" className={inputCls} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Quantity *</label>
                  <input type="number" min={0} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) || 0 })} className={inputCls} />
                  {errors.quantity && <p className={errCls}>{errors.quantity}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Unit</label>
                  <input type="text" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="pcs, box, set" className={inputCls} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Location *</label>
                  <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Main Office" className={inputCls} />
                  {errors.location && <p className={errCls}>{errors.location}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Condition</label>
                  <select value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })} className={inputCls}>
                    {Object.keys(conditionColors).map((condition) => (
                      <option key={condition} value={condition}>{condition}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Supplier</label>
                  <input type="text" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder="Supplier name" className={inputCls} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Assigned To</label>
                  <input type="text" value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} placeholder="Person or office" className={inputCls} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Purchase Date</label>
                  <input type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} className={inputCls} />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
                  <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} placeholder="Notes about the item, warranty, or usage" />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
                  {saving ? "Saving..." : editingItemId ? "Save Changes" : "Save Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
