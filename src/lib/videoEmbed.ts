/**
 * Parser unificado de URLs de vídeo → embed URL.
 * Usado em StepMedia.tsx (editor) e MediaSection.tsx (público).
 *
 * Suporta: YouTube (watch, youtu.be, /live/, /shorts/), Vimeo, Instagram (post, reel).
 */

export function getVideoEmbedUrl(url: string): string | null {
  if (!url || !url.trim()) return null;
  const trimmed = url.trim();

  // YouTube — watch?v=
  const ytWatch = trimmed.match(/youtube\.com\/watch\?v=([\w-]+)/);
  if (ytWatch) return `https://www.youtube.com/embed/${ytWatch[1]}`;

  // YouTube — youtu.be/
  const ytShort = trimmed.match(/youtu\.be\/([\w-]+)/);
  if (ytShort) return `https://www.youtube.com/embed/${ytShort[1]}`;

  // YouTube — /live/
  const ytLive = trimmed.match(/youtube\.com\/live\/([\w-]+)/);
  if (ytLive) return `https://www.youtube.com/embed/${ytLive[1]}`;

  // YouTube — /shorts/
  const ytShorts = trimmed.match(/youtube\.com\/shorts\/([\w-]+)/);
  if (ytShorts) return `https://www.youtube.com/embed/${ytShorts[1]}`;

  // YouTube — /embed/ (já é embed)
  const ytEmbed = trimmed.match(/youtube\.com\/embed\/([\w-]+)/);
  if (ytEmbed) return trimmed;

  // Vimeo — vimeo.com/ID
  const vimeo = trimmed.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;

  // Instagram — /p/ ou /reel/
  const insta = trimmed.match(/instagram\.com\/(p|reel)\/([\w-]+)/);
  if (insta) return `https://www.instagram.com/${insta[1]}/${insta[2]}/embed`;

  return null;
}

/**
 * Verifica se um URL é um link de vídeo reconhecido.
 */
export function isValidVideoUrl(url: string): boolean {
  return getVideoEmbedUrl(url) !== null;
}
