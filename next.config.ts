import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // build enxuto para Docker: copia só o necessário para rodar em produção
  output: "standalone",
};

export default nextConfig;
