// Sprint F: /orcamentos foi unificado em /propostas (Gargalo 3 da auditoria).
// Esta página agora apenas redireciona para /propostas?tipo=orcamento,
// preservando links antigos. O conteúdo (QuotationCreator, lista, dialogs)
// foi migrado para src/pages/Propostas.tsx.
import { Navigate } from "react-router-dom";

export default function Orcamentos() {
  return <Navigate to="/propostas?tipo=orcamento" replace />;
}
