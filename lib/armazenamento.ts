import { gravarEstadoGoogle, lerEstadoGoogle } from "./armazenamentoGoogle";
import { CAMINHO_PLANILHA, erroDeGravacao, gravarEstado as gravarLocal, lerEstado as lerLocal } from "./excel";
import type { Estado } from "./tipos";

/** Lê o estado da fonte certa: Google Sheets quando online, arquivo local quando offline. */
export async function lerEstado(offline: boolean): Promise<Estado> {
  return offline ? lerLocal() : lerEstadoGoogle();
}

/** Grava o estado na mesma fonte de onde ele foi lido. */
export async function gravarEstado(estado: Estado, offline: boolean): Promise<void> {
  return offline ? gravarLocal(estado) : gravarEstadoGoogle(estado);
}

/** Mensagem amigável para falha de leitura/gravação, seja qual for a fonte. */
export function erroDeArmazenamento(e: unknown, offline: boolean): string {
  if (offline) return erroDeGravacao(e);
  const msg = e instanceof Error ? e.message : String(e);
  return `Falha ao falar com a planilha do Google: ${msg}`;
}

export { CAMINHO_PLANILHA };
