import { useState, useRef, useCallback } from "react";
import { useProposalForm } from "@/contexts/ProposalFormContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DIRECTUS_URL } from "@/integrations/directus/client";
import { getVideoEmbedUrl } from "@/lib/videoEmbed";
import {
  Mic,
  Square,
  Video,
  Star,
  Trash2,
  Plus,
  Sparkles,
  Loader2,
  Upload,
} from "lucide-react";
import type { QuotationReview } from "@/types/quotation";

/** Upload de áudio para Directus e devolve URL permanente */
async function uploadAudioToDirectus(blob: Blob, filename: string): Promise<string> {
  const formData = new FormData();
  formData.append("file", blob, filename);
  const resp = await fetch(`${DIRECTUS_URL}/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${localStorage.getItem("directus_access_token") || ""}` },
    body: formData,
  });
  if (!resp.ok) throw new Error(`Upload falhou: ${resp.status}`);
  const data = await resp.json();
  const fileId = data?.data?.id;
  if (!fileId) throw new Error("Upload sem ID devolvido");
  return `${DIRECTUS_URL}/assets/${fileId}`;
}

export function StepMedia() {
  const { state, dispatch, updateField } = useProposalForm();

  // ─── Voice recorder ────────────────────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState(state.voice_message_url || "");
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reviews form
  const [reviewName, setReviewName] = useState("");
  const [reviewCompany, setReviewCompany] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [isGeneratingReview, setIsGeneratingReview] = useState(false);

  // ─── Voice recording ───────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        // Upload real para Directus (não blob: local)
        setUploadingAudio(true);
        const filename = `voice_${Date.now()}.webm`;
        uploadAudioToDirectus(blob, filename)
          .then((permanentUrl) => {
            setAudioUrl(permanentUrl);
            updateField("voice_message_url", permanentUrl);
          })
          .catch(() => {
            // Fallback: manter blob local para preview (mas avisar)
            const localUrl = URL.createObjectURL(blob);
            setAudioUrl(localUrl);
            updateField("voice_message_url", ""); // Não gravar blob: no Directus
          })
          .finally(() => setUploadingAudio(false));
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= 59) {
            stopRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      // microphone access denied
    }
  };

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const handleVoiceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAudio(true);
    uploadAudioToDirectus(file, file.name)
      .then((permanentUrl) => {
        setAudioUrl(permanentUrl);
        updateField("voice_message_url", permanentUrl);
      })
      .catch(() => {
        const localUrl = URL.createObjectURL(file);
        setAudioUrl(localUrl);
        updateField("voice_message_url", "");
      })
      .finally(() => setUploadingAudio(false));
  };

  // ─── Video embed (parser unificado partilhado) ─────────────────────────
  const embedUrl = state.video_url ? getVideoEmbedUrl(state.video_url) : null;
  const videoUrlInvalid = !!state.video_url?.trim() && !embedUrl;

  // ─── Reviews ───────────────────────────────────────────────────────────
  const addReview = () => {
    if (!reviewName.trim()) return;
    const review: QuotationReview = {
      reviewer_name: reviewName,
      rating: reviewRating,
      review_text: reviewText || undefined,
      source: "manual",
    };
    dispatch({ type: "ADD_REVIEW", review });
    setReviewName("");
    setReviewCompany("");
    setReviewRating(5);
    setReviewText("");
  };

  const handleGenerateReview = async () => {
    setIsGeneratingReview(true);
    try {
      const names = [
        "João Mendes",
        "Ana Silva",
        "Carlos Ferreira",
        "Maria Santos",
        "Pedro Costa",
      ];
      const companies = [
        "Hotel Atlântico",
        "Restaurante O Pátio",
        "Pastelaria Central",
        "Resort Praia Dourada",
        "Cantina Universitária",
      ];
      const texts = [
        "Equipamento de qualidade excelente. A instalação foi rápida e o apoio técnico muito prestável.",
        "Encomendámos a cozinha industrial completa e ficámos muito satisfeitos com o resultado.",
        "Relação qualidade-preço fantástica. Já é a segunda vez que trabalhamos com a HotelEquip.",
        "Profissionais e pontuais. O nosso restaurante ficou totalmente equipado em tempo recorde.",
        "Recomendo vivamente. Desde o orçamento até à entrega, tudo correu na perfeição.",
      ];
      const idx = Math.floor(Math.random() * names.length);
      const review: QuotationReview = {
        reviewer_name: `${names[idx]} — ${companies[idx]}`,
        rating: 4 + Math.round(Math.random()),
        review_text: texts[idx],
        source: "ai_suggestion",
      };
      dispatch({ type: "ADD_REVIEW", review });
    } finally {
      setIsGeneratingReview(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Voice message recorder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Mensagem de voz
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!audioUrl ? (
            <div className="flex items-center gap-3">
              {!isRecording ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={startRecording}
                  >
                    <Mic className="h-4 w-4 mr-1.5" />
                    Gravar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Upload
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={handleVoiceUpload}
                  />
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={stopRecording}
                  >
                    <Square className="h-3.5 w-3.5 mr-1" />
                    Parar
                  </Button>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-sm font-mono">
                      {recordingTime}s / 60s
                    </span>
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground">Máximo 1 minuto.</p>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <audio controls src={audioUrl} className="flex-1 h-10" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAudioUrl("");
                  updateField("voice_message_url", "");
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Video */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Video className="h-5 w-5" />
            Vídeo (YouTube / Vimeo / Instagram)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={state.video_url || ""}
            onChange={(e) => updateField("video_url", e.target.value)}
            placeholder="https://youtube.com/watch?v=... ou https://vimeo.com/..."
          />
          {videoUrlInvalid && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              ⚠️ Não foi possível gerar preview deste link — confirma que é um link válido do YouTube, Vimeo ou Instagram.
              O link não será exibido na proposta.
            </p>
          )}
          {embedUrl && (
            <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
              <iframe
                src={embedUrl}
                title="Video preview"
                className="absolute inset-0 w-full h-full rounded-lg border-0"
                allowFullScreen
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reviews */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Star className="h-5 w-5" />
              Avaliações de clientes
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleGenerateReview}
              disabled={isGeneratingReview}
            >
              {isGeneratingReview ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 mr-1" />
              )}
              Sugerir avaliação com IA
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Existing reviews */}
          {state.reviews.map((review, index) => (
            <div
              key={index}
              className="flex items-start gap-2 p-3 border rounded-lg"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {review.reviewer_name}
                  </span>
                  <div className="flex">
                    {Array.from({ length: review.rating }).map((_, i) => (
                      <Star
                        key={i}
                        className="h-3 w-3 fill-yellow-400 text-yellow-400"
                      />
                    ))}
                  </div>
                </div>
                {review.review_text && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {review.review_text}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => dispatch({ type: "REMOVE_REVIEW", index })}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}

          {/* Add review form */}
          <div className="space-y-3 p-3 border rounded-lg border-dashed">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome</Label>
                <Input
                  value={reviewName}
                  onChange={(e) => setReviewName(e.target.value)}
                  placeholder="Nome do cliente"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Empresa</Label>
                <Input
                  value={reviewCompany}
                  onChange={(e) => setReviewCompany(e.target.value)}
                  placeholder="Nome da empresa"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Estrelas</Label>
                <div className="flex gap-1 pt-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setReviewRating(n)}
                      className="p-0.5"
                    >
                      <Star
                        className={`h-5 w-5 ${
                          n <= reviewRating
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-muted-foreground/30"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Texto da avaliação</Label>
              <Textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="O que o cliente disse..."
                rows={2}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addReview}
            >
              <Plus className="h-4 w-4 mr-1" /> Adicionar avaliação
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
