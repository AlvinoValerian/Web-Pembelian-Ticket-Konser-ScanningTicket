import React, { InputHTMLAttributes, ReactNode } from "react";

interface BrutalistInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  icon?: ReactNode;
}

export default function BrutalistInput({
  label,
  error,
  icon,
  className = "",
  ...props
}: BrutalistInputProps) {
  return (
    <div className="flex flex-col w-full text-left">
      <div className="flex justify-between items-center mb-1">
        <label className="text-xs font-black uppercase tracking-wider text-brand-black">
          {label}
        </label>
        {error && (
          <span className="text-[10px] md:text-xs font-bold text-red-600 flex items-center gap-1 uppercase tracking-wide">
            ⚠️ {error}
          </span>
        )}
      </div>
      
      <div className="relative flex items-center w-full">
        {icon && (
          <div className="absolute left-4 text-brand-black/60 pointer-events-none">
            {icon}
          </div>
        )}
        <input
          className={`w-full py-4 text-sm font-bold border-3 border-brand-black outline-none placeholder:text-brand-black/40 transition-colors
            ${icon ? "pl-11 pr-4" : "px-4"}
            ${error 
              ? "bg-[#fee2e2] border-red-600 focus:bg-[#fee2e2]" 
              : "bg-white focus:bg-brand-bg focus:border-brand-blue"
            }
            ${className}`}
          {...props}
        />
      </div>
    </div>
  );
}
