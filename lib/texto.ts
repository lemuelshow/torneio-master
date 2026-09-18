/**
 * Nome de atleta é sempre gravado e exibido em MAIÚSCULO. A regra mora aqui
 * para que a tela (enquanto a pessoa digita), o servidor (na gravação) e a
 * leitura da planilha usem exatamente a mesma conversão.
 */

/** Maiúsculo preservando os acentos do português (ã → Ã, ç → Ç). */
export const maiusculo = (s: string) => s.toLocaleUpperCase("pt-BR");

/**
 * Forma canônica de gravação: maiúsculo, sem espaços repetidos nem nas pontas.
 * Não use enquanto a pessoa digita — o trim come o espaço entre nome e
 * sobrenome. Na digitação, só `maiusculo`.
 */
export const normalizarNome = (s: string) =>
  maiusculo(String(s ?? "").normalize("NFC").replace(/\s+/g, " ").trim());

/** Chave de comparação sem acento: "JOÃO" e "Joao" viram a mesma coisa. */
export const chaveDeNome = (s: string) =>
  normalizarNome(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
