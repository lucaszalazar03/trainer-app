"use client";

import { useState } from "react";

export function RangeField({
  name,
  label,
  defaultValue,
  lo,
  hi,
}: {
  name: string;
  label: string;
  defaultValue: number;
  lo: string;
  hi: string;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <span className="field-label" style={{ marginBottom: 0 }}>
          {label}
        </span>
      </div>
      <div className="slider-row">
        <input type="range" name={name} min={1} max={5} value={value} onChange={(e) => setValue(Number(e.target.value))} />
        <span className="slider-val num">{value}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}>
        <span>{lo}</span>
        <span>{hi}</span>
      </div>
    </div>
  );
}
