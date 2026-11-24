"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";

export function PasswordField() {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id="password"
        name="password"
        type={show ? "text" : "password"}
        required
        autoComplete="current-password"
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-text-muted hover:text-primary"
        aria-label={show ? "Nascondi password" : "Mostra password"}
        tabIndex={-1}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
