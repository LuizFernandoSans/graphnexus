import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toggle } from "@/components/ui/toggle";

const DAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];

interface RecurrenceSelectorProps {
  value: string | null;
  onChange: (rule: string | null) => void;
  recurrenceDays?: number[] | null;
  onRecurrenceDaysChange?: (days: number[] | null) => void;
}

export function RecurrenceSelector({ value, onChange, recurrenceDays, onRecurrenceDaysChange }: RecurrenceSelectorProps) {
  const parsed = value ? value.split(":") : null;
  const [interval, setInterval] = useState(parsed ? parsed[1] : "1");
  const [unit, setUnit] = useState(parsed ? parsed[2] : "week");
  const [enabled, setEnabled] = useState(!!value);
  const [selectedDays, setSelectedDays] = useState<number[]>(recurrenceDays || []);

  const emit = (i: string, u: string, e: boolean) => {
    if (!e) {
      onChange(null);
      onRecurrenceDaysChange?.(null);
      return;
    }
    if (u === "custom_days") {
      onChange("every:1:custom_days");
      return;
    }
    const num = parseInt(i, 10);
    if (isNaN(num) || num <= 0) return;
    onChange(`every:${num}:${u}`);
    onRecurrenceDaysChange?.(null);
  };

  const toggleDay = (day: number) => {
    const next = selectedDays.includes(day)
      ? selectedDays.filter((d) => d !== day)
      : [...selectedDays, day].sort();
    setSelectedDays(next);
    onRecurrenceDaysChange?.(next.length > 0 ? next : null);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            setEnabled(e.target.checked);
            if (!e.target.checked) {
              setSelectedDays([]);
            }
            emit(interval, unit, e.target.checked);
          }}
          className="rounded border-border"
        />
        <Label className="text-sm">Recorrente</Label>
      </div>

      {enabled && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">A cada</span>
            {unit !== "custom_days" && (
              <Input
                type="number"
                min={1}
                value={interval}
                onChange={(e) => {
                  setInterval(e.target.value);
                  emit(e.target.value, unit, true);
                }}
                className="w-16"
              />
            )}
            <Select
              value={unit}
              onValueChange={(v) => {
                setUnit(v);
                emit(interval, v, true);
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">dia(s)</SelectItem>
                <SelectItem value="week">semana(s)</SelectItem>
                <SelectItem value="month">mês(es)</SelectItem>
                <SelectItem value="custom_days">Dias Específicos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {unit === "custom_days" && (
            <div className="flex gap-1">
              {DAY_LABELS.map((label, idx) => (
                <Toggle
                  key={idx}
                  pressed={selectedDays.includes(idx)}
                  onPressedChange={() => toggleDay(idx)}
                  className="h-9 w-9 rounded-full text-xs font-medium p-0"
                  aria-label={label}
                >
                  {label}
                </Toggle>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
