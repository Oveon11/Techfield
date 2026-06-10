import { Input } from "@/components/ui/input";
import { MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Suggestion = { place_id: string; display_name: string };

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}

export function AddressAutocomplete({ value, onChange, placeholder = "12 rue de la Paix, 75001 Paris", className }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    clearTimeout(timer.current);
    if (value.length < 4) { setSuggestions([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value)}&limit=5&countrycodes=fr&accept-language=fr`,
          { headers: { "Accept-Language": "fr" } }
        );
        const data: Suggestion[] = await res.json();
        setSuggestions(data);
        setOpen(data.length > 0);
      } catch {
        setSuggestions([]);
      }
    }, 400);
    return () => clearTimeout(timer.current);
  }, [value]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const pick = (s: Suggestion) => {
    onChange(s.display_name);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={`pl-9 ${className ?? ""}`}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
        />
      </div>
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 rounded-xl border border-border bg-white shadow-lg overflow-hidden">
          {suggestions.map(s => (
            <button
              key={s.place_id}
              type="button"
              onMouseDown={e => { e.preventDefault(); pick(s); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b border-border/40 last:border-0 truncate"
            >
              {s.display_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
