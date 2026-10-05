"use client";

import { useEffect, useState } from "react";
import { Settings, AlertCircle, CheckCircle2, Loader2, Save } from "lucide-react";

interface SystemSetting {
  id: string;
  key: string;
  value: string;
  description: string;
  category: string;
  dataType: string;
}

interface SettingsState {
  [key: string]: string;
}

const CATEGORY_LABELS: Record<string, { label: string; description: string }> = {
  school: {
    label: "School Information",
    description: "Configure school details and contact information",
  },
  academic: {
    label: "Academic Settings",
    description: "Set academic year, quarters, and capacity limits",
  },
  grading: {
    label: "Grading Scale",
    description: "Define grade thresholds for performance levels",
  },
  notifications: {
    label: "Notifications",
    description: "Configure email and SMS notification preferences",
  },
  system: {
    label: "System Settings",
    description: "Manage maintenance mode and backup frequency",
  },
};

function formatSettingLabel(key: string) {
  const normalized = key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

  const overrides: Record<string, string> = {
    "Academic Year Mode": "Academic Year Mode",
    "Manual Academic Year": "Manual Academic Year",
  };

  return overrides[normalized] || normalized;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [grouped, setGrouped] = useState<Record<string, SystemSetting[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [edited, setEdited] = useState<SettingsState>({});
  const [changes, setChanges] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [activeCategory, setActiveCategory] = useState("school");

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/settings");
        const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Failed to load settings");
        setSettings(data.settings);
        setGrouped(data.grouped);
        const initialEdited: SettingsState = {};
        data.settings.forEach((s: SystemSetting) => {
          initialEdited[s.key] = s.value;
        });
        setEdited(initialEdited);
      } catch (err) {
        setMessage({ type: "error", text: "Failed to load settings" });
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleChange = (key: string, value: string) => {
    setEdited((prev) => ({ ...prev, [key]: value }));
    const newChanges = new Set(changes);
    newChanges.add(key);
    setChanges(newChanges);
  };

  const handleSave = async (key: string) => {
    try {
      setSaving(true);
      setMessage(null);
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: edited[key] }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save setting");
      }

      if (data.activeAcademicYear) {
        setEdited((prev) => ({ ...prev, academic_year: data.activeAcademicYear }));
      }

      const newChanges = new Set(changes);
      newChanges.delete(key);
      setChanges(newChanges);
      setMessage({ type: "success", text: `${key} updated successfully` });

      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to save setting" });
    } finally {
      setSaving(false);
    }
  };

  const categories = Object.keys(grouped);
  const currentSettings = grouped[activeCategory] || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">System Settings</h1>
          <p className="mt-1 text-sm text-slate-500">Configure school and system parameters</p>
        </div>
        <Settings className="h-8 w-8 text-blue-600" />
      </div>

      {message && (
        <div
          className={`flex items-center gap-2 rounded-lg p-4 text-sm ${
            message.type === "success"
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0" />
          )}
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Category Sidebar */}
        <div className="space-y-2">
          {categories.map((category) => {
            const catConfig = CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS];
            return (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`w-full rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors ${
                  activeCategory === category
                    ? "bg-blue-100 text-blue-900"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {catConfig?.label || category}
              </button>
            );
          })}
        </div>

        {/* Settings Panel */}
        <div className="lg:col-span-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-lg border border-slate-200 bg-white p-6">
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-slate-900">
                    {CATEGORY_LABELS[activeCategory as keyof typeof CATEGORY_LABELS]?.label}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {CATEGORY_LABELS[activeCategory as keyof typeof CATEGORY_LABELS]?.description}
                  </p>
                </div>

                <div className="space-y-6">
                  {currentSettings.map((setting) => (
                    <div key={setting.key} className="border-b border-slate-100 pb-6 last:border-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-slate-900">
                            {formatSettingLabel(setting.key)}
                          </label>
                          <p className="mt-1 text-sm text-slate-600">{setting.description}</p>
                        </div>
                      </div>

                      <div className="mt-3 flex gap-2">
                        {setting.key === "academic_year_mode" ? (
                          <select
                            value={edited[setting.key] || "automatic"}
                            onChange={(e) => handleChange(setting.key, e.target.value)}
                            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="automatic">Automatic</option>
                            <option value="manual">Manual</option>
                          </select>
                        ) : setting.dataType === "boolean" ? (
                          <select
                            value={edited[setting.key] || "false"}
                            onChange={(e) => handleChange(setting.key, e.target.value)}
                            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="true">Enabled</option>
                            <option value="false">Disabled</option>
                          </select>
                        ) : setting.key === "academic_year" ? (
                          <input
                            type="text"
                            value={edited[setting.key] || ""}
                            readOnly
                            className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                          />
                        ) : (
                          <input
                            type={setting.dataType === "number" ? "number" : "text"}
                            value={edited[setting.key] || ""}
                            onChange={(e) => handleChange(setting.key, e.target.value)}
                            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            placeholder={setting.key === "manual_academic_year" ? "2026-2027" : undefined}
                          />
                        )}

                        {changes.has(setting.key) && (
                          <button
                            onClick={() => handleSave(setting.key)}
                            disabled={saving}
                            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                          >
                            {saving ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4" />
                            )}
                            Save
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
