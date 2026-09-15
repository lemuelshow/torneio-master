/**
 * Constantes compartilhadas entre código de servidor e de cliente. Fica num
 * arquivo separado (sem `node:fs`, `node:crypto` etc.) para poder ser
 * importado por componentes "use client" sem puxar dependências de Node.
 */

/** Cookie que guarda a preferência "Utilizar offline" (1 = offline, 0/ausente = online). */
export const COOKIE_OFFLINE = "torneio_offline";
