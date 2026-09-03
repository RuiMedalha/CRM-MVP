import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Card 17 redesign — variants success/error/warning/info via classNames.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-brand-md group-[.toaster]:rounded-lg group-[.toaster]:border-border/70",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-brand-600 group-[.toast]:text-white group-[.toast]:rounded-md",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-md",
          success:
            "group-[.toaster]:!bg-[rgb(16,185,129)]/10 group-[.toaster]:!text-[rgb(5,150,105)] group-[.toaster]:!border-[rgb(16,185,129)]/30 dark:group-[.toaster]:!text-[rgb(110,231,183)]",
          error:
            "group-[.toaster]:!bg-[rgb(244,63,94)]/10 group-[.toaster]:!text-[rgb(225,29,72)] group-[.toaster]:!border-[rgb(244,63,94)]/30 dark:group-[.toaster]:!text-[rgb(252,165,165)]",
          warning:
            "group-[.toaster]:!bg-[rgb(245,158,11)]/10 group-[.toaster]:!text-[rgb(180,83,9)] group-[.toaster]:!border-[rgb(245,158,11)]/30 dark:group-[.toaster]:!text-[rgb(252,211,77)]",
          info: "group-[.toaster]:!bg-brand-50 group-[.toaster]:!text-brand-700 group-[.toaster]:!border-brand-200",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
