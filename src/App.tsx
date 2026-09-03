import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { LeadPopup360 } from "@/components/LeadPopup360";
import { useLeadListener360 } from "@/hooks/useLeadListener360";
import { useChannelSettingsSync } from "@/hooks/useChannelSettingsSync";
import { useFollowUpNotifications } from "@/hooks/useFollowUpNotifications";
import { useNewEmailNotifications } from "@/hooks/useNewEmailNotifications";
import { Loader2 } from "lucide-react";

// Lazy-loaded pages (code splitting)
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ContactosDirectus = lazy(() => import("./pages/ContactosDirectus"));
const Leads = lazy(() => import("./pages/Leads"));
const Pipeline = lazy(() => import("./pages/Pipeline"));
const Loja = lazy(() => import("./pages/Loja"));
const Pedidos = lazy(() => import("./pages/Pedidos"));
const Carrinhos = lazy(() => import("./pages/Carrinhos"));
const Canais = lazy(() => import("./pages/Canais"));
const Fornecedores = lazy(() => import("./pages/Fornecedores"));
const Integracoes = lazy(() => import("./pages/Integracoes"));
const Definicoes = lazy(() => import("./pages/Definicoes"));
const FichaClienteConfig = lazy(() => import("./pages/FichaClienteConfig"));
const WhatsappInstances = lazy(() => import("./pages/settings/WhatsappInstances"));
const IaProviders = lazy(() => import("./pages/settings/IaProviders"));
const AiSettings = lazy(() => import("./pages/settings/AiSettings"));
const PipelinesSettings = lazy(() => import("./pages/settings/Pipelines"));
const WorkflowsSettings = lazy(() => import("./pages/settings/Workflows"));
const UtilizadoresDirectus = lazy(() => import("./pages/UtilizadoresDirectus"));
const MenuMobile = lazy(() => import("./pages/MenuMobile"));
const NotFound = lazy(() => import("./pages/NotFound"));
const DeveloperTools = lazy(() => import("./pages/DeveloperTools"));
const Orcamentos = lazy(() => import("./pages/Orcamentos"));
const Propostas = lazy(() => import("./pages/Propostas"));
const QuotationForm = lazy(() => import("./pages/QuotationForm"));
const ProposalDetail = lazy(() => import("./pages/ProposalDetail"));
const PublicQuotation = lazy(() => import("./pages/PublicQuotation"));
const PublicProductSpecification = lazy(() => import("./pages/PublicProductSpecification"));
const Newsletter = lazy(() => import("./pages/Newsletter"));
const Newsletter360 = lazy(() => import("./pages/Newsletter360"));
const Agenda = lazy(() => import("./pages/Agenda"));
const ComunicacoesPage = lazy(() => import("./pages/Comunicacoes"));
const Telecof = lazy(() => import("./pages/Telecof"));
const Social = lazy(() => import("./pages/Social"));
const Email = lazy(() => import("./pages/Email"));
const Customer360 = lazy(() => import("./pages/Customer360"));
const InboxPage = lazy(() => import("./pages/Inbox"));
const Relatorios = lazy(() => import("./pages/Relatorios"));
const CallsAI = lazy(() => import("./pages/CallsAI"));
const LeadCaptureFormsSettings = lazy(() => import("./pages/settings/LeadCaptureForms"));
const PublicLeadCapture = lazy(() => import("./pages/c/[slug]"));
const Onboarding = lazy(() => import("./pages/onboarding"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

const queryClient = new QueryClient();

function Customer360LegacyRedirect() {
  const { id } = useParams();
  return <Navigate to={id ? `/customer360/${id}` : "/contactos"} replace />;
}

const AppContent = () => {
  useChannelSettingsSync();
  useNewEmailNotifications();
  const { incomingLead, isVisible: leadVisible, dismissLead } = useLeadListener360();

  return (
    <>
      <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/contactos" element={<ProtectedRoute><ContactosDirectus /></ProtectedRoute>} />
        <Route path="/contactos/novo" element={<ProtectedRoute><Navigate to="/customer360/novo" replace /></ProtectedRoute>} />
        <Route path="/dashboard360/:id" element={<ProtectedRoute><Customer360LegacyRedirect /></ProtectedRoute>} />
        <Route path="/dashboard360" element={<ProtectedRoute><Navigate to="/contactos" replace /></ProtectedRoute>} />
        <Route path="/leads" element={<ProtectedRoute><Leads /></ProtectedRoute>} />
        <Route path="/pipeline" element={<ProtectedRoute><Pipeline /></ProtectedRoute>} />
        <Route path="/loja" element={<ProtectedRoute><Loja /></ProtectedRoute>} />
        <Route path="/pedidos" element={<ProtectedRoute><Pedidos /></ProtectedRoute>} />
        <Route path="/carrinhos" element={<ProtectedRoute><Carrinhos /></ProtectedRoute>} />
        <Route path="/canais" element={<ProtectedRoute><Canais /></ProtectedRoute>} />
        <Route path="/orcamentos" element={<ProtectedRoute><Orcamentos /></ProtectedRoute>} />
        <Route path="/propostas" element={<ProtectedRoute><Propostas /></ProtectedRoute>} />
        <Route path="/propostas/nova" element={<ProtectedRoute><QuotationForm /></ProtectedRoute>} />
        <Route path="/propostas/:id" element={<ProtectedRoute><QuotationForm /></ProtectedRoute>} />
        <Route path="/propostas/:id/detalhe" element={<ProtectedRoute><ProposalDetail /></ProtectedRoute>} />
        <Route path="/p/:token" element={<PublicQuotation />} />
        <Route path="/p/:token/spec/:itemId" element={<PublicProductSpecification />} />
        <Route path="/p/:token/spec" element={<PublicProductSpecification />} />
        <Route path="/agenda" element={<ProtectedRoute><Agenda /></ProtectedRoute>} />
        <Route path="/comunicacoes" element={<ProtectedRoute><ComunicacoesPage /></ProtectedRoute>} />
        <Route path="/telecof" element={<ProtectedRoute><Telecof /></ProtectedRoute>} />
        <Route path="/inbox" element={<ProtectedRoute><InboxPage /></ProtectedRoute>} />
        <Route path="/email" element={<ProtectedRoute><Email /></ProtectedRoute>} />
        <Route path="/social" element={<ProtectedRoute><Social /></ProtectedRoute>} />
        <Route path="/newsletter" element={<ProtectedRoute><Newsletter /></ProtectedRoute>} />
        <Route path="/newsletter/:id" element={<ProtectedRoute><Newsletter360 /></ProtectedRoute>} />
        <Route path="/fornecedores" element={<ProtectedRoute><Fornecedores /></ProtectedRoute>} />
        <Route path="/integracoes" element={<ProtectedRoute><Integracoes /></ProtectedRoute>} />
        <Route path="/definicoes" element={<ProtectedRoute><Definicoes /></ProtectedRoute>} />
        <Route path="/definicoes/ficha-cliente" element={<ProtectedRoute><FichaClienteConfig /></ProtectedRoute>} />
        <Route path="/definicoes/whatsapp" element={<ProtectedRoute><WhatsappInstances /></ProtectedRoute>} />
        <Route path="/definicoes/ia-providers" element={<ProtectedRoute><IaProviders /></ProtectedRoute>} />
        <Route path="/definicoes/ia-settings" element={<ProtectedRoute><AiSettings /></ProtectedRoute>} />
        <Route path="/definicoes/pipelines" element={<ProtectedRoute><PipelinesSettings /></ProtectedRoute>} />
        <Route path="/definicoes/workflows" element={<ProtectedRoute><WorkflowsSettings /></ProtectedRoute>} />
        <Route path="/settings/workflows" element={<ProtectedRoute><WorkflowsSettings /></ProtectedRoute>} />
        <Route path="/utilizadores" element={<ProtectedRoute><UtilizadoresDirectus /></ProtectedRoute>} />
        <Route path="/menu" element={<ProtectedRoute><MenuMobile /></ProtectedRoute>} />
        <Route path="/customer360-shell" element={<ProtectedRoute><Navigate to="/contactos" replace /></ProtectedRoute>} />
        <Route path="/customer360-shell/:id" element={<ProtectedRoute><Customer360LegacyRedirect /></ProtectedRoute>} />
        <Route path="/customer360/:id" element={<ProtectedRoute><Customer360 /></ProtectedRoute>} />
        <Route path="/relatorios" element={<ProtectedRoute><Relatorios /></ProtectedRoute>} />
        <Route path="/calls-ai" element={<ProtectedRoute><CallsAI /></ProtectedRoute>} />
        <Route path="/developer-tools" element={<ProtectedRoute><DeveloperTools /></ProtectedRoute>} />
        <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
        <Route path="/definicoes/lead-capture" element={<ProtectedRoute><LeadCaptureFormsSettings /></ProtectedRoute>} />
        <Route path="/c/:slug" element={<PublicLeadCapture />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>

      {incomingLead && (
        <LeadPopup360
          lead={incomingLead}
          isVisible={leadVisible}
          onDismiss={dismissLead}
        />
      )}
    </>
  );
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;


