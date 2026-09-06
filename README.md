# kinkyx-front

Front headless de **kinkyx-shop.com** — site statique **Astro**, multilingue FR / EN / DE.
Le moteur commerce reste **WooCommerce** (catalogue lu au build, panier via la Store API,
paiement rendu par WooCommerce).

## Prérequis

- Node ≥ 20.11
- Un backend WooCommerce joignable avec l'API REST activée
  - dev : `https://dev.kinkyx-shop.com`
  - prod : `https://back.kinkyx-shop.com` (après bascule)

## Démarrer

```bash
cp .env.example .env      # renseigner WOO_API_URL + clés API
npm install
npm run fetch             # tire le catalogue dans ./data/
npm run dev               # http://localhost:4321
```

`npm run build` enchaîne `fetch` + `astro build` → sortie statique dans `./dist/`.
`npm run build:nofetch` réutilise le `./data/` déjà présent.

## Structure

```
scripts/fetch-catalog.mjs   étape 1 du build : WooCommerce -> ./data/*.json
src/lib/woo.mjs             client REST WooCommerce (build uniquement)
src/i18n/                   locales, chaînes d'interface, helpers de routage
src/layouts/Base.astro      <head>, hreflang, canonical, header + footer
src/components/             Header (mega-menu), Footer, LangSwitcher, ...
src/pages/                  FR à la racine · /en/ · /de/
src/styles/tokens.css       jetons de design repris du site actuel
data/                       catalogue récupéré (git-ignored)
```

## Routage multilingue

`astro.config.mjs` → `i18n` : `fr` par défaut sans préfixe, `en` et `de` préfixés.
Utiliser `localizedPath("/boutique/", locale)` plutôt que des liens en dur.

## Déploiement (Infomaniak)

Build (Node) puis publication du contenu de `dist/` dans le docroot de
`www.kinkyx-shop.com`. Rebuild déclenché par webhook WooCommerce (produit
modifié) — mis en place au lot 5.

## État

Lot 0 — socle. Voir le plan de construction pour la suite.
