import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getContactById } from "@/integrations/directus/contacts";
import { useProposalForm } from "@/contexts/ProposalFormContext";
import { useContacts } from "@/hooks/useContacts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, UserCheck, UserPlus } from "lucide-react";

export function StepClient() {
  const { state, updateField, updateFields } = useProposalForm();
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);

  const { data: contacts = [], isLoading } = useContacts(searchQuery);

  // Auto-fill from Directus if customer_id is present but name/email/phone are missing
  const customerIdToFetch = state.customer_id;
  const shouldFetchContact = !!customerIdToFetch && (!state.customer_name || !state.customer_email || !state.customer_phone);
  const { data: contactDetails } = useQuery({
    queryKey: ["step-client-contact", customerIdToFetch],
    queryFn: () => getContactById(customerIdToFetch!),
    enabled: shouldFetchContact,
  });

  useEffect(() => {
    if (contactDetails) {
      const c = contactDetails as any;
      const personName = c.contact_person || c.contact_name || c.full_name || "";
      const companyName = c.company_name || "";
      updateFields({
        customer_name: state.customer_name || personName || companyName,
        customer_company: state.customer_company || companyName,
        customer_email: state.customer_email || c.email || c.contact_email || "",
        customer_phone: state.customer_phone || c.phone || c.contact_phone || "",
        sent_to_phone: state.sent_to_phone || c.phone || c.contact_phone || "",
        isExistingCustomer: true,
      });
    }
  }, [contactDetails, state.customer_name, state.customer_company, state.customer_email, state.customer_phone, state.sent_to_phone, updateFields]);

  const handleSelectContact = (contact: any) => {
    // Prioritize person name (contact_person / contact_name) over company_name
    const personName = contact.contact_person || contact.contact_name || "";
    const companyName = contact.company_name || "";
    updateFields({
      customer_id: contact.id,
      customer_name: personName || companyName,
      customer_email: contact.email || "",
      customer_phone: contact.phone || "",
      customer_company: companyName,
      sent_to_phone: contact.phone || "",
      isExistingCustomer: true,
    });
    setShowResults(false);
    setSearchQuery("");
  };

  const handleClearCustomer = () => {
    updateFields({
      customer_id: undefined,
      customer_name: "",
      customer_email: "",
      customer_phone: "",
      customer_company: "",
      sent_to_phone: "",
      isExistingCustomer: false,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-5 w-5" />
            Pesquisar cliente existente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Existing customer banner */}
          {state.isExistingCustomer && (state.customer_name || state.customer_company) && (
            <div className="flex items-center justify-between p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg shadow-xs">
              <div className="flex items-center gap-2.5">
                <UserCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                    Cliente associado: {state.customer_name || state.customer_company}
                    {state.customer_company && state.customer_name && state.customer_name !== state.customer_company && (
                      <span className="text-xs font-normal text-muted-foreground ml-2">({state.customer_company})</span>
                    )}
                  </div>
                  <div className="text-xs text-emerald-700/80 dark:text-emerald-400 mt-0.5">
                    {[state.customer_phone, state.customer_email].filter(Boolean).join(" · ")}
                  </div>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleClearCustomer} className="text-xs">
                Alterar cliente
              </Button>
            </div>
          )}

          {/* Search */}
          {!state.isExistingCustomer && (
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar por nome, email ou telefone..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowResults(e.target.value.length >= 2);
                  }}
                  onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
                  className="pl-9"
                />
              </div>

              {/* Results dropdown */}
              {showResults && (
                <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {isLoading && (
                    <div className="p-3 text-sm text-muted-foreground">A procurar...</div>
                  )}
                  {!isLoading && contacts.length === 0 && searchQuery.length >= 2 && (
                    <div className="p-3 text-sm text-muted-foreground flex items-center gap-2">
                      <UserPlus className="h-4 w-4" />
                      Nenhum contacto encontrado. Preencha os dados abaixo.
                    </div>
                  )}
                  {contacts.map((contact: any) => (
                    <button
                      key={contact.id}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-accent transition-colors border-b last:border-b-0"
                      onClick={() => handleSelectContact(contact)}
                    >
                      <div className="font-medium text-sm">
                        {contact.contact_name || contact.company_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {contact.email && <span>{contact.email}</span>}
                        {contact.phone && <span className="ml-2">{contact.phone}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Client details form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            {state.isExistingCustomer ? (
              <UserCheck className="h-5 w-5" />
            ) : (
              <UserPlus className="h-5 w-5" />
            )}
            {state.isExistingCustomer ? "Dados do cliente" : "Novo cliente"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label>Nome completo</Label>
            <Input
              value={state.customer_name || ""}
              onChange={(e) => updateField("customer_name", e.target.value)}
              placeholder="Nome do cliente"
            />
          </div>

          {/* Treatment buttons */}
          <div className="space-y-2">
            <Label>Tratamento</Label>
            <div className="flex gap-2">
              {(["Sr.", "Sra.", "Empresa"] as const).map((t) => (
                <Button
                  key={t}
                  type="button"
                  variant={state.treatment === t ? "default" : "outline"}
                  size="sm"
                  onClick={() => updateField("treatment", t)}
                >
                  {t}
                </Button>
              ))}
            </div>
          </div>

          {/* Company */}
          <div className="space-y-2">
            <Label>Empresa</Label>
            <Input
              value={state.customer_company || ""}
              onChange={(e) => updateField("customer_company", e.target.value)}
              placeholder="Nome da empresa"
            />
          </div>

          {/* Phone & Email */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                value={state.customer_phone || ""}
                onChange={(e) => {
                  updateField("customer_phone", e.target.value);
                  updateField("sent_to_phone", e.target.value);
                }}
                placeholder="+351 912 345 678"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={state.customer_email || ""}
                onChange={(e) => updateField("customer_email", e.target.value)}
                placeholder="email@empresa.pt"
              />
            </div>
          </div>

          {/* Language & Timezone */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Idioma da proposta</Label>
              <Select
                value={state.language || "pt"}
                onValueChange={(v) => updateField("language", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt">Português</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fuso horário</Label>
              <Select
                value={state.customer_timezone || "Europe/Lisbon"}
                onValueChange={(v) => updateField("customer_timezone", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Europe/Lisbon">Europe/Lisbon (WET)</SelectItem>
                  <SelectItem value="Europe/Madrid">Europe/Madrid (CET)</SelectItem>
                  <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                  <SelectItem value="America/Sao_Paulo">America/São Paulo (BRT)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
