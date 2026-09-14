/**
 * Génère la table de redirections 301 « ancien site WordPress/Elementor »
 * → « nouveau front Astro headless », pour la bascule L6.
 *
 *   node --env-file-if-exists=.env scripts/build-redirects.mjs
 *
 * Source des anciennes URLs : sitemaps XML de www.kinkyx-shop.com (site en
 * ligne, réputés à jour) — collées en dur ci-dessous (relevées le 2026-09-14).
 * Source des nouvelles URLs : le catalogue construit à partir de dev
 * (clone fidèle de prod) via le même pipeline que `fetch-catalog.mjs`
 * (normalize.mjs expose `frPermalink` = permalien WooCommerce d'origine,
 * qui donne directement le chemin ancien sans deviner quoi que ce soit).
 *
 * ⚠️ Dev est un CLONE de prod, pas prod lui-même : ce tableau doit être
 * régénéré contre les vraies données prod juste avant la bascule réelle
 * (une fois les mu-plugins kinkyx-rest-* déployés sur back.kinkyx-shop.com).
 */

import { writeFile } from "node:fs/promises";
import { wcAll } from "../src/lib/woo.mjs";
import { normalize } from "./normalize.mjs";

const OLD_PRODUCT_URLS = ["https://www.kinkyx-shop.com/boutique/","https://www.kinkyx-shop.com/latex/femme/tanga-latex/","https://www.kinkyx-shop.com/latex/femme/lingerie/culotte-haute-latex/","https://www.kinkyx-shop.com/latex/homme/top/debardeur-latex-sportwear/","https://www.kinkyx-shop.com/latex/homme/chemise/chemise-latex-kinkyx/","https://www.kinkyx-shop.com/latex/homme/chemise/chemise-latex-surpiqure/","https://www.kinkyx-shop.com/chaussures/modele/botte/cuissardes-noeud-cuir-vegan/","https://www.kinkyx-shop.com/latex/perfect-shine-dry-storage-protection/","https://www.kinkyx-shop.com/latex/special-wash-latex-nettoyant/","https://www.kinkyx-shop.com/latex/talcum-powder-procure-une-facilite-de-glisse/","https://www.kinkyx-shop.com/latex/easy-glide-premium-pump-spray-latex-aide-a-lenfilage/","https://www.kinkyx-shop.com/latex/easy-glide-latex-aide-a-lenfilage/","https://www.kinkyx-shop.com/latex/latex-polish-perfect-shine-pump-spray/","https://www.kinkyx-shop.com/latex/begloss-wipe-latex-brillance/","https://www.kinkyx-shop.com/latex/easy-glide-begloss/","https://www.kinkyx-shop.com/latex/soutien-gorge-sun-boucle/","https://www.kinkyx-shop.com/latex/top-asy/","https://www.kinkyx-shop.com/latex/legging-croc/","https://www.kinkyx-shop.com/latex/combi-tailleur-latex/","https://www.kinkyx-shop.com/chaussures/bottines-brides-cloutee/","https://www.kinkyx-shop.com/chaussures/bottines-brides-chaines/","https://www.kinkyx-shop.com/chaussures/mules-strass-noires/","https://www.kinkyx-shop.com/chaussures/mules-strass-transparent/","https://www.kinkyx-shop.com/chaussures/sandales-strass-noir/","https://www.kinkyx-shop.com/chaussures/bottine-lanieres-strass/","https://www.kinkyx-shop.com/chaussures/sandales-strass-transparentes/","https://www.kinkyx-shop.com/latex/croctop-vm-latex/","https://www.kinkyx-shop.com/chaussures/mules-rouges/","https://www.kinkyx-shop.com/chaussures/mules-roses-2/","https://www.kinkyx-shop.com/chaussures/mules-blanches/","https://www.kinkyx-shop.com/chaussures/mules-caramel/","https://www.kinkyx-shop.com/chaussures/mules-noir-mat/","https://www.kinkyx-shop.com/chaussures/mules-noir-vernis/","https://www.kinkyx-shop.com/chaussures/bottine-ouverte-noir-vernis/","https://www.kinkyx-shop.com/chaussures/bottine-ouverte-2/","https://www.kinkyx-shop.com/chaussures/mules-plumes-roses/","https://www.kinkyx-shop.com/chaussures/mules-plumes-noires/","https://www.kinkyx-shop.com/latex/homme/top/debardeur-lana/","https://www.kinkyx-shop.com/chaussures/modele/botte/cuissardes-noeud-cuir-vegan-blanche/","https://www.kinkyx-shop.com/latex/legging-latex-joy/","https://www.kinkyx-shop.com/latex/veste-tailleur/","https://www.kinkyx-shop.com/latex/pantalon-tailleur-latex/","https://www.kinkyx-shop.com/latex/homme/top/bolero-latex/","https://www.kinkyx-shop.com/latex/homme/top/debardeur-latex/","https://www.kinkyx-shop.com/latex/body-petale-latex/","https://www.kinkyx-shop.com/latex/femme/legging/legging-latex-kinkyx/","https://www.kinkyx-shop.com/latex/homme/chemise/chemise-latex-dracula-2/","https://www.kinkyx-shop.com/chaussures/bottines-arlequin-noir-blanc/","https://www.kinkyx-shop.com/chaussures/botte-spider-noir/","https://www.kinkyx-shop.com/chaussures/botte-spider-lavande/","https://www.kinkyx-shop.com/chaussures/botte-rangers-chainettes/","https://www.kinkyx-shop.com/latex/femme/top-femme/top-latex-kinktop/","https://www.kinkyx-shop.com/latex/femme/jupe/jupe-latex-asy/","https://www.kinkyx-shop.com/latex/femme/robe/robe-latex-gala/","https://www.kinkyx-shop.com/chaussures/modele/cuissarde/cuissarde-talon-noir-vernis/","https://www.kinkyx-shop.com/latex/femme/robe/robe-latex-claudine/","https://www.kinkyx-shop.com/chaussures/rangers-coeur/","https://www.kinkyx-shop.com/chaussures/cuissarde-gothique-rouge/","https://www.kinkyx-shop.com/chaussures/cuissarde-gothique-noir-brillant/","https://www.kinkyx-shop.com/chaussures/cuissarde-gothique-noir/","https://www.kinkyx-shop.com/chaussures/botte-gothique-rose/","https://www.kinkyx-shop.com/chaussures/botte-gothique-noir-brillant/","https://www.kinkyx-shop.com/chaussures/botte-gothique-noir-mat/","https://www.kinkyx-shop.com/chaussures/bottines-arlequin-noir-rouge-2/","https://www.kinkyx-shop.com/chaussures/bottines-lanieres-noir-copie/","https://www.kinkyx-shop.com/chaussures/bottines-arlequin-noir-rouge/","https://www.kinkyx-shop.com/chaussures/bottines-cuir-noir/","https://www.kinkyx-shop.com/chaussures/bottine-ouverte/","https://www.kinkyx-shop.com/chaussures/bottines-lanieres/","https://www.kinkyx-shop.com/chaussures/bottines-camouflage-militaire/","https://www.kinkyx-shop.com/latex/femme/top-femme/top-latex-croc-manche-longue/","https://www.kinkyx-shop.com/latex/femme/top-femme/top-latex-joy/","https://www.kinkyx-shop.com/latex/femme/top-femme/top-latex-meg/","https://www.kinkyx-shop.com/latex/femme/top-femme/top-latex-gawa/","https://www.kinkyx-shop.com/latex/femme/top-femme/trench-bolero-trim/","https://www.kinkyx-shop.com/latex/femme/robe/robe-latex-lana/","https://www.kinkyx-shop.com/latex/femme/robe/robe-latex-gaga/","https://www.kinkyx-shop.com/latex/femme/robe/robe-latex-kill-bill/","https://www.kinkyx-shop.com/latex/femme/robe/robe-latex-vamp/","https://www.kinkyx-shop.com/chaussures/modele/cuissarde/cuissarde-talon-noir-mat/","https://www.kinkyx-shop.com/chaussures/modele/botte/bottes-genouilleres-vegan/","https://www.kinkyx-shop.com/chaussures/modele/botte/cuissardes-noeud-cuir-vegan-noir-mat/","https://www.kinkyx-shop.com/chaussures/style/cosplay/cuissardes-hologramme/","https://www.kinkyx-shop.com/chaussures/style/cosplay/cuissardes-hologramme-rose/","https://www.kinkyx-shop.com/chaussures/style/cosplay/cuissardes-hologramme-rouge/","https://www.kinkyx-shop.com/chaussures/style/cosplay/cuissardes-hologramme-blanche/","https://www.kinkyx-shop.com/chaussures/style/casual/cuissardes-lanieres/","https://www.kinkyx-shop.com/chaussures/style/casual/cuissardes-lanieres-2/","https://www.kinkyx-shop.com/chaussures/marque/pleaser/sandales-arc-en-ciel-2/","https://www.kinkyx-shop.com/chaussures/modele/cuissarde/cuissarde-lanieres/","https://www.kinkyx-shop.com/chaussures/marque/pleaser/botte-talon-tete-de-mort/","https://www.kinkyx-shop.com/chaussures/modele/botte/botte-noire-mat-boucles/","https://www.kinkyx-shop.com/chaussures/modele/botte/botte-compense-noire-brillant/","https://www.kinkyx-shop.com/chaussures/modele/botte/botte-compense-noire-mat/","https://www.kinkyx-shop.com/chaussures/modele/botte/botte-compense-blanche/","https://www.kinkyx-shop.com/latex/express/femme-express/blazer-kinkyx-s-jaune/","https://www.kinkyx-shop.com/latex/femme/body/body-kap-2/","https://www.kinkyx-shop.com/latex/femme/veste-femme/blazer-kinkyx/","https://www.kinkyx-shop.com/chaussures/style/casual/lolita-compensees-noire-demoniacult/","https://www.kinkyx-shop.com/latex/homme/veste/jacket-kinkyx/","https://www.kinkyx-shop.com/latex/homme/pantalon/jeans-latex-surpiqure/","https://www.kinkyx-shop.com/chaussures/modele/bottine/bottine-sans-talon-noir-vernis/","https://www.kinkyx-shop.com/chaussures/modele/bottine/bottines-blanches/","https://www.kinkyx-shop.com/chaussures/modele/bottine/bottine-plateforme/","https://www.kinkyx-shop.com/chaussures/modele/bottine/bottine-compensee-cuir-vegan/","https://www.kinkyx-shop.com/chaussures/modele/bottine/bottine-gothique-cuir-vegan/","https://www.kinkyx-shop.com/chaussures/modele/botte/bottes-gothiques/","https://www.kinkyx-shop.com/chaussures/modele/botte/bottes-a-lacet/","https://www.kinkyx-shop.com/chaussures/modele/botte/bottes-a-lacet-pleaser/","https://www.kinkyx-shop.com/chaussures/modele/cuissarde/bottes-cuissarde-talon/","https://www.kinkyx-shop.com/latex/femme/jupe/jupe-latex-poca/","https://www.kinkyx-shop.com/latex/femme/jupe/jupe-latex-triplekap/","https://www.kinkyx-shop.com/latex/accessoires/harnais/harnais-latex-bow/","https://www.kinkyx-shop.com/chaussures/modele/bottine/bottines-plateforme-vernis-noir/","https://www.kinkyx-shop.com/chaussures/modele/bottine/bottines-plateforme-rouge/","https://www.kinkyx-shop.com/chaussures/modele/bottine/bottines-plateforme-pink-white/","https://www.kinkyx-shop.com/chaussures/modele/bottine/bottines-plateforme-orange/","https://www.kinkyx-shop.com/chaussures/modele/bottine/bottines-plateforme-pink/","https://www.kinkyx-shop.com/chaussures/modele/bottine/bottines-plateforme-noir-mat/","https://www.kinkyx-shop.com/chaussures/modele/bottine/bottines-plateforme-noir-matte/","https://www.kinkyx-shop.com/chaussures/modele/bottine/bottines-plateforme-creme/","https://www.kinkyx-shop.com/chaussures/modele/bottine/bottines-plateforme-chocolat-vernis/","https://www.kinkyx-shop.com/chaussures/modele/bottine/bottines-plateforme-cerise/","https://www.kinkyx-shop.com/chaussures/modele/bottine/bottines-plateforme-blanche/","https://www.kinkyx-shop.com/chaussures/modele/bottine/bottines-pailettes-6/","https://www.kinkyx-shop.com/chaussures/modele/bottine/bottines-pailettes-7/","https://www.kinkyx-shop.com/chaussures/modele/bottine/bottines-pailettes-8/","https://www.kinkyx-shop.com/chaussures/modele/bottine/bottines-pailettes-4/","https://www.kinkyx-shop.com/chaussures/modele/bottine/bottines-pailettes-5/","https://www.kinkyx-shop.com/chaussures/modele/bottine/bottines-pailettes-2/","https://www.kinkyx-shop.com/chaussures/modele/bottine/bottines-pailettes-3/","https://www.kinkyx-shop.com/chaussures/modele/bottine/bottines-pailettes/","https://www.kinkyx-shop.com/chaussures/modele/bottine/bottines-ouvertes-7/","https://www.kinkyx-shop.com/chaussures/modele/bottine/bottines-ouvertes-6/","https://www.kinkyx-shop.com/chaussures/modele/bottine/bottines-ouvertes/","https://www.kinkyx-shop.com/chaussures/modele/bottine/bottines-ouvertes-2/","https://www.kinkyx-shop.com/chaussures/modele/bottine/bottines-ouvertes-4/","https://www.kinkyx-shop.com/chaussures/modele/bottine/bottines-ouvertes-5/","https://www.kinkyx-shop.com/chaussures/modele/bottine/bottines-noir-chaines/","https://www.kinkyx-shop.com/chaussures/modele/bottine/bottines-hautes-plateforme-rouge/","https://www.kinkyx-shop.com/chaussures/modele/bottine/bottines-noires-vernis/","https://www.kinkyx-shop.com/chaussures/modele/bottine/bottines-noire-steampunk/","https://www.kinkyx-shop.com/chaussures/modele/bottine/bottines-noires-avec-corsage/","https://www.kinkyx-shop.com/chaussures/modele/bottine/bottines-hautes-plateforme-noir-pleaser/","https://www.kinkyx-shop.com/chaussures/modele/bottine/bottines-hautes-plateforme-fushia-pleaser/","https://www.kinkyx-shop.com/chaussures/modele/bottine/bottines-hautes-plateforme-bleu/","https://www.kinkyx-shop.com/chaussures/modele/bottine/bottines-hautes-plateforme-creme/","https://www.kinkyx-shop.com/chaussures/modele/bottine/bottines-hautes-plateforme-blanc-pleaser/","https://www.kinkyx-shop.com/chaussures/modele/bottine/bottines-domina-noire-brillant/","https://www.kinkyx-shop.com/chaussures/modele/bottine/bottines-domina-rose/","https://www.kinkyx-shop.com/chaussures/modele/bottine/bottines-compensees-noire/","https://www.kinkyx-shop.com/chaussures/modele/bottine/bottines-dentelles-corsages/","https://www.kinkyx-shop.com/chaussures/modele/bottine/bottines-blanches-boucles/","https://www.kinkyx-shop.com/latex/shine-latex-kinkyx-30ml/","https://www.kinkyx-shop.com/chaussures/style/casual/escarpins-bride-noir-pleaser/","https://www.kinkyx-shop.com/chaussures/style/casual/escarpins-bride-rose-pleaser/","https://www.kinkyx-shop.com/chaussures/style/casual/escapins-dentelles-noir-gothic/","https://www.kinkyx-shop.com/chaussures/style/casual/escarpins-bride-blanc-pleaser/","https://www.kinkyx-shop.com/chaussures/modele/cuissarde/cuissarde-talon-haut-rouge/","https://www.kinkyx-shop.com/chaussures/modele/cuissarde/cuissarde-talon-haut-noir-vernis/","https://www.kinkyx-shop.com/chaussures/modele/cuissarde/cuissarde-talon-blanc/","https://www.kinkyx-shop.com/chaussures/style/casual/cuissardes-lycra-lacage/","https://www.kinkyx-shop.com/chaussures/marque/pleaser/cuissarde-talon-tete-de-mort/","https://www.kinkyx-shop.com/chaussures/modele/cuissarde/cuissarde-talon-rouge/","https://www.kinkyx-shop.com/chaussures/modele/bottine/bottines-spider-noire/","https://www.kinkyx-shop.com/chaussures/modele/bottine/bottines-rangers-noir/","https://www.kinkyx-shop.com/chaussures/modele/bottine/bottines-punk-noires/","https://www.kinkyx-shop.com/latex/express/femme-express/jupe-latex-flying-s-noir/","https://www.kinkyx-shop.com/latex/accessoires/harnais/harnais-latex-vladimir/","https://www.kinkyx-shop.com/latex/accessoires/harnais/harnais-latex-steampunk/","https://www.kinkyx-shop.com/latex/express/accessoires-express/harnais-latex-spirit-t1-noir-couleur-argent/","https://www.kinkyx-shop.com/latex/accessoires/harnais/harnais-latex-spirit/","https://www.kinkyx-shop.com/latex/accessoires/harnais/harnais-latex-mixt/","https://www.kinkyx-shop.com/latex/accessoires/harnais/harnais-latex-louve/","https://www.kinkyx-shop.com/latex/accessoires/harnais/harnais-latex-lightness/","https://www.kinkyx-shop.com/latex/accessoires/harnais/harnais-latex-liberty/","https://www.kinkyx-shop.com/latex/accessoires/harnais/harnais-latex-ko/","https://www.kinkyx-shop.com/latex/accessoires/harnais/harnais-latex-guest/","https://www.kinkyx-shop.com/latex/accessoires/harnais/harnais-latex-gawa/","https://www.kinkyx-shop.com/latex/accessoires/harnais/harnais-latex-gawa-simply/","https://www.kinkyx-shop.com/latex/express/accessoires-express/harnais-latex-poca-t1-bleu-clair/","https://www.kinkyx-shop.com/latex/express/accessoires-express/harnais-latex-poca-t1-noir/","https://www.kinkyx-shop.com/latex/express/accessoires-express/harnais-latex-poca-t1-rouge/","https://www.kinkyx-shop.com/latex/accessoires/harnais/harnais-latex-lolypop/","https://www.kinkyx-shop.com/latex/accessoires/harnais/harnais-latex-poca/","https://www.kinkyx-shop.com/latex/femme/jupe/jupe-latex-crayon/","https://www.kinkyx-shop.com/latex/femme/jupe/jupe-latex-flying/","https://www.kinkyx-shop.com/latex/femme/jupe/jupe-latex-flying-longue/","https://www.kinkyx-shop.com/latex/femme/jupe/jupe-latex-louve/","https://www.kinkyx-shop.com/latex/express/femme-express/top-latex-kinktop-s-violet-metallique/","https://www.kinkyx-shop.com/latex/express/femme-express/jupe-latex-crayon-m-rouge/","https://www.kinkyx-shop.com/latex/express/femme-express/jupe-latex-crayon-s-rouge/","https://www.kinkyx-shop.com/latex/express/femme-express/jupe-latex-flying-l-noir/","https://www.kinkyx-shop.com/latex/express/femme-express/jupe-latex-crayon-l-rouge/","https://www.kinkyx-shop.com/latex/express/femme-express/jupe-latex-flying-m-noir/","https://www.kinkyx-shop.com/latex/accessoires/harnais/harnais-latex-biky/","https://www.kinkyx-shop.com/latex/accessoires/harnais/harnais-latex-hope/","https://www.kinkyx-shop.com/chaussures/modele/escarpin/escarpin-plateforme-ouvert-pleaser/","https://www.kinkyx-shop.com/chaussures/modele/escarpin/escarpins-plateforme-noir-brillant/","https://www.kinkyx-shop.com/chaussures/modele/escarpin/escarpins-noir-brillant-pleaser/","https://www.kinkyx-shop.com/chaussures/marque/demoniacult/escarpin-lanieres-bat-cuir-noir/","https://www.kinkyx-shop.com/chaussures/marque/demoniacult/escarpin-lanieres-bat-demoniacult/","https://www.kinkyx-shop.com/chaussures/marque/demoniacult/escarpin-steampunk-dentelle-noir-demoniacult/","https://www.kinkyx-shop.com/chaussures/style/casual/escarpins-bride-rouge-pleaser/","https://www.kinkyx-shop.com/chaussures/marque/devious/escarpins-haut-noir-brillant-pleaser/","https://www.kinkyx-shop.com/chaussures/marque/devious/escarpins-haut-rouge-brillant/","https://www.kinkyx-shop.com/chaussures/style/casual/mule-simply-plateau-noir-pleaser/","https://www.kinkyx-shop.com/chaussures/style/casual/mule-simply-plateau-rouge-pleaser/","https://www.kinkyx-shop.com/chaussures/style/casual/mule-simply-plateau-blanche-pleaser/","https://www.kinkyx-shop.com/chaussures/style/casual/mule-simply-plateau-chrome/","https://www.kinkyx-shop.com/chaussures/style/casual/mule-simply-plateau-strasse/","https://www.kinkyx-shop.com/chaussures/style/casual/mule-simply-plateau-rose-rouge/","https://www.kinkyx-shop.com/chaussures/style/casual/mule-simply-plateau-rose-pink-pleaser/","https://www.kinkyx-shop.com/chaussures/style/casual/mule-simply-plateau-transparente-pleaser/","https://www.kinkyx-shop.com/chaussures/style/casual/mules-noir-avec-strass-pleaser/","https://www.kinkyx-shop.com/chaussures/style/casual/mules-transparente-avec-strass-pleaser/","https://www.kinkyx-shop.com/chaussures/style/grande-taille/sandales-harnais-boucle-pleaser/","https://www.kinkyx-shop.com/chaussures/style/grande-taille/sandales-harnais-noir-brillant/","https://www.kinkyx-shop.com/chaussures/marque/pleaser/sandales-tete-de-mort-rouge/","https://www.kinkyx-shop.com/chaussures/marque/pleaser/sandales-tete-de-mort-or/","https://www.kinkyx-shop.com/chaussures/marque/pleaser/sandales-tete-de-mort-chrome/","https://www.kinkyx-shop.com/chaussures/marque/pleaser/sandales-tete-de-mort-bronze/","https://www.kinkyx-shop.com/chaussures/marque/pleaser/sandales-tete-de-mort-transparente/","https://www.kinkyx-shop.com/chaussures/style/grande-taille/sandale-plateforme-noir-transparent-pleaser/","https://www.kinkyx-shop.com/chaussures/marque/pleaser/sandales-strass-noir-mat-pleaser/","https://www.kinkyx-shop.com/chaussures/marque/pleaser/sandale-bridde-noir-mat-pleaser/","https://www.kinkyx-shop.com/chaussures/style/casual/sandales-lanieres-noir-pleaser/","https://www.kinkyx-shop.com/chaussures/style/casual/sandales-lanieres-bordeaux-pleaser/","https://www.kinkyx-shop.com/chaussures/style/casual/sandales-plateforme-noir-brillant-pleaser/","https://www.kinkyx-shop.com/chaussures/style/casual/sandales-plateforme-noir-mat-pleaser/","https://www.kinkyx-shop.com/chaussures/style/casual/sandales-plateforme-rouge-pleaser/","https://www.kinkyx-shop.com/chaussures/style/casual/sandales-plateforme-blanche-pleaser/","https://www.kinkyx-shop.com/chaussures/style/casual/sandales-plateforme-creme/","https://www.kinkyx-shop.com/chaussures/style/casual/sandales-plateforme-rose-uv/","https://www.kinkyx-shop.com/chaussures/style/casual/sandales-plateforme-bride-noir-brillant-pleaser/","https://www.kinkyx-shop.com/chaussures/style/casual/sandales-plateforme-bride-noir-mat-pleaser/","https://www.kinkyx-shop.com/chaussures/style/casual/sandales-degrade-noir-rouge-pleaser/","https://www.kinkyx-shop.com/chaussures/marque/pleaser/sandales-rose-uv-transparente-pleaser/","https://www.kinkyx-shop.com/chaussures/style/casual/sandales-nu-pied-blanc-pleaser/","https://www.kinkyx-shop.com/chaussures/style/casual/sandales-chaines-pleaser/","https://www.kinkyx-shop.com/chaussures/style/casual/double-bride-pleaser/","https://www.kinkyx-shop.com/chaussures/style/casual/sandales-paillettes-noir-pleaser-shoes/","https://www.kinkyx-shop.com/chaussures/style/casual/sandales-paillettes-rouge-pleasers-shoes/","https://www.kinkyx-shop.com/chaussures/style/casual/sandales-kinkyx-noire-mate-pleaser-shoes/","https://www.kinkyx-shop.com/chaussures/style/casual/sandales-noire-transparente-pleaser/","https://www.kinkyx-shop.com/chaussures/style/casual/sandales-rouge-transparente-pleasers/","https://www.kinkyx-shop.com/chaussures/style/casual/sandales-plateformes-noir-rouge-pleaser/","https://www.kinkyx-shop.com/chaussures/marque/pleaser/sandales-rose-uv/","https://www.kinkyx-shop.com/chaussures/style/casual/sandale-plateforme-noir-chrome-pleaser/","https://www.kinkyx-shop.com/latex/shine-latex-kinkyx-50ml/","https://www.kinkyx-shop.com/non-classe/jupe-latex-kap/"];
const OLD_CATEGORY_URLS = ["https://www.kinkyx-shop.com/non-classe/","https://www.kinkyx-shop.com/latex/","https://www.kinkyx-shop.com/latex/homme/","https://www.kinkyx-shop.com/latex/homme/top/","https://www.kinkyx-shop.com/latex/homme/veste/","https://www.kinkyx-shop.com/chaussures/","https://www.kinkyx-shop.com/chaussures/marque/pleaser/","https://www.kinkyx-shop.com/chaussures/modele/bottine/","https://www.kinkyx-shop.com/latex/femme/","https://www.kinkyx-shop.com/latex/femme/top-femme/","https://www.kinkyx-shop.com/latex/express/femme-express/","https://www.kinkyx-shop.com/latex/accessoires/harnais/","https://www.kinkyx-shop.com/latex/express/accessoires-express/","https://www.kinkyx-shop.com/latex/femme/body/","https://www.kinkyx-shop.com/latex/femme/jupe/","https://www.kinkyx-shop.com/latex/femme/robe/","https://www.kinkyx-shop.com/latex/femme/legging/","https://www.kinkyx-shop.com/latex/femme/veste-femme/","https://www.kinkyx-shop.com/latex/homme/chemise/","https://www.kinkyx-shop.com/latex/homme/pantalon/","https://www.kinkyx-shop.com/chaussures/modele/cuissarde/","https://www.kinkyx-shop.com/chaussures/modele/botte/","https://www.kinkyx-shop.com/chaussures/style/cosplay/","https://www.kinkyx-shop.com/chaussures/marque/","https://www.kinkyx-shop.com/chaussures/style/cuir-vegan/","https://www.kinkyx-shop.com/chaussures/marque/demoniacult/","https://www.kinkyx-shop.com/chaussures/style/steampunk/","https://www.kinkyx-shop.com/chaussures/style/grande-taille/","https://www.kinkyx-shop.com/chaussures/style/casual/","https://www.kinkyx-shop.com/chaussures/style/sexy-glam/","https://www.kinkyx-shop.com/chaussures/marque/devious/","https://www.kinkyx-shop.com/chaussures/modele/escarpin/","https://www.kinkyx-shop.com/chaussures/modele/mule/","https://www.kinkyx-shop.com/chaussures/modele/sandale/","https://www.kinkyx-shop.com/chaussures/style/","https://www.kinkyx-shop.com/chaussures/modele/","https://www.kinkyx-shop.com/latex/femme/lingerie/","https://www.kinkyx-shop.com/latex/femme/combi/","https://www.kinkyx-shop.com/latex/pret-a-porter/","https://www.kinkyx-shop.com/soinsdulatex/"];
const OLD_BRAND_URLS = ["https://www.kinkyx-shop.com/marque/kinkyx-latex/","https://www.kinkyx-shop.com/marque/pleaser/","https://www.kinkyx-shop.com/marque/pleaser/pleaser-pleaser/","https://www.kinkyx-shop.com/marque/pleaser/demoniacult/","https://www.kinkyx-shop.com/marque/pleaser/fabulicious-pleaser/","https://www.kinkyx-shop.com/marque/begloss/"];
const OLD_PAGE_URLS = ["https://www.kinkyx-shop.com/","https://www.kinkyx-shop.com/de/","https://www.kinkyx-shop.com/en/","https://www.kinkyx-shop.com/shooting/","https://www.kinkyx-shop.com/guide-des-tailles/","https://www.kinkyx-shop.com/revendeur/","https://www.kinkyx-shop.com/unsubscribe_survey/","https://www.kinkyx-shop.com/latex-sur-mesure/","https://www.kinkyx-shop.com/commande-meta/","https://www.kinkyx-shop.com/panier/","https://www.kinkyx-shop.com/commande/","https://www.kinkyx-shop.com/ts-shipment-tracking/","https://www.kinkyx-shop.com/mon-compte/","https://www.kinkyx-shop.com/suivi-de-colis/","https://www.kinkyx-shop.com/confirmation-commande/","https://www.kinkyx-shop.com/atelier/","https://www.kinkyx-shop.com/register/","https://www.kinkyx-shop.com/cgv/","https://www.kinkyx-shop.com/cgu/","https://www.kinkyx-shop.com/boutique/"];

function oldPath(u) {
  return new URL(u).pathname; // garde le "/" final
}

async function fetchCatalog() {
  console.log("→ Catégories…");
  const categories = await wcAll("wc/v3/products/categories", {
    hide_empty: false,
    _fields: "id,name,slug,parent,description,count,image,menu_order,lang,translations",
  });
  console.log("→ Produits…");
  const products = await wcAll("wc/v3/products", {
    status: "publish",
    orderby: "menu_order",
    order: "asc",
    _fields:
      "id,name,slug,permalink,type,status,sku,price,regular_price,sale_price,on_sale,price_html," +
      "stock_status,short_description,description,categories,tags,brands,images," +
      "attributes,default_attributes,variations,external_url,button_text,kx_fabcom," +
      "average_rating,rating_count,date_created,date_modified,lang,translations",
  });
  return normalize({ categories, products, attributes: [], attributeTerms: {}, variations: {}, reviews: [] });
}

function lastSegment(p) {
  const parts = p.split("/").filter(Boolean);
  return parts[parts.length - 1] || "";
}

function buildProductRedirects(catalog) {
  // index principal : chemin ANCIEN complet (frPermalink WooCommerce)
  const byOldPath = new Map();
  // index de repli : dernier segment (= postname WC) seul — couvre le cas
  // où la catégorie du produit a changé entre le clone dev et prod (ex.
  // « jacket-kinkyx » déplacé de /latex/homme/veste/ vers /latex/femme/veste-femme/)
  const bySlugFallback = new Map();
  for (const p of catalog.products) {
    if (!p.frPermalink) continue;
    const op = oldPath(p.frPermalink);
    byOldPath.set(op, p);
    const seg = lastSegment(op);
    if (!bySlugFallback.has(seg)) bySlugFallback.set(seg, p); // 1er gagne si collision
  }

  const rows = [];
  const unmatched = [];
  for (const oldUrl of OLD_PRODUCT_URLS) {
    const op = oldPath(oldUrl);
    if (op === "/boutique/") continue; // page boutique WC, traitée avec les pages
    let p = byOldPath.get(op);
    let viaFallback = false;
    if (!p) {
      p = bySlugFallback.get(lastSegment(op));
      viaFallback = !!p;
    }
    if (!p) {
      unmatched.push(oldUrl);
      continue;
    }
    rows.push({
      from: op,
      to: `/produit/${p.slug.fr}/`,
      to_en: `/en/product/${p.slug.en}/`,
      to_de: `/de/produkt/${p.slug.de}/`,
      note: viaFallback ? "catégorie différente entre dev et prod — vérifier avant bascule" : undefined,
    });
  }
  return { rows, unmatched };
}

function buildCategoryRedirects(catalog) {
  // index par chemin ANCIEN : reconstruit depuis la hiérarchie WC (mêmes
  // slugs natifs que prod, la structure de permalien /%product_cat%/ est
  // globale WooCommerce — indépendante du clone).
  const byId = new Map(catalog.categories.map((c) => [c.key, c]));
  function nativeOldPath(cat, guard = 0) {
    if (guard > 10) return `/${cat.__nativeSlug}/`;
    const parent = cat.parentKey ? byId.get(cat.parentKey) : null;
    const prefix = parent ? nativeOldPath(parent, guard + 1) : "/";
    return `${prefix}${cat.__nativeSlug}/`;
  }
  // __nativeSlug = slug WC d'origine (pas le slug régénéré par slugify(name),
  // qui peut différer) — on le récupère depuis les données brutes ci-dessous.
  return { byId, nativeOldPath };
}

async function main() {
  const catalog = await fetchCatalog();

  // on relit les catégories brutes pour le slug natif WC (nécessaire pour
  // reconstruire le chemin ANCIEN tel quel, distinct du slug régénéré côté front)
  const rawCats = await wcAll("wc/v3/products/categories", {
    hide_empty: false,
    _fields: "id,name,slug,parent,lang",
  });
  const nativeSlugByFrId = new Map();
  for (const c of rawCats) {
    if (c.lang === "fr" || !c.lang) nativeSlugByFrId.set(c.id, c.slug);
  }
  const byId = new Map(catalog.categories.map((c) => [c.key, c]));
  function nativeOldPath(cat, guard = 0) {
    if (guard > 10) return `/${nativeSlugByFrId.get(cat.key) || cat.slug.fr}/`;
    const parent = cat.parentKey ? byId.get(cat.parentKey) : null;
    const prefix = parent ? nativeOldPath(parent, guard + 1) : "/";
    return `${prefix}${nativeSlugByFrId.get(cat.key) || cat.slug.fr}/`;
  }

  const catByOldPath = new Map();
  for (const c of catalog.categories) {
    catByOldPath.set(nativeOldPath(c), c);
  }

  // « Soins Du Latex » vivait à la racine sur l'ancien site, déplacée sous
  // /latex/ côté nouveau catalogue (id WC 366, cf. mémo L1) — pas un raté de
  // correspondance, un changement de hiérarchie assumé antérieurement.
  const MANUAL_CATEGORY_BY_KEY = { "/soinsdulatex/": 366 };

  const catRows = [];
  const catUnmatched = [];
  for (const oldUrl of OLD_CATEGORY_URLS) {
    const op = oldPath(oldUrl);
    let c = catByOldPath.get(op);
    if (!c && MANUAL_CATEGORY_BY_KEY[op] != null) c = byId.get(MANUAL_CATEGORY_BY_KEY[op]);
    if (!c) {
      catUnmatched.push(oldUrl);
      continue;
    }
    catRows.push({ from: op, to: c.path.fr, to_en: c.path.en, to_de: c.path.de });
  }

  const { rows: prodRows, unmatched: prodUnmatched } = buildProductRedirects(catalog);

  // Produits introuvables sur dev (probablement retirés du catalogue depuis le
  // clone) : repli sur la catégorie parente plutôt qu'un 404 sec — à confirmer
  // avec le client (produit à ré-ajouter ? vraiment discontinué ?).
  const MANUAL_PRODUCT_FALLBACK_CATEGORY = {
    "/latex/femme/tanga-latex/": "/latex/femme/", // catégorie parente devinée depuis l'URL d'origine
  };
  for (const [op, oldCatPath] of Object.entries(MANUAL_PRODUCT_FALLBACK_CATEGORY)) {
    const idx = prodUnmatched.indexOf(`https://www.kinkyx-shop.com${op}`);
    if (idx === -1) continue;
    const c = catByOldPath.get(oldCatPath);
    if (!c) continue;
    prodUnmatched.splice(idx, 1);
    prodRows.push({
      from: op,
      to: c.path.fr,
      to_en: c.path.en,
      to_de: c.path.de,
      note: "produit absent du catalogue dev (retiré/renommé ?) — repli sur la catégorie parente, À CONFIRMER avec le client avant bascule",
    });
  }

  console.log(`\nProduits  : ${prodRows.length} appariés / ${OLD_PRODUCT_URLS.length - 1} (hors /boutique/)`);
  if (prodUnmatched.length) {
    console.log(`  Non appariés (${prodUnmatched.length}) :`);
    for (const u of prodUnmatched) console.log(`   - ${u}`);
  }
  console.log(`Catégories: ${catRows.length} appariées / ${OLD_CATEGORY_URLS.length}`);
  if (catUnmatched.length) {
    console.log(`  Non appariées (${catUnmatched.length}) :`);
    for (const u of catUnmatched) console.log(`   - ${u}`);
  }

  // Pages fonctionnelles/contenu : décidées à la main (peu nombreuses, chacune
  // a une histoire différente — cf. audit fait en session le 2026-09-14).
  const pageRows = [
    // slugs conservés tels quels dans le nouveau front → PAS de redirection :
    // /, /de/, /en/, /guide-des-tailles/, /latex-sur-mesure/, /panier/,
    // /commande/, /mon-compte/, /cgv/, /cgu/
    { from: "/boutique/", to: "/", note: "page boutique WooCommerce, remplacée par la home Astro" },
    { from: "/atelier/", to: "/", note: "page contenu quasi-vide, retirée du nouveau front (audit L4)" },
    { from: "/revendeur/", to: "/", note: "page contenu quasi-vide, retirée du nouveau front (audit L4)" },
    { from: "/shooting/", to: "/", note: "page contenu vide, retirée du nouveau front (audit L4)" },
    { from: "/register/", to: "/mon-compte/", note: "ancienne page ARMember (plugin retiré) — inscription se fait maintenant sur /mon-compte/" },
    { from: "/commande-meta/", to: "/", note: "page vide (header/footer seuls) sur l'ancien site" },
    { from: "/confirmation-commande/", to: "/", note: "ancienne confirmation WC (paramètres ?order-received=&key= non reportables en redirection statique) — nouvelle URL équivalente : /commande/confirmation/?order=&key=" },
    { from: "/unsubscribe_survey/", to: "/", note: "À CONFIRMER — page/outil de désinscription newsletter, pas d'équivalent identifié sur le nouveau front" },
    { from: "/suivi-de-colis/", to: "/", note: "À CONFIRMER — page vide sur l'ancien site (header/footer seuls), doublon FR de /ts-shipment-tracking/ ?" },
    {
      from: "/ts-shipment-tracking/",
      to: "/mon-compte/commandes/",
      note:
        "⚠️ DÉCISION REQUISE — c'est une vraie fonctionnalité (formulaire de suivi par n° de commande + e-mail, plugin de tracking colis), PAS répliquée dans le compte Astro actuel (qui exige une connexion). Redirection provisoire vers la liste des commandes ; à traiter avant bascule si cette fonctionnalité guest doit être conservée.",
    },
  ];

  // Le nouveau front n'a pas (encore) de page « marque » dédiée — repli sur
  // la home. À revoir si le client veut des pages marque (feature à part).
  const brandRows = OLD_BRAND_URLS.map((u) => ({
    from: oldPath(u),
    to: "/",
    note: "pas de page marque dans le nouveau front — à construire si souhaité (hors périmètre redirections)",
  }));

  const out = {
    generatedAt: new Date().toISOString(),
    source: "dev.kinkyx-shop.com (clone) — À REGÉNÉRER contre prod avant la vraie bascule",
    products: prodRows,
    categories: catRows,
    pages: pageRows,
    brands: brandRows,
    unmatchedProducts: prodUnmatched,
    unmatchedCategories: catUnmatched,
  };
  await writeFile(new URL("../data/redirects.json", import.meta.url), JSON.stringify(out, null, 2));
  console.log("\n→ data/redirects.json écrit.");
}

main().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});
