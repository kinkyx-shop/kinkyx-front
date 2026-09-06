/**
 * Serveur minimal — sert uniquement à rendre valide la définition
 * d'« application Node.js » dans le Manager Infomaniak (racine + fichier
 * de démarrage + port). Le site public est du HTML statique servi par
 * Apache depuis dist/ ; ce process ne rend rien d'utile pour l'instant.
 *
 * Au lot 5, il devient le gestionnaire du webhook de rebuild WooCommerce.
 */

import { createServer } from "node:http";

const port = Number(process.env.PORT) || 3000;

createServer((req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok\n");
    return;
  }
  res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  res.end("kinkyx-front — hôte de build. Le site est servi en statique par Apache.\n");
}).listen(port, () => {
  console.log(`[noop] écoute sur le port ${port}`);
});
