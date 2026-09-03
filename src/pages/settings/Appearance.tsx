import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Loader2, Paintbrush, RotateCcw, Check, Sun, Moon, Monitor, Tablet, GripVertical, ChevronRight } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useThemeContext, type ThemeAccent, type ThemeMode, type ThemeRadius, type ThemeDensity } from '@/hooks/useTheme';

const ACCENT_COLORS: { id: ThemeAccent; label: string; hex: string }[] = [
  { id: 'indigo', label: 'Indigo', hex: '#4F46E5' },
  { id: 'emerald', label: 'Verde', hex: '#10B981' },
  { id: 'amber', label: 'Âmbar', hex: '#F59E0B' },
  { id: 'rose', label: 'Rosa', hex: '#F43F5E' },
  { id: 'violet', label: 'Violeta', hex: '#8B5CF6' },
  { id: 'slate', label: 'Cinza', hex: '#64748B' },
];

const RADIUS_OPTIONS: { id: ThemeRadius; label: string }[] = [
  { id: 'none', label: 'Sem cantos' },
  { id: 'sm', label: 'Pequeno' },
  { id: 'md', label: 'Médio' },
  { id: 'lg', label: 'Grande' },
];

const MODE_OPTIONS: { id: ThemeMode; label: string; icon: React.ReactNode; preview: string }[] = [
  { id: 'light', label: 'Claro', icon: <Sun className="h-6 w-6" />, preview: 'bg-white text-gray-900 border border-gray-200' },
  { id: 'dark', label: 'Escuro', icon: <Moon className="h-6 w-6" />, preview: 'bg-slate-900 text-gray-100 border border-slate-700' },
  { id: 'auto', label: 'Automático', icon: <Monitor className="h-6 w-6" />, preview: 'bg-gradient-to-r from-white to-slate-900 text-gray-900 dark:text-gray-100 border' },
];

const DENSITY_OPTIONS: { id: ThemeDensity; label: string }[] = [
  { id: 'comfortable', label: 'Confortável' },
  { id: 'compact', label: 'Compacto' },
];

function ModePreview({ mode }: { mode: ThemeMode }) {
  const opt = MODE_OPTIONS.find((m) => m.id === mode);
  if (!opt) return null;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="'w-full h-20 rounded-md flex items-center justify-center transition-colors ' + opt.preview">
        <span className="text-xs font-medium">{opt.label}</span>
      </div>
    </div>
  );
}

function SwatchCircle({ color, active, onClick }: { color: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative w-11 h-11 rounded-full flex items-center justify-center transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background"
      style={{
        backgroundColor: color,
        boxShadow: active ? '0 0 0 3px hsl(var(--background)), 0 0 0 5px ' + color : '0 1px 3px rgba(0,0,0,0.15)',
      }}
      aria-label={color}
    >
      {active && <Check className="h-5 w-5 text-white drop-shadow" />}
    </button>
  );
}

function RadiusPreview({ radius }: { radius: ThemeRadius }) {
  const radiusMap = { none: '0px', sm: '4px', md: '8px', lg: '12px' };
  return (
    <div className="flex items-center gap-2">
      <button
        className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground transition-all"
        style={{ borderRadius: radiusMap[radius] }}
      >
        Botão
      </button>
      <div
        className="w-6 h-6 bg-muted border flex items-center justify-center"
        style={{ borderRadius: radiusMap[radius] }}
      >
        <span className="text-[8px]">A</span>
      </div>
    </div>
  );
}

function DensityPreview({ density }: { density: ThemeDensity }) {
  const gap = density === 'compact' ? '0.375rem' : '0.75rem';
  const py = density === 'compact' ? '0.375rem' : '0.625rem';
  return (
    <div className="space-y-1" style={{ gap }}>
      {['Item 1', 'Item 2', 'Item 3'].map((item) => (
        <div
          key={item}
          className="flex items-center gap-2 text-xs bg-muted rounded px-3 transition-all"
          style={{ paddingTop: py, paddingBottom: py }}
        >
          <GripVertical className="h-3 w-3 text-muted-foreground" />
          {item}
          <ChevronRight className="h-3 w-3 ml-auto text-muted-foreground" />
        </div>
      ))}
    </div>
  );
}

export default function Appearance() {
  const { theme, setTheme, saveTheme, loading } = useThemeContext();
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveTheme();
      toast({ title: 'Tema guardado', description: 'As preferências de tema foram atualizadas no servidor.' });
      setDialogOpen(false);
    } catch (err: any) {
      toast({ title: 'Erro ao guardar', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setTheme({ accent: 'indigo', mode: 'auto', radius: 'md', density: 'comfortable' });
    toast({ title: 'Tema redefinido', description: 'Predefinições restauradas. Guarde para persistir.' });
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 pb-12 max-w-4xl mx-auto px-2 sm:px-4">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          <Link to="/definicoes" className="hover:underline">Definições</Link>
          <span>/</span>
          <span>Aparência</span>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <Paintbrush className="h-7 w-7 text-primary" />
              Personalizar Tema
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Escolha o modo, cor de marca, raio dos cantos e densidade da interface.
            </p>
          </div>
        </div>

        {/* Quick preview card */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Paintbrush className="h-4 w-4" />
              Pré-visualização
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border p-4 transition-all" style={{ borderRadius: theme.radius === 'none' ? 0 : theme.radius === 'sm' ? 6 : theme.radius === 'md' ? 10 : 14 }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-primary-foreground" style={{ backgroundColor: 'var(--accent-primary)' }}>H</div>
                <div className="flex-1">
                  <div className="text-sm font-semibold" style={{ fontSize: theme.density === 'compact' ? '0.8125rem' : '0.875rem' }}>Dashboard</div>
                  <div className="text-xs text-muted-foreground">Resumo da semana</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2" style={{ gap: theme.density === 'compact' ? '0.375rem' : '0.5rem' }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 rounded bg-muted flex items-center justify-center" style={{ borderRadius: theme.radius === 'none' ? 0 : theme.radius === 'sm' ? 4 : theme.radius === 'md' ? 6 : 8 }}>
                    <div className="w-3/4 h-2 rounded bg-muted-foreground/30" />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Theme Customizer Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 w-full sm:w-auto">
              <Paintbrush className="h-4 w-4" />
              Personalizar tema
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Personalizar Tema</DialogTitle>
              <DialogDescription>
                As alterações são aplicadas em tempo real. Guarde para persistir.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Modo */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Modo</Label>
                <div className="grid grid-cols-3 gap-3">
                  {MODE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setTheme({ mode: opt.id })}
                      className="lex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all cursor-pointer touch-manipulation"
                    >
                      <div className="w-full h-14 rounded-md flex items-center justify-center transition-colors">
                        {opt.icon}
                      </div>
                      <span className="text-xs font-medium">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Cor de marca */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Cor de marca</Label>
                <div className="flex flex-wrap gap-3">
                  {ACCENT_COLORS.map((c) => (
                    <div key={c.id} className="flex flex-col items-center gap-1">
                      <SwatchCircle
                        color={c.hex}
                        active={theme.accent === c.id}
                        onClick={() => setTheme({ accent: c.id })}
                      />
                      <span className="text-[10px] text-muted-foreground">{c.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Raio dos cantos */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Raio dos cantos</Label>
                <div className="grid grid-cols-4 gap-2">
                  {RADIUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setTheme({ radius: opt.id })}
                      className="lex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all cursor-pointer touch-manipulation"
                    >
                      <RadiusPreview radius={opt.id} />
                      <span className="text-[10px] text-muted-foreground">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Densidade */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Densidade</Label>
                <div className="grid grid-cols-2 gap-3">
                  {DENSITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setTheme({ density: opt.id })}
                      className="lex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all cursor-pointer touch-manipulation"
                    >
                      <DensityPreview density={opt.id} />
                      <span className="text-xs font-medium">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t pt-4 mt-2">
              <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
                <RotateCcw className="h-3.5 w-3.5" />
                Repor predefinições
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2 min-w-[120px]">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {saving ? 'A guardar...' : 'Guardar'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Live preview card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pré-visualização ao vivo</CardTitle>
            <CardDescription>
              O tema selecionado é aplicado imediatamente a toda a interface.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="col-span-1 sm:col-span-2 rounded-lg border p-4 space-y-3 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--accent-primary)' }} />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Painel</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Sun className="h-3 w-3 text-muted-foreground" />
                    <Moon className="h-3 w-3 text-muted-foreground" />
                  </div>
                </div>
                <div className="h-24 rounded bg-muted/50 flex items-center justify-center border border-dashed border-border">
                  <div className="text-center">
                    <p className="text-xs font-medium text-muted-foreground">Gráfico de Vendas</p>
                    <p className="text-[10px] text-muted-foreground/60">Jan — Mar 2026</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="h-2 flex-1 rounded bg-primary/60" />
                  <div className="h-2 flex-1 rounded bg-primary/40" />
                  <div className="h-2 flex-1 rounded bg-primary/20" />
                </div>
              </div>
              <div className="col-span-1 rounded-lg border p-4 space-y-2 transition-all">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Atalhos</p>
                <div className="space-y-2">
                  {['Vendas', 'Contactos', 'Relatórios'].map((item) => (
                    <div key={item} className="flex items-center gap-2 p-2 rounded bg-muted/30 transition-all" style={{ borderRadius: theme.radius === 'none' ? 0 : theme.radius === 'sm' ? 4 : theme.radius === 'md' ? 6 : 8 }}>
                      <div className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold text-primary-foreground" style={{ backgroundColor: 'var(--accent-primary)' }}>{item[0]}</div>
                      <span className="text-xs">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
