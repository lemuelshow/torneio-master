import Image from "next/image";

/** Escudo do torneio. Usado no painel lateral, no topo mobile e nas súmulas. */
export function Escudo({
  tamanho = 44,
  prioridade,
  className,
}: {
  tamanho?: number;
  prioridade?: boolean;
  className?: string;
}) {
  return (
    <Image
      src="/logo.png"
      alt="Futevôlei Master Brasil"
      width={tamanho}
      height={Math.round((tamanho * 721) / 813)}
      priority={prioridade}
      className={className}
      style={{ width: tamanho, height: "auto" }}
    />
  );
}

/** Faixa fina com as cores da bandeira — assinatura visual do sistema. */
export function FaixaBandeira({ className }: { className?: string }) {
  return <div aria-hidden className={`faixa-bandeira h-1 w-full ${className ?? ""}`} />;
}
