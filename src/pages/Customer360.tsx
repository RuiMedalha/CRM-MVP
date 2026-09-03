/**
 * Customer 360 - Vista remodulada mobile-first
 */
import { useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useCustomer360Remodeled } from '@/hooks/useCustomer360Remodeled';
import { Copy, Phone, MessageCircle, Mail, FileText, ShoppingCart, Pin, Plus, Calendar, User, Building2, Star, ExternalLink, Trash2, Menu, X, AlertCircle } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';

const TABS = [
  { id: 'timeline', label: 'Timeline' },
  { id: 'propostas', label: 'Propostas' },
  { id: 'compras', label: 'Compras' },
  { id: 'comunicacao', label: 'Comunicacao' },
  { id: 'notas', label: 'Notas' },
];

function getChannelIcon(ch) {
  switch (ch.toLowerCase()) {
    case 'whatsapp': case 'meta': return <MessageCircle className="w-4 h-4 text-emerald-600"/>;
    case 'email': return <Mail className="w-4 h-4 text-gray-500"/>;
    case 'telecof': case 'call': return <Phone className="w-4 h-4 text-blue-600"/>;
    case 'proposal': case 'quotation': return <FileText className="w-4 h-4 text-purple-600"/>;
    case 'order': case 'site_order': return <ShoppingCart className="w-4 h-4 text-orange-600"/>;
    default: return <Calendar className="w-4 h-4 text-slate-400"/>;
  }
}

function getBadgeStyle(ch) {
  switch (ch.toLowerCase()) {
    case 'whatsapp': case 'meta': return 'bg-emerald-100 text-emerald-800';
    case 'email': return 'bg-gray-100 text-gray-700';
    case 'telecof': case 'call': return 'bg-blue-100 text-blue-800';
    case 'proposal': case 'quotation': return 'bg-purple-100 text-purple-800';
    case 'order': case 'site_order': return 'bg-orange-100 text-orange-800';
    default: return 'bg-slate-100 text-slate-700';
  }
}
function QuickActionsSheet({ name, phone, email, whatsapp }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="lg:hidden"><Menu className="w-4 h-4 mr-1"/>Ações</Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl pb-8">
        <SheetHeader className="pb-4 border-b"><SheetTitle className="text-center text-lg">Ações Rápidas</SheetTitle></SheetHeader>
        <div className="space-y-4 mt-6 px-2">
          <Card className="border-none shadow-sm bg-gradient-to-r from-slate-50 to-white">
            <CardContent className="pt-4 pb-3">
              <p className="font-medium text-sm truncate">{name}</p>
              {phone && <a href={"tel:"+phone} className="text-xs text-primary flex items-center gap-1"><Phone className="w-3 h-3"/>{phone}</a>}
            </CardContent>
          </Card>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Phone, label: "Ligar", color: "text-green-600", fn: () => phone && window.open("tel:"+phone) },
              { icon: MessageCircle, label: "WhatsApp", color: "text-emerald-600", fn: () => { const n = whatsapp?.replace(/\D/g,""); if(n) window.open("https://wa.me/"+n); } },
              { icon: Mail, label: "Email", color: "text-blue-600", fn: () => email && window.open("mailto:"+email) },
              { icon: FileText, label: "Proposta", color: "text-purple-600", fn: () => {} },
            ].map(({icon:Ic,label,color,fn}) => (
              <button key={label} onClick={() => { fn(); setOpen(false); }}
                className="flex flex-col items-center justify-center p-4 rounded-xl border transition-all active:scale-95 bg-card shadow-sm hover:shadow-md hover:bg-gray-50">
                <Ic className={"w-7 h-7 mb-2 "+color}/><span className="text-sm font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function TimelineTab({ timeline }) {
  if (!timeline || timeline.length === 0) {
    return <div className="flex flex-col items-center justify-center py-16 px-4"><Calendar className="w-12 h-12 text-gray-300 mb-3"/><p className="text-muted-foreground text-sm font-medium">Sem atividades registadas</p><p className="text-muted-foreground/60 text-xs mt-1">As atividades aparecem aqui quando ocorrem.</p></div>;
  }
  return (
    <ScrollArea className="h-full">
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {timeline.map((item) => {
          const channel = item.channel || item.type || "crm";
          const timeAgo = item.occurredAt ? formatDistanceToNow(new Date(item.occurredAt), { addSuffix: true, locale: pt }) : "";
          return (
            <Card key={item.id} className="border shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center shrink-0 border shadow-sm">{getChannelIcon(channel)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm truncate">{item.title || item.summary || "Evento"}</span>
                      <Badge variant="outline" className={"text-[10px] px-1.5 py-0 "+getBadgeStyle(channel)}>{channel.toUpperCase()}</Badge>
                    </div>
                    {(item.description||item.summary) && <p className="text-muted-foreground text-xs mt-0.5 line-clamp-2">{item.description||item.summary}</p>}
                    {timeAgo && <p className="text-xs text-muted-foreground/60 mt-1.5 flex items-center gap-1"><Calendar className="w-3 h-3"/>{timeAgo}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </ScrollArea>
  );
}

function PropostasTab({ proposals }) {
  if (!proposals || proposals.length === 0) {
    return <div className="flex flex-col items-center justify-center py-16 px-4"><FileText className="w-12 h-12 text-gray-300 mb-3"/><p className="text-muted-foreground text-sm font-medium">Sem propostas registadas</p><p className="text-muted-foreground/60 text-xs mt-1">As propostas aparecem aqui quando criadas.</p></div>;
  }
  const sl = { draft:"Rascunho", sent:"Enviada", viewed:"Vista", approved:"Aprovada", rejected:"Rejeitada" };
  return (
    <ScrollArea className="h-full">
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {proposals.map((q) => (
          <Card key={q.id} className="border shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{q.quotation_number||"#"+q.id.slice(0,8)}</span>
                    <Badge variant="outline" className={q.status==="approved"?"bg-green-100 text-green-800":q.status==="rejected"?"bg-red-100 text-red-800":"bg-slate-100 text-slate-600"}>{sl[q.status]||q.status}</Badge>
                  </div>
                  {q.total_amount!=null&&<p className="text-lg font-bold text-primary mt-1">{new Intl.NumberFormat("pt-PT",{style:"currency",currency:"EUR"}).format(q.total_amount)}</p>}
                  {q.date_created&&<p className="text-xs text-muted-foreground mt-1">{format(new Date(q.date_created),"dd MMM yyyy",{locale:pt})}</p>}
                </div>
                <Link to={"/quotations/"+encodeURIComponent(String(q.id))}><Button variant="ghost" size="sm"><ExternalLink className="w-4 h-4"/></Button></Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}

function ComprasTab({ orders }) {
  if (!orders || orders.length === 0) {
    return <div className="flex flex-col items-center justify-center py-16 px-4"><ShoppingCart className="w-12 h-12 text-gray-300 mb-3"/><p className="text-muted-foreground text-sm font-medium">Sem encomendas registadas</p><p className="text-muted-foreground/60 text-xs mt-1">As encomendas do site aparecem aqui.</p></div>;
  }
  const sl2 = { pending:"Pendente", processing:"Em processamento", "on-hold":"Em espera", completed:"Concluída", cancelled:"Cancelada", refunded:"Reembolsada", failed:"Falhada" };
  return (
    <ScrollArea className="h-full">
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {orders.map((o) => (
          <Card key={o.id} className="border shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">#{o.order_number || o.wc_order_id || o.id}</span>
                    <Badge variant="outline" className={o.status==="completed"?"bg-green-100 text-green-800":o.status==="pending"||o.status==="processing"?"bg-yellow-100 text-yellow-800":o.status==="cancelled"?"bg-red-100 text-red-800":"bg-slate-100 text-slate-600"}>{sl2[o.status]||o.status}</Badge>
                  </div>
                  {o.items&&o.items.length>0&&<p className="text-xs text-muted-foreground mt-1">{o.items.length} item{o.items.length>1?"s":""}: {o.items.slice(0,3).map(i=>i.name).join(", ")}</p>}
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    {o.date_ordered&&<span>{format(new Date(o.date_ordered),"dd/MM/yyyy")}</span>}
                    {o.payment_method_title&&<span>. {o.payment_method_title}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-primary text-sm">{new Intl.NumberFormat("pt-PT",{style:"currency",currency:"EUR"}).format(o.total||0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}

function ComunicacaoTab({ timeline }) {
  const comms = (timeline||[]).filter(e=>["whatsapp","email","meta","telecof","call"].includes((e.channel||"").toLowerCase()));
  if (comms.length===0) {
    return <div className="flex flex-col items-center justify-center py-16 px-4"><MessageCircle className="w-12 h-12 text-gray-300 mb-3"/><p className="text-muted-foreground text-sm font-medium">Sem comunicações</p><p className="text-muted-foreground/60 text-xs mt-1">WhatsApp, email e chamadas aparecem aqui.</p></div>;
  }
  const cIcons = { whatsapp:<MessageCircle className="w-4 h-4 text-emerald-500"/>, meta:<MessageCircle className="w-4 h-4 text-green-600"/>, email:<Mail className="w-4 h-4 text-gray-500"/>, telecof:<Phone className="w-4 h-4 text-blue-600"/>, call:<Phone className="w-4 h-4 text-blue-500"/> };
  return (
    <ScrollArea className="h-full">
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {comms.map((item) => {
          const ch = item.channel||"crm";
          return (
            <Card key={item.id} className="border shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center shrink-0 border">{cIcons[ch]||<Calendar className="w-4 h-4 text-slate-400"/>}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm truncate">{item.title||item.summary||"Comunicação"}</span>
                      <Badge variant="outline" className={"text-[10px] px-1.5 py-0 "+getBadgeStyle(ch)}>{ch.toUpperCase()}</Badge>
                    </div>
                    {(item.description||item.summary)&&<p className="text-muted-foreground text-xs mt-0.5 line-clamp-2">{item.description||item.summary}</p>}
                    {item.occurredAt&&<p className="text-xs text-muted-foreground/60 mt-1.5">{format(new Date(item.occurredAt),"dd MMM yyyy HH:mm",{locale:pt})}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </ScrollArea>
  );
}
function NotasTab({ notes, contactId, onCreateNote, onUpdateNote, onDeleteNote }) {
  const [body, setBody] = useState('');
  const [pinning, setPinning] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const handleSubmit = async (e) => { e.preventDefault(); if (!body.trim()||!contactId) return; await onCreateNote({ contact_id: contactId, body: body.trim(), pinned: false }); setBody(''); };
  const togglePin = async (note) => { if (pinning) return; setPinning(note.id); await onUpdateNote({ id: note.id, patch: { pinned: !note.pinned } }); setPinning(null); };
  const handleDelete = async (id) => { if (deleting) return; setDeleting(id); await onDeleteNote(id); setDeleting(null); };
  if ((!notes||notes.length===0)&&!body) return <div className="flex flex-col items-center justify-center py-16 px-4"><Pin className="w-12 h-12 text-gray-300 mb-3"/><p className="text-muted-foreground text-sm font-medium">Sem notas</p><p className="text-muted-foreground/60 text-xs mt-1">Adicione uma nota para começar.</p></div>;
  const sorted = ((notes)||[]).sort((x,y)=>(y.pinned?1:0)-(x.pinned?1:0)||(new Date(y.date_created)).getTime()-(new Date(x.date_created)).getTime());
  return (
    <ScrollArea className="h-full">
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        <form onSubmit={handleSubmit} className="sticky top-0 z-10 bg-gray-50 pt-1 pb-2">
          <Card className="border shadow-sm">
            <CardContent className="p-3 space-y-2">
              <Textarea value={body} onChange={(e)=>setBody(e.target.value)} placeholder="Escrever uma nota..." rows={3} className="text-sm resize-none border-gray-200 focus:border-primary"/>
              <div className="flex justify-end gap-2">
                <Button type="submit" size="sm" disabled={!body.trim()} className="gap-1.5"><Plus className="w-3.5 h-3.5"/>Adicionar</Button>
              </div>
            </CardContent>
          </Card>
        </form>
        {sorted.map((note) => (
          <Card key={note.id} className={'border shadow-sm hover:shadow-md transition-shadow '+(note.pinned?'border-yellow-300 bg-yellow-50/30':'')}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm whitespace-pre-wrap">{note.body || '(nota vazia)'}</p>
                  {note.date_created&&<p className="text-xs text-muted-foreground mt-2 flex items-center gap-1"><Calendar className="w-3 h-3"/>{format(new Date(note.date_created),"dd MMM yyyy HH:mm",{locale:pt})}{note.pinned&&<Pin className="w-3 h-3 text-yellow-500 fill-yellow-500 ml-1"/>}</p>}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button onClick={()=>togglePin(note)} disabled={!!pinning} className="p-1 rounded-md hover:bg-gray-100 text-slate-400 hover:text-yellow-500 transition-colors" title={note.pinned?"Desfixar":"Fixar"}><Pin className={"w-4 h-4"+(note.pinned?" text-yellow-500 fill-yellow-500":"")}/></button>
                  <button onClick={()=>handleDelete(note.id)} disabled={!!deleting} className="p-1 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors" title="Eliminar">{deleting===note.id?<span className="animate-spin block"><X className="w-4 h-4"/></span>:<Trash2 className="w-4 h-4"/>}</button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-start gap-3">
            <Skeleton className="w-14 h-14 rounded-full shrink-0"/>
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-5 w-48"/>
              <Skeleton className="h-4 w-32"/>
              <div className="flex gap-2"><Skeleton className="h-5 w-16 rounded-full"/><Skeleton className="h-5 w-20 rounded-full"/></div>
            </div>
          </div>
          <div className="flex gap-3 mt-3 pt-3 border-t border-white/20"><Skeleton className="h-4 w-28"/><Skeleton className="h-4 w-36"/></div>
        </div>
      </div>
      <div className="border-b bg-white px-4 py-2"><div className="flex gap-6 max-w-4xl mx-auto">{["Timeline","Propostas","Compras","Comunicacao","Notas"].map(t=><Skeleton key={t} className="h-6 w-20"/>)}</div></div>
      <ScrollArea className="flex-1"><div className="max-w-2xl mx-auto px-4 py-4 space-y-3">{[1,2,3,4,5].map(i=>(<Card key={i} className="border shadow-sm"><CardContent className="p-4 space-y-2"><div className="flex items-center gap-3"><Skeleton className="w-8 h-8 rounded-full shrink-0"/><div className="flex-1 space-y-1"><Skeleton className="h-4 w-40"/><Skeleton className="h-3 w-60"/></div></div><Skeleton className="h-3 w-24"/></CardContent></Card>))}</div></ScrollArea>
    </div>
  );
}
function Customer360() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState("timeline");
  const touchStartRef = useRef(null);
  const { data, isLoading, error } = useCustomer360Remodeled(id);

  const handleTouchEnd = (e) => {
    if (!touchStartRef.current) return;
    const d = e.changedTouches[0].clientX - touchStartRef.current;
    const ti = TABS.map(t=>t.id);
    const ci = ti.indexOf(activeTab);
    if(d<-50&&ci<ti.length-1) setActiveTab(ti[ci+1]);
    else if(d>50&&ci>0) setActiveTab(ti[ci-1]);
  };

  if (isLoading) return <LoadingSkeleton />;
  if (error) return (<div className="flex items-center justify-center h-screen bg-gray-50"><div className="text-center"><div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3"><X className="w-6 h-6 text-red-500"/></div><p className="font-semibold text-sm">Erro ao carregar</p><p className="text-muted-foreground text-xs mt-1">{(error as any)?.message || String(error)}</p></div></div>);
  if (!data || (!data.organization && !data.contact)) return (<div className="flex items-center justify-center h-screen bg-gray-50"><EmptyState icon={User} title="Contacto não encontrado" desc="Este contacto pode ter sido eliminado ou não existe."/></div>);

  const org = data.organization || data.contact || {};
  const name = org.company_name || org.contact_name || org.name || "Sem nome";
  const initials = (name || "C").split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
  const city = org.city || "";
  const score = org.score != null ? Number(org.score) : undefined;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50" onTouchStart={(e) => { touchStartRef.current = e.touches[0].clientX; }} onTouchEnd={handleTouchEnd}>
      {/* Sticky Header with gradient */}
      <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 px-4 pb-5 shrink-0 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 -translate-y-8 translate-x-8"/>
        <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-white/5 translate-y-6 -translate-x-6"/>
        <div className="max-w-4xl mx-auto relative z-10">
          <div className="flex items-start gap-3">
            <Avatar className="w-14 h-14 border-2 border-white/30 shadow-lg">
              <AvatarImage src="" alt={name}/>
              <AvatarFallback className="bg-white/20 text-white font-bold text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h1 className="text-white font-bold text-lg leading-tight truncate">{name}</h1>
              {(org.name||city||org.vatNumber||org.vat_number)&&<div className="flex items-center gap-2 mt-0.5 text-white/70 text-xs flex-wrap">
                {(org.name || org.company_name)&&<span className="flex items-center gap-1"><Building2 className="w-3 h-3"/>{org.name || org.company_name}</span>}
                {city&&<span>{city}</span>}
                {(org.vatNumber||org.vat_number)&&<span>NIF: {org.vatNumber || org.vat_number}</span>}</div>}
              {score!=null&&<div className="flex items-center gap-1.5 mt-1.5">
                <Star className="w-3.5 h-3.5 text-yellow-300 fill-yellow-300"/><span className="text-white font-semibold text-sm">{Math.round(score)}</span>
                <span className="text-white/50 text-[10px]">score</span></div>}
            </div>
            {/* Desktop actions */}
            <div className="hidden lg:flex items-center gap-1.5 shrink-0">
              {org.phone&&<Button variant="secondary" size="icon" className="rounded-full w-9 h-9 bg-white/20 hover:bg-white/30 text-white border-0" onClick={()=>window.open("tel:"+org.phone)}><Phone className="w-4 h-4"/></Button>}
              {org.whatsapp_number&&<Button variant="secondary" size="icon" className="rounded-full w-9 h-9 bg-white/20 hover:bg-white/30 text-white border-0" onClick={()=>window.open("https://wa.me/"+(org.whatsapp_number?.replace(/\D/g,'')))}><MessageCircle className="w-4 h-4"/></Button>}
              {org.email&&<Button variant="secondary" size="icon" className="rounded-full w-9 h-9 bg-white/20 hover:bg-white/30 text-white border-0" onClick={()=>window.open("mailto:"+org.email)}><Mail className="w-4 h-4"/></Button>}
              {org.phone&&<Button variant="secondary" size="icon" className="rounded-full w-9 h-9 bg-white/20 hover:bg-white/30 text-white border-0" onClick={()=>navigator.clipboard?.writeText(org.phone)}><Copy className="w-4 h-4"/></Button>}
            </div>
          </div>
          {/* Contact details */}
          <div className="mt-4 pt-4 border-t border-white/15 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {org.phone&&<a href={"tel:"+org.phone} className="flex items-center gap-2 text-white/90 text-sm group"><Phone className="w-4 h-4 shrink-0 text-white/50"/><span className="truncate">{org.phone}</span><button onClick={(e)=>{e.preventDefault();navigator.clipboard?.writeText(org.phone)}} className="ml-auto text-white/30 hover:text-white transition-colors shrink-0"><Copy className="w-3.5 h-3.5"/></button></a>}
            {org.email&&<a href={"mailto:"+org.email} className="flex items-center gap-2 text-white/90 text-sm group"><Mail className="w-4 h-4 shrink-0 text-white/50"/><span className="truncate">{org.email}</span><button onClick={(e)=>{e.preventDefault();navigator.clipboard?.writeText(org.email)}} className="ml-auto text-white/30 hover:text-white transition-colors shrink-0"><Copy className="w-3.5 h-3.5"/></button></a>}
          </div>
          <QuickActionsSheet name={name} phone={org.phone} email={org.email} whatsapp={org.whatsapp_number}/>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="timeline" value={activeTab} onValueChange={setActiveTab} activationMode="manual" className="flex-1 flex flex-col">
        <div className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-20">
          <div className="max-w-4xl mx-auto">
            <TabsList className="w-full h-auto p-0 bg-transparent gap-0 border-0 justify-start overflow-x-auto">
              {TABS.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id}
                  className="flex items-center px-3 py-2.5 text-sm font-medium rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <TabsContent value="timeline" className="data-[state=active]:flex-1 m-0"><TimelineTab timeline={data.timeline}/></TabsContent>
          <TabsContent value="propostas" className="data-[state=active]:flex-1 m-0"><PropostasTab proposals={data.proposals || (data as any).quotations}/></TabsContent>
          <TabsContent value="compras" className="data-[state=active]:flex-1 m-0"><ComprasTab orders={data.orders}/></TabsContent>
          <TabsContent value="comunicacao" className="data-[state=active]:flex-1 m-0"><ComunicacaoTab timeline={data.timeline}/></TabsContent>
          <TabsContent value="notas" className="data-[state=active]:flex-1 m-0"><NotasTab notes={data.notes} contactId={id} onCreateNote={(p)=>data.createNote?.(p)} onUpdateNote={data.updateNote} onDeleteNote={data.deleteNote}/></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function EmptyState({ icon: Ic, title, desc }) {
  return (<div className="flex flex-col items-center justify-center py-16 px-4"><Ic className="w-12 h-12 text-gray-300 mb-3"/><p className="text-muted-foreground text-sm font-medium">{title}</p><p className="text-muted-foreground/60 text-xs mt-1 text-center max-w-xs">{desc}</p></div>);
}

export function Customer360Page() {
  const { id } = useParams();
  if (!id) return (<div className="flex items-center justify-center h-screen bg-gray-50"><EmptyState icon={AlertCircle} title="ID inválido" desc="Forneça um ID válido na URL."/></div>);
  return <Customer360/>;
}
export default Customer360Page;