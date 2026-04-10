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

interface RecurrenceSelectorProps {
  value: string | null;
  onChange: (rule: string | null) => void;
}

export function RecurrenceSelector({ value, onChange }: RecurrenceSelectorProps) {
  const parsed = value ? value.split(":") : null;
  const [interval, setInterval] = useState(parsed ? parsed[1] : "1");
  const [unit, setUnit] = useState(parsed ? parsed[2] : "week");
  const [enabled, setEnabled] = useState(!!value);

  const emit = (i: string, u: string, e: boolean) => {
    if (!e) {
      onChange(null);
      return;
    }
    const num = parseInt(i, 10);
    if (isNaN(num) || num <= 0) return;
    onChange(`every:${num}:${u}`);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            setEnabled(e.target.checked);
            emit(interval, unit, e.target.checked);
          }}
          className="rounded border-border"
        />
        <Label className="text-sm">Recorrente</Label>
      </div>

      {enabled && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">A cada</span>
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
          <Select
            value={unit}
            onValueChange={(v) => {
              setUnit(v);
              emit(interval, v, true);
            }}
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">dia(s)</SelectItem>
              <SelectItem value="week">semana(s)</SelectItem>
              <SelectItem value="month">mês(es)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
