"use client";

import type { ToolDef, ToolSetting } from "@/lib/catalog";

export function defaultOptionValues(tool: ToolDef): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const s of tool.settings ?? []) out[s.key] = s.defaultValue;
  return out;
}

function Control({
  setting,
  value,
  disabled,
  onChange,
}: {
  setting: ToolSetting;
  value: string | number;
  disabled: boolean;
  onChange: (key: string, value: string | number) => void;
}) {
  const hintId = `${setting.key}-hint`;
  const common = {
    id: setting.key,
    name: setting.key,
    disabled,
    "aria-describedby": setting.hint ? hintId : undefined,
    className:
      "h-10 w-full rounded-control border border-border bg-card px-3 text-sm text-foreground transition-colors focus:border-accent/70 focus:outline-none disabled:opacity-60",
  };

  return (
    <div>
      <label htmlFor={setting.key} className="mb-1.5 block text-sm font-medium text-foreground">
        {setting.label}
      </label>
      {setting.type === "select" ? (
        <select
          {...common}
          value={String(value)}
          onChange={(e) => onChange(setting.key, e.target.value)}
        >
          {(setting.options ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : setting.type === "number" ? (
        <input
          {...common}
          type="number"
          inputMode="numeric"
          min={setting.min}
          max={setting.max}
          step={setting.step ?? 1}
          value={String(value)}
          onChange={(e) => onChange(setting.key, e.target.value === "" ? "" : Number(e.target.value))}
        />
      ) : (
        <input
          {...common}
          type="text"
          value={String(value)}
          placeholder={setting.hint?.includes("e.g.") ? undefined : undefined}
          onChange={(e) => onChange(setting.key, e.target.value)}
        />
      )}
      {setting.hint ? (
        <p id={hintId} className="mt-1.5 text-xs leading-relaxed text-faint">
          {setting.hint}
        </p>
      ) : null}
    </div>
  );
}

export function SettingsForm({
  tool,
  values,
  disabled,
  onChange,
}: {
  tool: ToolDef;
  values: Record<string, string | number>;
  disabled: boolean;
  onChange: (key: string, value: string | number) => void;
}) {
  if (!tool.settings || tool.settings.length === 0) {
    return (
      <p className="text-sm text-muted">
        This conversion uses carefully chosen defaults — no setup needed.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      {tool.settings.map((setting) => (
        <Control
          key={setting.key}
          setting={setting}
          value={values[setting.key] ?? setting.defaultValue}
          disabled={disabled}
          onChange={onChange}
        />
      ))}
    </div>
  );
}
