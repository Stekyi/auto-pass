"use client";

import { Search, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

interface Props {
  placeholder?: string;
  onSearch: (value: string) => void;
  loading?: boolean;
  className?: string;
  defaultValue?: string;
}

export function SearchBar({ placeholder = "Search...", onSearch, loading, className, defaultValue = "" }: Props) {
  const [value, setValue] = useState(defaultValue);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onSearch(value), 300);
    return () => clearTimeout(timer.current);
  }, [value, onSearch]);

  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full h-14 pl-12 pr-12 border border-slate-300 rounded-xl text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      <div className="absolute right-4 top-1/2 -translate-y-1/2">
        {loading ? (
          <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
        ) : value ? (
          <button onClick={() => setValue("")} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
