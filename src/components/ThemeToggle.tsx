import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useThemeContext } from "@/hooks/useTheme";

export function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const { theme, setTheme, resolvedMode } = useThemeContext();

  const toggleTheme = () => {
    setTheme({ mode: resolvedMode === "dark" ? "light" : "dark" });
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      className="w-full justify-start text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent"
    >
      {resolvedMode === "light" ? (
        <>
          <Moon className="h-4 w-4" />
          {!collapsed && <span className="ml-2 text-sm">Modo Escuro</span>}
        </>
      ) : (
        <>
          <Sun className="h-4 w-4" />
          {!collapsed && <span className="ml-2 text-sm">Modo Claro</span>}
        </>
      )}
    </Button>
  );
}