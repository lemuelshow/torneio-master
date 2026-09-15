/**
 * Imprime a primeira porta livre a partir de 3000, usada pelo INICIAR.bat.
 *
 * O teste escuta sem fixar host — do mesmo jeito que o Next faz. Fixar
 * 127.0.0.1 daria "livre" para uma porta ocupada em :: e o servidor cairia
 * com EADDRINUSE.
 */
const net = require("node:net");

const livre = (porta) =>
  new Promise((resolve) => {
    const servidor = net.createServer();
    servidor.once("error", () => resolve(false));
    servidor.once("listening", () => servidor.close(() => resolve(true)));
    servidor.listen(porta);
  });

(async () => {
  for (let porta = 3000; porta <= 3020; porta++) {
    if (await livre(porta)) {
      console.log(porta);
      return;
    }
  }
  console.log(3000);
})();
