"use client";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useId, useState, type ComponentProps } from "react";
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="form-field">
      <label>{label}</label>
      {children}
      {hint && <p className="caption">{hint}</p>}
    </div>
  );
}
export function Choice({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <Field label={label}>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
export function Check({
  label,
  checked,
  onChange,
  hint,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="check-row">
      <Checkbox
        aria-label={label}
        id={id}
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        disabled={disabled}
      />
      <label htmlFor={id}>
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </label>
    </div>
  );
}
export function Toggle({
  label,
  checked,
  onChange,
  hint,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="toggle-row">
      <label htmlFor={id}>
        {label}
        {hint && <small>{hint}</small>}
      </label>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}
export function NumberField({
  label,
  value,
  onChange,
  unit,
  min = 0,
  max = 1000000,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  unit: string;
  min?: number;
  max?: number;
}) {
  return (
    <Field label={label}>
      <div className="unit-input">
        <input
          aria-label={label}
          type="number"
          min={min}
          max={max}
          value={value ?? ""}
          placeholder="아직 설정 안 됨"
          onChange={(e) =>
            onChange(e.target.value === "" ? null : Number(e.target.value))
          }
        />
        <span>{unit}</span>
      </div>
    </Field>
  );
}
export const splitList = (s: string) =>
  s
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
export const money = (n: number | null, currency = "KRW") =>
  n === null
    ? "가격 확인 필요"
    : new Intl.NumberFormat("ko-KR", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(n);

export function ListInput({
  label,
  values,
  onChange,
  hint,
  disabled = false,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  hint?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState(values.join(", "));
  return (
    <Field label={label} hint={hint}>
      <input
        aria-label={label}
        disabled={disabled}
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(splitList(e.target.value));
        }}
      />
    </Field>
  );
}

/** The vendored slider places aria props on its root; name the interactive thumbs too. */
export function NamedSlider({
  label,
  ...props
}: ComponentProps<typeof Slider> & { label: string }) {
  return (
    <Slider
      {...props}
      aria-label={label}
      ref={(node) => {
        node
          ?.querySelectorAll("[role=slider]")
          .forEach((thumb) => thumb.setAttribute("aria-label", label));
      }}
    />
  );
}
