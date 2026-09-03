import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";

interface AITextButtonProps {
  onGenerate: () => Promise<string>;
  onResult: (text: string) => void;
  label?: string;
  size?: "sm" | "default" | "icon";
}

export function AITextButton({
  onGenerate,
  onResult,
  label = "Gerar com IA",
  size = "sm",
}: AITextButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const text = await onGenerate();
      if (text) onResult(text);
    } catch {
      // silently fail — AI is optional
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      onClick={handleClick}
      disabled={loading}
      className="gap-1.5"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Sparkles className="h-3.5 w-3.5" />
      )}
      {size !== "icon" && <span>{label}</span>}
    </Button>
  );
}
