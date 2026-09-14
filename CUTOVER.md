# Bascule L6 — passage en production

Runbook pour faire passer `www.kinkyx-shop.com` du WordPress/Elementor actuel
vers ce front Astro headless, et déplacer WordPress vers
`back.kinkyx-shop.com` (moteur API pur : Stripe, commandes, stock,
facturation — inchangé).

Site qui vend en ce moment : chaque phase note son niveau de risque et son
caractère réversible ou non. Ne pas enchaîner les phases « bascule réelle »
un jour où personne ne peut surveiller/réagir dans les heures qui suivent.

## État au 2026-09-14

- [x] Front Astro feature-complete (L0–L5) : catalogue, fiches produit,
      panier, checkout Stripe (3DS inclus), compte client, recherche, SEO,
      i18n FR/EN/DE, reconstruction auto sur webhook WooCommerce.
- [x] `back.kinkyx-shop.com` créé (Infomaniak Manager), DNS + certificat SSL
      actifs.
- [x] Fichiers + base de prod copiés vers `back.` (voir Phase 2 ci-dessous —
      **déjà fait**, sans risque, ne touchait pas à prod).
- [x] Mu-plugins headless déployés sur `back.` (voir Phase 2bis — **déjà
      fait**, testé : namespace REST `kinkyx/v1` répond, `php -l` propre,
      WP démarre sans erreur).
- [x] Table de redirections 301 générée (`data/redirects.json`,
      `scripts/build-redirects.mjs`) — **contre le catalogue dev, à
      régénérer contre prod (désormais possible via `back.`) en Phase 6**.
- [x] Clés Stripe live tournées (rotation + nettoyage dev fait).
- [ ] Tout le reste ci-dessous : bascule réelle, pas encore faite.

## Phase 0 — Pré-requis avant de commencer

- [ ] Fenêtre calme choisie (pas un vendredi soir, quelqu'un dispo pour
      surveiller les heures qui suivent).
- [ ] Sauvegarde fraîche de la base prod (Phase 1 ci-dessous, à refaire si
      celle du 2026-09-14 date de plus de quelques jours).
- [ ] Accès confirmés : SSH `infomaniak` (hébergement web), Builder Node.js
      (console SSH du site `front.kinkyx-shop.com`, mot de passe), Stripe
      Dashboard, Infomaniak Manager, Search Console.

## Phase 1 — Sauvegarde (déjà fait le 2026-09-14, refaire si besoin)

```bash
ssh infomaniak "cd ~/sites/www.kinkyx-shop.com && wp db export ~/backup-prod-$(date +%Y%m%d-%H%M).sql"
```

Sauvegarde hors des répertoires de site (`~/backup-prod-*.sql`), donc pas
écrasée par la copie de la Phase 2.

## Phase 2 — Copie fichiers + base prod → back. (déjà fait le 2026-09-14)

```bash
ssh infomaniak "rsync -a --delete \
  --exclude='wp-content/cache/' \
  --exclude='wp-content/updraft/' \
  --exclude='wp-content/wflogs/' \
  --exclude='wp-content/languages-old/' \
  --exclude='wp-content/upgrade-temp-backup/' \
  --exclude='wp-content/uploads-old/' \
  ~/sites/www.kinkyx-shop.com/ ~/sites/back.kinkyx-shop.com/"
```

`wp-config.php` est copié tel quel → `back.` pointe sur la **même base** que
prod (pas d'export/import, pas de risque de décalage). Sans impact sur
`www.` — purement additif. **Si la bascule a lieu plusieurs jours après
cette copie, la relancer juste avant la Phase 3** pour repartir des données
les plus fraîches (uploads produits ajoutés entretemps, etc.).

## Phase 2bis — Mu-plugins headless (déjà fait le 2026-09-14)

⚠️ **`back.` a été copié depuis les fichiers de PROD, qui n'a jamais eu les
mu-plugins Kinkyx** (développés uniquement sur dev). Sans eux, `back.` ne
peut pas servir de backend au front Astro (pas d'API compte/checkout, pas
de champs `lang`/`translations` exposés côté REST, etc.).

**9 fichiers à copier** (compte/checkout, i18n REST, images, fabcom, avis
Google, formulaires) :

```bash
ssh infomaniak "mkdir -p ~/sites/back.kinkyx-shop.com/wp-content/mu-plugins"
for f in kinkyx-account-api.php kinkyx-account-skin.php kinkyx-forms.php \
         kinkyx-google-reviews.php kinkyx-locale.php kinkyx-rest-fabcom.php \
         kinkyx-rest-images.php kinkyx-rest-lang.php kinkyx-rest-pages.php; do
  scp "infomaniak:~/sites/dev.kinkyx-shop.com/wp-content/mu-plugins/$f" \
      "infomaniak:~/sites/back.kinkyx-shop.com/wp-content/mu-plugins/$f"
done
ssh infomaniak "cd ~/sites/back.kinkyx-shop.com/wp-content/mu-plugins && for f in *.php; do php -l \$f; done"
ssh infomaniak "cd ~/sites/back.kinkyx-shop.com && wp eval 'echo \"ok\";'"  # pas de fatal
```

**⚠️ NE JAMAIS copier ces 5 fichiers présents sur dev** (vérifié un par un
via leur en-tête avant ce déploiement) :
- `zzz-dev-safety.php` — bloque **tous** les e-mails sortants et le cache.
  Copié sur back./prod, il couperait confirmations de commande, reset de
  mot de passe, etc.
- `kinkyx-translate.php` / `kinkyx-translate-2.php` — commandes WP-CLI
  DeepL, explicitement « (DEV only) » dans leur propre en-tête.
- `kinkyx-templates.php` — explicitement « (DEV only) ».
- `kinkyx-i18n.php` — compagnon de l'ancien projet Polylang (superseded,
  voir mémoire `kinkyx-multilingual-project`), sans rapport avec le front
  headless.

Vérifié 2026-09-14 : `curl https://back.kinkyx-shop.com/wp-json/` liste bien
le namespace `kinkyx/v1` ; Store API répond (`Tanga Latex` confirmé présent
dans le vrai catalogue prod, contrairement à dev — cf. Phase 6).

Pour tester le fetch du catalogue (`wc/v3`, authentifié) contre `back.`
avant la vraie bascule, générer une clé REST **lecture seule** dédiée :
wp-admin de `back.` → WooCommerce → Réglages → Avancé → API REST → Ajouter
une clé (ne pas réutiliser les clés existantes trouvées sur prod —
`TrackShip`, `WooCommerce By Meta`, `TikTok` — qui sont en `read_write` et
appartiennent à d'autres intégrations).

## Phase 3 — Bascule DNS `www.` → front Astro ⚠️ IRRÉVERSIBLE EN L'ÉTAT

**C'est le vrai instant de bascule du trafic public.** À partir d'ici, les
visiteurs de `www.kinkyx-shop.com` voient le nouveau site.

- [ ] Dans le Manager Infomaniak : le site Node.js qui sert déjà
      `front.kinkyx-shop.com` doit reprendre `www.kinkyx-shop.com` (+
      l'apex `kinkyx-shop.com` s'il existe) — ajout de domaine sur le site
      Node existant, ou renommage selon ce que permet l'interface.
- [ ] Vérifier que le certificat SSL suit (Infomaniak le gère normalement
      automatiquement dès qu'un domaine est rattaché).
- [ ] Variables d'environnement du Builder à mettre à jour AVANT de rebasculer
      le DNS si possible, sinon juste après (voir Phase 5) :
      `PUBLIC_SITE_URL=https://www.kinkyx-shop.com`,
      `PUBLIC_CHECKOUT_URL=https://back.kinkyx-shop.com`,
      retirer `SITE_BASIC_AUTH` (back. n'a pas de htpasswd),
      retirer `PUBLIC_NOINDEX`.
- [ ] `npm run build` (fetch complet, catalogue tiré depuis `back.` — donc
      **doit être fait après la Phase 4**, pas avant) puis redémarrage.

**Rollback possible tant que l'ancien WP tourne encore sous `www.` en
parallèle** (repointer le DNS en arrière) — mais dès que la Phase 4 démarre
sur la base partagée, un rollback propre demande de restaurer la sauvegarde
de la Phase 1.

## Phase 4 — Migration d'URL en base ⚠️ TOUCHE LA BASE DE PROD

Depuis `back.` (la base est partagée avec prod à ce stade, donc peu importe
lequel des deux WP-CLI l'exécute — mais `back.` est plus sûr, ça évite toute
ambiguïté si le DNS de `www.` a déjà basculé) :

```bash
# 1. Dry-run d'abord — vérifier le nombre de remplacements annoncé, doit
#    être un chiffre cohérent (plusieurs milliers, vu la taille du catalogue)
ssh infomaniak "cd ~/sites/back.kinkyx-shop.com && wp search-replace \
  'https://www.kinkyx-shop.com' 'https://back.kinkyx-shop.com' \
  --all-tables --precise --skip-columns=guid --dry-run"

# 2. Si le compte semble cohérent, sans --dry-run
ssh infomaniak "cd ~/sites/back.kinkyx-shop.com && wp search-replace \
  'https://www.kinkyx-shop.com' 'https://back.kinkyx-shop.com' \
  --all-tables --precise --skip-columns=guid"

# 3. Vérifier
ssh infomaniak "cd ~/sites/back.kinkyx-shop.com && wp option get siteurl && wp option get home"
```

`--skip-columns=guid` : ne pas réécrire les GUID des posts (WordPress
déconseille de les changer, ils ne doivent pas être des URLs "vivantes").
`--precise` : gère correctement les données PHP sérialisées (adresses,
paramètres WooCommerce, etc.) — sans ça, un remplacement naïf de chaîne
corromprait ces valeurs.

## Phase 5 — dernier réglage mu-plugin sur back.

Les 9 mu-plugins sont déjà déployés (Phase 2bis). Il reste un seul
changement : `kx_front_url()` dans `kinkyx-account-skin.php` (et partagé
via `function_exists()` dans les autres mu-plugins) doit renvoyer
`https://www.kinkyx-shop.com` au lieu de `https://front.kinkyx-shop.com`
une fois que `www.` sert réellement le nouveau front (Phase 3 faite).

```bash
# éditer la ligne par défaut de kx_front_url() puis redéployer :
scp kinkyx-account-skin.php infomaniak:~/sites/back.kinkyx-shop.com/wp-content/mu-plugins/kinkyx-account-skin.php
ssh infomaniak "cd ~/sites/back.kinkyx-shop.com && wp eval 'echo \"ok\";'"  # vérifie l'absence de fatal
```

Vérifier aussi que les 5 pages brouillon ARMember (26338-26342, cf.
`kinkyx-refonte-headless.md`) sont bien passées en `draft` et n'ont pas
resurgi avec la copie.

## Phase 6 — Nettoyage

- [ ] **htpasswd** : confirmer que `back.kinkyx-shop.com` n'en a pas
      (sinon le webhook Stripe reste bloqué comme sur dev — voir l'incident
      documenté dans `kinkyx-refonte-headless.md`, section P1-C).
- [ ] **Webhook Stripe** : dans le Stripe Dashboard, mettre à jour l'URL de
      l'endpoint vers `https://back.kinkyx-shop.com/?wc-api=wc_stripe` (ou
      recréer l'endpoint) — l'ancien pointait vers `www.`, qui ne sert plus
      WordPress.
- [ ] **Passerelle `cheque`** (paiement de test préprod) :
      `wp wc payment_gateway update cheque --enabled=false --path=...`
- [ ] **Table de redirections** — la régénérer contre les vraies données
      prod maintenant que `back.` en dispose :
      ```bash
      cd kinkyx-front && WOO_API_URL="https://back.kinkyx-shop.com/wp-json" \
        WOO_CONSUMER_KEY="<clé prod>" WOO_CONSUMER_SECRET="<secret prod>" \
        node scripts/build-redirects.mjs
      ```
      (générer des clés REST WooCommerce en lecture sur `back.` si pas déjà
      fait : WooCommerce → Réglages → Avancé → API REST). Vérifier le
      rapport d'appariement (attendu : très proche de 250/250 + 40/40, cf.
      session du 2026-09-14) — en particulier confirmer le sort du produit
      « Tanga Latex » (`/latex/femme/tanga-latex/`), signalé comme encore en
      vente mais absent du catalogue dev au moment du premier passage.
      Commit + push + déployer sur le Builder.
- [ ] **Ancien WP sous `www.`** : une fois `www.` sert le front Astro,
      s'assurer qu'aucune configuration Infomaniak ne fait encore tourner
      l'ancienne app WP en parallèle sur ce domaine (risque de confusion /
      double-service). Si l'ancien site Infomaniak `www.kinkyx-shop.com`
      existe encore séparément de `back.`, le désactiver ou le renommer
      clairement (ex. `old-www-do-not-use`) plutôt que le supprimer tout de
      suite (garder un filet de secours quelques semaines).

## Phase 7 — Vérification post-bascule

- [ ] Parcours complet en conditions réelles : accueil, catégorie, fiche
      produit (simple + variable), panier, compte (inscription/connexion),
      checkout (carte simple + 3DS), confirmation, e-mails WooCommerce
      (commande, mot de passe oublié) en FR/EN/DE.
- [ ] Quelques anciennes URLs testées manuellement (produit, catégorie,
      `/boutique/`, `/en/...`, `/de/...`) → redirection 301 vers la bonne
      nouvelle URL.
- [ ] Google Search Console : soumettre le nouveau sitemap (FR+EN+DE),
      garder l'ancienne propriété active pour suivre la transition des
      redirections.
- [ ] Surveillance crawl/rankings/erreurs 404 sur 4 à 8 semaines — ajouter
      des redirections ponctuelles pour toute URL ancienne encore visitée
      qui aurait été oubliée dans la table (cas réaliste vu l'historique du
      site : GTranslate, anciennes URLs de flux, etc.).
- [ ] Robots.txt / noindex : confirmer que `back.kinkyx-shop.com` n'est pas
      indexé (ajouter un `noindex` global si Infomaniak ne le fait pas déjà
      par défaut sur les domaines secondaires).

## Rollback

- **Avant la Phase 4** (DNS déjà basculé mais pas encore de search-replace) :
  repointer le DNS de `www.` vers l'ancien hébergement WP — aucune donnée
  n'a été modifiée, retour à l'état antérieur immédiat.
- **Après la Phase 4** : la base a été réécrite en place. Restaurer depuis
  la sauvegarde de la Phase 1 (`wp db import ~/backup-prod-*.sql`) sur
  `back.`, puis repointer le DNS de `www.` vers l'ancien hébergement WP
  (s'il est toujours disponible — d'où l'intérêt de ne pas le supprimer
  tout de suite en Phase 6).
- Dans tous les cas : les commandes passées pendant la fenêtre de bascule
  (entre la Phase 1 et la vérification finale) doivent être rapprochées
  manuellement après coup si un rollback base de données a lieu.

## Contexte détaillé

Voir la mémoire de session `kinkyx-refonte-headless` pour l'historique
complet (L0–L5, décision Phase 1/Phase 2 architecture, P1-A à P1-F,
diagnostic du timeout Googlebot, rotation des clés Stripe).
