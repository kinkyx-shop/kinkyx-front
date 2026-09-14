# Bascule L6 — passage en production

Runbook pour faire passer `www.kinkyx-shop.com` du WordPress/Elementor actuel
vers ce front Astro headless, et déplacer WordPress vers
`back.kinkyx-shop.com` (moteur API pur : Stripe, commandes, stock,
facturation — inchangé).

**✅ BASCULE RÉALISÉE le 2026-09-14.** `www.kinkyx-shop.com` sert le front
Astro headless, branché sur `back.kinkyx-shop.com` comme backend WooCommerce.
Ce document reste comme trace de la procédure réellement suivie (avec ses
détours) et comme référence pour une éventuelle prochaine bascule de ce
type. Voir "Écarts réels vs plan" en bas de chaque phase concernée, et le
récapitulatif final tout en bas.

## État au 2026-09-14 (fin de session)

- [x] Front Astro feature-complete (L0–L5).
- [x] `back.kinkyx-shop.com` créé, fichiers+base copiés, mu-plugins déployés,
      table de redirections générée contre le vrai catalogue prod.
- [x] Clés Stripe live tournées.
- [x] **Phase 3 — DNS/domaine** : `www.kinkyx-shop.com` délié de l'ancien
      site WordPress et rattaché au site Node.js `front.kinkyx-shop.com`.
- [x] **Phase 4 — Migration d'URL** : `wp search-replace` appliqué sur la
      base partagée (6233 remplacements), `siteurl`/`home` = `back.`.
- [x] **Phase 5 — mu-plugins** : `kx_front_url()` mis à jour vers `www.`
      dans **deux** fichiers (voir écarts ci-dessous).
- [x] **Phase 6 — nettoyage** : passerelle `cheque` désactivée, absence de
      htpasswd sur `back.` reconfirmée. **Webhook Stripe : à vérifier que
      l'utilisateur a bien mis à jour l'URL dans le Dashboard Stripe** (pas
      re-confirmé dans cette session après la demande).
- [x] **Phase 7 — vérification** : redirections testées OK, pages produit
      OK, robots.txt sans noindex, sitemap 200, compte 200.
- [x] **Webhook Stripe confirmé fonctionnel** : URL mise à jour par
      l'utilisateur, testé via "Envoyer un événement de test" dans le
      Stripe Dashboard → `checkout.session.expired` livré avec 200 OK.
- [x] **🔴 BUG CRITIQUE trouvé et corrigé APRÈS la bascule** : tous les
      produits à variations (247/250 du catalogue) étaient **invendables**
      — `wp_json` products lang="" au lieu de "fr" sur back. (Polylang
      jamais configuré sur les vrais produits prod, contrairement à dev).
      Le filtre strict `p.lang === "fr"` dans `fetch-catalog.mjs` ne
      trouvait donc aucun produit variable → 0 variations récupérées →
      "Attributs manquants pour le produit variable" sur tout achat de
      produit à variantes. Fix commit `288f57f` (fallback `!p.lang` → fr,
      même logique déjà utilisée ailleurs). Détecté ~40 min après la
      bascule via un test d'achat réel demandé par l'utilisateur — voir
      section dédiée en bas de ce document. **C'est un test d'achat réel
      qui a débusqué ce bug — aucune vérification automatisée ne l'aurait
      trouvé, puisque toutes les pages se généraient sans erreur.**
- [x] **🔴 2e BUG DE CONFIG trouvé et corrigé** : après le champ mot de
      passe ajouté au checkout, un vrai essai d'achat a échoué avec
      « Vous devez être identifié pour commander » —
      `woocommerce_rest_guest_checkout_disabled` (WC core). Cause : même
      motif que le bug précédent — `woocommerce_enable_signup_and_login_
      from_checkout` et `woocommerce_enable_myaccount_registration`
      avaient été passés à `yes` **sur dev uniquement**, lors de la
      session de retrait d'ARMember du 2026-09-07, jamais reporté sur la
      vraie base prod. Corrigé par `wp option update` (pas de code) sur
      `back.` ; `woocommerce_enable_guest_checkout` volontairement laissé
      à `no` (compte toujours obligatoire). **⚠️ ARMember reste actif sur
      prod** (contrairement à dev où il a été désactivé le 2026-09-07) —
      pas de casse observée pour l'instant, mais à garder en tête.
      **Leçon : tout réglage WordPress changé uniquement sur dev pendant
      les sessions précédentes est un candidat au même type de bug —
      vaudrait le coup d'auditer `wp_options` dev vs prod plutôt que
      d'attendre que chaque écart se révèle via un client réel.**
- [x] **✅ Parcours d'achat réel confirmé de bout en bout** : commande
      #51911, 10,10 €, statut `processing`, compte créé avec le mot de
      passe choisi par le client (`b2b@kinkyx-shop.com`), paiement Stripe
      réellement capturé (`_stripe_charge_captured=yes`, frais réels
      0,44 €). Carte sans 3DS déclenché (flux frictionless) — le 3DS avait
      déjà été validé séparément en préprod (session du 2026-09-11) et
      techniquement re-vérifié après la bascule (fragment + confirmCardPayment
      + webhook, cf. plus haut) ; un vrai paiement 3DS post-bascule n'a pas
      spécifiquement été rejoué, risque jugé faible vu tout le reste déjà
      validé.
- [ ] E-mails transactionnels : pas revérifiés après la migration d'URL.
- [ ] Recherche Google Search Console : nouveau sitemap pas encore soumis.
- [ ] Surveillance crawl/rankings 4-8 semaines : à démarrer.
- [ ] Ancien site WordPress `www.kinkyx-shop.com` (fichiers+DB) laissé tel
      quel sur Infomaniak (juste délié du domaine, pas supprimé) — filet de
      secours ; à retirer plus tard une fois la bascule confirmée stable.

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

## Phase 3 — Bascule DNS `www.` → front Astro ⚠️ IRRÉVERSIBLE EN L'ÉTAT — ✅ FAIT

**C'est le vrai instant de bascule du trafic public.** À partir d'ici, les
visiteurs de `www.kinkyx-shop.com` voient le nouveau site.

- [x] Dans le Manager Infomaniak : le site Node.js qui sert déjà
      `front.kinkyx-shop.com` doit reprendre `www.kinkyx-shop.com` (+
      l'apex `kinkyx-shop.com` s'il existe) — ajout de domaine sur le site
      Node existant, ou renommage selon ce que permet l'interface.
- [x] Vérifier que le certificat SSL suit (Infomaniak le gère normalement
      automatiquement dès qu'un domaine est rattaché).
- [x] Variables d'environnement du Builder à mettre à jour AVANT de rebasculer
      le DNS si possible, sinon juste après (voir Phase 5) :
      `PUBLIC_SITE_URL=https://www.kinkyx-shop.com`,
      `PUBLIC_CHECKOUT_URL=https://back.kinkyx-shop.com`,
      retirer `SITE_BASIC_AUTH` (back. n'a pas de htpasswd),
      retirer `PUBLIC_NOINDEX`.
- [x] `npm run build` (fetch complet, catalogue tiré depuis `back.` — donc
      **doit être fait après la Phase 4**, pas avant) puis redémarrage.

**Rollback possible tant que l'ancien WP tourne encore sous `www.` en
parallèle** (repointer le DNS en arrière) — mais dès que la Phase 4 démarre
sur la base partagée, un rollback propre demande de restaurer la sauvegarde
de la Phase 1.

### Écarts réels vs plan (2026-09-14)

- **"Ajouter www. au site Node." a échoué au premier essai** : Infomaniak
  refuse d'attacher un domaine déjà lié à un autre produit
  ("Le domaine est déjà lié à un produit du même type"). Il n'existe pas
  de fonction "déplacer/transférer" directe dans l'UI testée. La vraie
  procédure, trouvée par tâtonnement puis confirmée par la doc Infomaniak
  ([Unlink a domain](https://www.infomaniak.com/en/support/faq/1997/unlink-a-domain-name-linked-to-the-website)) :
  1. Sur la fiche du site WordPress (`www.kinkyx-shop.com` dans Hébergement),
     bouton **"Gérer" (en haut à droite) → "Retirer le site"**.
  2. Une boîte de dialogue précise clairement : *"Le domaine ne sera plus
     lié au contenu de votre site mais restera actif sous votre gestion"*
     et *"Les fichiers et bases de données liés à ce site ne seront pas
     supprimés"* — avec une case **séparée et décochée par défaut**
     "Supprimer les fichiers et base de données des CMS" qu'il ne faut
     **surtout pas cocher** (elle supprimerait la base partagée avec
     `back.` !). Cocher seulement "J'ai pris connaissance..." puis Retirer.
  3. Le domaine devient alors libre (plus aucun enregistrement DNS le
     temps de quelques minutes — coupure courte et normale) et peut être
     ajouté au site Node.js via son propre "+" domaines.
  - Pistes explorées et **écartées** en cours de route : le petit menu ⋮ à
    côté de chaque domaine dans l'encart "domaines" d'une fiche de site
    (la doc Infomaniak mentionne un "Délier" à cet endroit, mais il
    n'apparaissait pas dans l'UI observée ce jour-là — seulement "Voir le
    site"/"Gérer le certificat") ; le menu ⋮ de la liste globale "Site Web"
    (option "Délier le site" — action différente, probablement liée au
    groupement de projet, pas testée par prudence) ; éditer la zone DNS
    directement (ne suffit probablement pas, le routage domaine→site est
    piloté par l'attachement au niveau produit, pas juste par le DNS).
- **`.env` du Builder** : un collage multi-lignes (heredoc `cat > .env <<
  EOF`) a été cassé par le mode "bracketed paste" du terminal SSH du
  Builder (préfixe `^[[200~` interprété comme début de commande) — la
  redirection `>` a quand même vidé le fichier avant que la commande
  échoue, laissant `.env` vide un instant. Sans conséquence (le process
  Node tournant utilisait encore l'ancien `.env` chargé en mémoire), mais
  **préférer une série de commandes `echo 'LIGNE' >> .env` une par une**
  plutôt qu'un heredoc multi-lignes dans ce terminal spécifique.
- **`git pull` oublié avant le premier `npm run build`** : le Builder est
  resté 4 commits en retard (manquait toute la table de redirections) —
  le premier build après la bascule DNS a tourné sans les redirections.
  Corrigé par un second `git pull && npm run build` + redémarrage.
  **Toujours vérifier `git log -1 --oneline` avant un build de bascule.**

## Phase 4 — Migration d'URL en base ⚠️ TOUCHE LA BASE DE PROD — ✅ FAIT

**6233 remplacements appliqués le 2026-09-14**, `siteurl`/`home` confirmés
sur `https://back.kinkyx-shop.com`, WP démarre sans erreur après coup.


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

## Phase 5 — dernier réglage mu-plugin sur back. — ✅ FAIT

⚠️ **`kx_front_url()` est défini dans DEUX fichiers**, chacun avec sa
propre valeur par défaut codée en dur, tous deux protégés par
`function_exists()` — **`kinkyx-account-api.php` ET
`kinkyx-account-skin.php`**. Comme `kinkyx-account-api.php` charge en
premier par ordre alphabétique, c'est SA valeur par défaut qui gagne : la
modifier seulement dans `kinkyx-account-skin.php` n'a visiblement aucun
effet (vérifié : `wp eval 'echo kx_front_url();'` continuait à renvoyer
l'ancienne valeur après édition + `opcache_reset()`, jusqu'à corriger
aussi `kinkyx-account-api.php`). **C'est la récidive exacte d'un incident
déjà documenté le 2026-09-11** (voir `kinkyx-refonte-headless.md`,
section P1-A/B) — leçon qui n'avait pas été suffisamment généralisée dans
ce runbook la première fois.

```bash
ssh infomaniak "sed -i 's#https://front.kinkyx-shop.com#https://www.kinkyx-shop.com#' \
  ~/sites/back.kinkyx-shop.com/wp-content/mu-plugins/kinkyx-account-skin.php \
  ~/sites/back.kinkyx-shop.com/wp-content/mu-plugins/kinkyx-account-api.php"
ssh infomaniak "php -l ~/sites/back.kinkyx-shop.com/wp-content/mu-plugins/kinkyx-account-skin.php \
  && php -l ~/sites/back.kinkyx-shop.com/wp-content/mu-plugins/kinkyx-account-api.php"
ssh infomaniak "cd ~/sites/back.kinkyx-shop.com && wp eval 'echo kx_front_url();'"  # doit afficher www.kinkyx-shop.com
```

Vérifier aussi que les 5 pages brouillon ARMember (26338-26342, cf.
`kinkyx-refonte-headless.md`) sont bien passées en `draft` et n'ont pas
resurgi avec la copie — **pas revérifié dans cette session, à faire**.

## Phase 6 — Nettoyage

- [x] **htpasswd** : confirmé absent sur `back.` (`curl -X POST
      https://back.kinkyx-shop.com/?wc-api=wc_stripe` → 204 sans auth).
- [ ] **Webhook Stripe** : demandé à l'utilisateur de mettre à jour l'URL de
      l'endpoint vers `https://back.kinkyx-shop.com/?wc-api=wc_stripe` dans
      le Stripe Dashboard — **pas reconfirmé fait dans cette session**, à
      vérifier avant de considérer le 3DS pleinement opérationnel en prod
      (sinon les paiements 3DS resteront `pending` côté WooCommerce, comme
      sur dev à l'époque du htpasswd).
- [x] **Passerelle `cheque`** désactivée.
- [x] **Table de redirections** — **déjà régénérée le 2026-09-14** contre
      le vrai catalogue prod via `back.` : 250/250 produits + 40/40
      catégories, zéro cas non résolu, « Tanga Latex » confirmé et
      correctement redirigé. Si le catalogue a changé de façon notable
      entretemps (nouveaux produits, catégories réorganisées), relancer :
      ```bash
      cd kinkyx-front && WOO_API_URL="https://back.kinkyx-shop.com/wp-json" \
        WOO_CONSUMER_KEY="<clé prod>" WOO_CONSUMER_SECRET="<secret prod>" \
        node scripts/build-redirects.mjs
      ```
      (clé REST WooCommerce dédiée en lecture seule, créée sur `back.` :
      WooCommerce → Réglages → Avancé → API REST — ne pas réutiliser les
      clés `TrackShip`/`WooCommerce By Meta`/`TikTok` déjà en place).
      Note technique : si le fetch échoue avec `ENOTFOUND` alors que le
      site répond bien en curl, c'est un souci de résolution DNS dual-stack
      local à la machine qui exécute le script (rencontré le 2026-09-14
      sur back. juste après sa création — contourné en forçant la
      résolution IPv6 dans Node ; probablement lié à la fraîcheur du DNS,
      à revérifier si ça se reproduit). Commit + push + déployer sur le
      Builder après toute régénération.
      **Même symptôme revu côté Builder le 2026-09-14** (pas juste ma
      machine) : un premier `npm run build` a échoué à joindre `back.`
      (`ping()` → repli Store API → clés jugées manquantes → catalogue
      stub, bandeau "catalogue non chargé" visible en prod, seulement
      36 pages construites au lieu de 930) alors que `.env` était
      pourtant correct et qu'un appel `curl` identique depuis un autre
      poste répondait 200 sans souci. **Un simple second `npm run build`
      a suffi** (DNS/réseau transitoire, pas un vrai problème de config).
      Si un build de `back.` tourne étrangement court juste après une
      création/modification DNS récente sur ce domaine, vérifier le
      nombre de pages annoncé et relancer avant de chercher plus loin.
- [x] **Ancien WP sous `www.`** : traité de facto par la manip de la Phase 3
      — "Retirer le site" a délié `www.` de l'ancien produit WordPress sans
      supprimer ses fichiers/base (choix explicite : case de suppression
      laissée décochée). L'ancien site existe donc encore sur Infomaniak
      (fichiers + accès à la même base) mais n'est plus rattaché à aucun
      domaine public — filet de secours conservé intentionnellement.

## Phase 7 — Vérification post-bascule

- [x] Accueil, page produit (simple + variable "Tanga Latex"), page compte,
      sitemap, robots.txt (noindex bien retiré) — tous vérifiés 200/corrects
      juste après la bascule.
- [x] Anciennes URLs testées (produit, `/boutique/`) → 301 vers la bonne
      nouvelle URL ; vérifié aussi l'absence de boucle sur une URL de
      catégorie identique avant/après (`/latex/femme/`).
- [ ] **Parcours d'achat réel (carte + 3DS) PAS testé post-bascule** — le
      test 3DS complet avait été fait en préprod (session du 2026-09-11)
      contre dev, pas encore rejoué en conditions réelles contre `back.`
      avec la vraie clé Stripe live. À faire dès que possible, avec une
      carte réelle à faible montant (remboursable) plutôt qu'une carte de
      test (le mode live n'accepte plus les cartes de test Stripe).
- [ ] E-mails transactionnels (confirmation de commande, mot de passe
      oublié) pas revérifiés après la migration d'URL — les liens qu'ils
      contiennent doivent maintenant pointer vers les bonnes URLs (`back.`
      pour les liens WP natifs restants, front Astro pour le reste).
- [ ] Google Search Console : nouveau sitemap pas encore soumis.
- [ ] Surveillance crawl/rankings/erreurs 404 sur 4 à 8 semaines — pas
      démarrée (bascule trop récente).
- [ ] Robots.txt / noindex sur `back.kinkyx-shop.com` lui-même : pas
      vérifié si un noindex global y est nécessaire (domaine secondaire,
      ne devrait pas être découvert/indexé en pratique, mais à confirmer).

## Post-bascule : bug critique "produits à variations invendables"

Découvert le 2026-09-14, ~40 min après la bascule, en faisant un vrai test
d'achat à la demande de l'utilisateur (produit à variations "Body Kap").

**Symptôme** : sur tout produit à variations (247/250 du catalogue — quasi
tout le magasin), après avoir choisi couleur/taille, le bouton "Ajouter au
panier" renvoyait `{"code":"woocommerce_rest_missing_attributes",
"message":"Attributs manquants pour le produit variable."}`. Seuls les 3
produits simples du catalogue (accessoires latex comme "Shine latex") ont
continué à fonctionner — d'où l'importance d'avoir testé un vrai produit à
variations et pas seulement le premier produit simple venu.

**Cause** : `scripts/fetch-catalog.mjs` filtrait
`products.filter((p) => p.lang === "fr" && p.type === "variable")` avant
de récupérer les variations de chaque produit. Sur `back.` (le vrai prod),
Polylang est installé mais n'a **jamais été assigné aux vrais produits**
(contrairement à `dev`, où tout le travail multilingue antérieur — projet
séparé, jamais cutover — avait renseigné `lang` sur chaque post). Résultat
constaté : `GET /wp-json/wc/v3/products/31753` renvoyait `"lang":""` et non
`"lang":"fr"`. L'égalité stricte ne matchait donc **aucun** produit :
`→ Variations de 0 produits variables FR…`. La normalisation elle-même
(`normalize.mjs`, `groupByTranslation`) avait déjà un repli
`it.lang || "fr"` qui masquait le symptôme pour tout le reste du pipeline
(noms, prix, descriptions tous corrects) — seule la boucle de fetch des
variations n'avait pas ce repli, ce qui a rendu le bug invisible partout
sauf à l'usage réel du sélecteur de variante.

**Fix** (commit `288f57f`) : même repli appliqué au filtre —
`(p.lang === "fr" || !p.lang) && p.type === "variable"`.

**Leçon pour la suite** : ce genre de divergence de configuration entre
dev (préparé/testé pendant des semaines) et prod (jamais vraiment testé en
conditions de build réel avant ce jour) est exactement le risque d'une
bascule — **un test d'achat réel sur un produit représentatif du catalogue
(pas le produit le plus simple) est irremplaçable**, aucune vérification
automatisée de page ne l'aurait détecté puisque les 930 pages se
généraient et s'affichaient sans erreur. À garder en tête si d'autres
champs dépendant de Polylang (`translations`, contenu EN/DE) cachent des
divergences similaires dev/prod non encore détectées.

**Effet de bord connexe, non corrigé, distinct de ce bug** : comme prod
n'a aucune vraie traduction Polylang, les pages `/en/` et `/de/` affichent
actuellement le contenu **français** en repli (comportement voulu par
`normalize.mjs`, pas un bug), pas de vraies traductions EN/DE tant que
Polylang n'est pas configuré sur les vrais produits — ou tant qu'une autre
source de traduction n'est pas branchée.

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
