# Audit SEO — piano-partition.fr

> Date de l'audit : 16 mai 2026
> Auteur : analyse SEO consolidée
> Branche : `claude/seo-analysis-piano-partition-UY07A`

---

## 0. Synthèse exécutive (TL;DR)

| Axe | État estimé | Priorité | Effort |
|---|---|---|---|
| Indexation Google | **Critique** — aucun résultat pour `site:piano-partition.fr` ni pour `"piano-partition.fr"` au 16/05/2026 | P0 | Faible (technique) |
| Notoriété / backlinks | **Quasi inexistante** — domaine n'apparaît dans aucun comparatif niche FR (vs Noviscore, Quickpartitions, E-partitions, partition-piano.org, partitions-piano.fr, dechiffrerpiano.fr) | P0 | Élevé (long terme) |
| Architecture & contenu | **À auditer** (HTML non accessible depuis cet environnement) | P1 | Moyen |
| SEO on-page (titles, Hn, schema) | **À auditer** | P1 | Faible |
| Performance / Core Web Vitals | **À auditer** | P2 | Moyen |
| Stratégie éditoriale (blog, tutos, longue traîne) | **À construire** | P1 | Élevé |
| Schema.org spécifique partitions | **À implémenter** (cf. §9) | P1 | Faible |

**Constat principal :** le site est probablement en situation de « sandbox Google » ou souffre d'un problème majeur d'indexation/d'autorité. La seule présence dans les SERP françaises sur les requêtes du marché est dominée par 6-8 concurrents bien établis. Tant que l'on n'a pas (a) confirmé l'indexation, (b) défini un avantage différenciant éditorial ou produit, le levier SEO reste largement bloqué.

> **Sections marquées `[TODO-HTML]`** = à compléter dès réception des HTML / robots.txt / sitemap.xml de la prod. Mon environnement actuel ne peut pas crawler le domaine (`host_not_allowed`).

---

## 1. Méthodologie & limites de cet audit

### Ce qui a été fait
- Recherches Google sur le domaine (`site:`, `""`, requêtes du marché)
- Analyse concurrentielle sur la base des SERP françaises de la niche
- Benchmarks Core Web Vitals 2026 (seuils en vigueur)
- Recommandations Schema.org `MusicComposition`, `Product`, `MusicPlaylist`, `BreadcrumbList`, `FAQPage`, `Organization`

### Ce qui n'a pas pu être fait depuis cet environnement
- Crawl du site (HTTP 403 — `host_not_allowed` côté sandbox)
- Lecture directe du `robots.txt`, `sitemap.xml`
- Audit technique on-page (titles, descriptions, Hn, schema, alt, canonicals)
- Tests Core Web Vitals (LCP / INP / CLS) en conditions réelles
- Lighthouse / PageSpeed
- Backlinks (Ahrefs / SEMrush / Majestic)

### Outils recommandés pour compléter l'audit
- **Crawl** : Screaming Frog (gratuit jusqu'à 500 URLs), Sitebulb
- **Performance** : PageSpeed Insights, web.dev/measure, WebPageTest
- **Indexation** : Google Search Console (indispensable, à connecter en priorité)
- **Backlinks** : Ahrefs Webmaster Tools (gratuit pour le propriétaire), Majestic Trial
- **SERP / volumes** : Ubersuggest, Keyword Planner (compte Ads), Semrush
- **Schema validation** : validator.schema.org, Rich Results Test (Google)
- **Mobile / a11y** : Lighthouse, Wave, axe DevTools

---

## 2. Constat #1 — Invisibilité totale dans Google (P0)

### Preuves
- `site:piano-partition.fr` → **0 résultat** (recherche du 16/05/2026)
- `"piano-partition.fr"` (en exact match) → 0 mention sur la page 1
- Le domaine n'apparaît dans **aucun comparatif** ni « top sites partitions piano » (alors que Noviscore, Quickpartitions, partitions-piano.fr, partition-piano.org, e-partitions.fr, dechiffrerpiano.fr y figurent systématiquement)

### Hypothèses à vérifier (par ordre de probabilité)
1. **Indexation bloquée** — `robots.txt` interdit `/`, ou `<meta name="robots" content="noindex">` global, ou X-Robots-Tag HTTP `noindex`
2. **Site jamais soumis à GSC** — pas de sitemap, pas de signal d'autorité, Googlebot ne passe quasiment jamais
3. **Pénalité manuelle / algorithmique** — vérifier Search Console > Sécurité et actions manuelles
4. **Contenu dupliqué massif** (scraping de partitions/textes existants → Google déclassement)
5. **Domaine récent** sans backlinks → simple lenteur d'indexation
6. **Problème DNS / serveur** intermittent côté Googlebot

### Actions immédiates (J+0 à J+3)
1. `curl -A "Mozilla/5.0" -I https://piano-partition.fr/robots.txt` et `https://piano-partition.fr/` côté hébergeur
2. Vérifier l'en-tête `X-Robots-Tag` sur les pages principales
3. Inspecter le HTML : `<meta name="robots" ...>`, balises `canonical`
4. Connecter / vérifier **Google Search Console** :
   - Validation de propriété (DNS de préférence)
   - Soumettre `sitemap.xml`
   - Outil d'inspection d'URL → demander indexation pour l'accueil + 5 pages stratégiques
   - Vérifier rapports : Couverture, Sécurité, Actions manuelles
5. Vérifier **Bing Webmaster Tools** (5-7 % du trafic FR, souvent oublié)
6. Tester l'accès Googlebot via *URL Inspection* → « Tester l'URL en direct »

---

## 3. Analyse concurrentielle — la niche « partition piano » FR

### Cartographie des concurrents directs

| Domaine | Positionnement | Force SEO | Modèle |
|---|---|---|---|
| **noviscore.fr** | Spécialiste, partitions adaptées par niveau, app mobile, beaucoup de pop/variété FR | Très fort (autorité, contenus, backlinks, app) | Payant + essai gratuit |
| **quickpartitions.com** | Partitions piano/guitare à l'unité, légales | Fort | Achat à l'unité |
| **partitions-piano.fr** | Gratuit, classement par niveau, écoute préalable | Moyen-fort | Freemium / pubs |
| **partition-piano.org** | Public domain (Chopin, Bach, Beethoven, Debussy) | Moyen | Gratuit |
| **e-partitions.fr** | PDF tous niveaux : classique, jazz, variété, pop | Moyen | Mixte |
| **dechiffrerpiano.fr** | Méthode + partitions | Moyen | Méthode payante |
| **pianofacile.com** | Partitions débutants (pop, rock, jazz, blues) | Moyen | Freemium |
| **partition-piano-gratuite.fr** | PDF + MIDI, libres de droits | Moyen | Gratuit |
| **mypianopop.com** | Niche pop facile | Faible-moyen | Méthode |
| **tous-au-piano.com / cahierdupianiste.com / pianoaccord.fr** | Blogs piano (avis, tutos, listes) | Faible-moyen | Affiliation / cours |

### Ce qui ressort (et qui doit guider votre stratégie)

1. **La requête « partition piano » est saturée par 4-5 mastodontes.** Attaquer en frontal est suicidaire. → stratégie **longue traîne + différenciation**.
2. **Noviscore domine par la profondeur de catalogue × niveaux** (chaque morceau a 3-4 versions). Différenciateur reproductible si vous avez le catalogue.
3. **Le contenu blog/tuto convertit en SEO** (pianoboulotdodo, cahierdupianiste, tous-au-piano, pianoaccord captent des requêtes informationnelles). Sans blog, vous coupez 40-60 % du potentiel de trafic SEO.
4. **Les comparatifs « 20 sites où trouver vos partitions »** sont des **portes d'entrée backlinks** — vous n'apparaissez dans aucun. À cibler en outreach (cf. §11).
5. **Le gratuit (`partition-piano.org`, `partition-piano-gratuite.fr`) capte tout le trafic public-domain** (Chopin, Bach…). Si vous vendez du payant, ne rivalisez pas sur ces requêtes.
6. **L'écoute + niveau + impression PDF** sont les 3 fonctionnalités attendues. Toute fiche partition sans ces 3 éléments = bounce élevé.

---

## 4. Audit technique SEO — checklist `[TODO-HTML]`

### 4.1 Crawlabilité

- [ ] `robots.txt` accessible en HTTP 200
- [ ] `User-agent: *` n'interdit pas les pages utiles
- [ ] Aucun `Disallow: /` global
- [ ] Présence d'une directive `Sitemap: https://piano-partition.fr/sitemap.xml`
- [ ] Pas de blocage de `/static/`, `/css/`, `/js/`, `/_next/` (Google a besoin du CSS/JS pour rendre)
- [ ] `sitemap.xml` accessible, valide, < 50 000 URLs, < 50 Mo
- [ ] `sitemap.xml` contient `<lastmod>` à jour (pas du 1970-01-01)
- [ ] Pas de pages 404 / noindex / redirigées dans le sitemap
- [ ] Si > 50 000 URLs : sitemap index (`sitemap_index.xml`)
- [ ] Sitemap image si beaucoup de visuels de partitions (`image:image`)

### 4.2 Indexation

- [ ] Chaque page importante a une `<link rel="canonical">` self-referencing absolue (HTTPS)
- [ ] Aucune page utile en `<meta name="robots" content="noindex">`
- [ ] Pages de filtres / facettes / recherche interne en `noindex, follow`
- [ ] Pages paginées : `rel="canonical"` vers elles-mêmes (pas vers page 1)
- [ ] Aucune page utile renvoyant `X-Robots-Tag: noindex` (header HTTP)
- [ ] Versions http→https et www↔non-www toutes en 301 vers une version unique
- [ ] Pas de duplicate URL via paramètres de tracking (`?utm_*`, `?fbclid`) — utiliser canonical

### 4.3 HTTPS / sécurité

- [ ] Certificat valide, non expiré, chaîne complète
- [ ] HSTS configuré (`Strict-Transport-Security: max-age=31536000; includeSubDomains`)
- [ ] Pas de mixed content (CSS/JS/images en `http://`)
- [ ] Redirection 301 systématique http → https

### 4.4 Architecture URL

- [ ] URLs lisibles, en kebab-case, sans paramètres inutiles
- [ ] Hiérarchie logique : `/partitions/<genre>/<artiste>/<morceau>` ou `/partition-piano/<niveau>/<titre>`
- [ ] Pas plus de 3-4 niveaux de profondeur depuis l'accueil
- [ ] Pas de duplication trailing slash / non-trailing slash
- [ ] Pas de majuscules dans les URLs
- [ ] Pas d'IDs numériques bruts en fin (`?id=12345`) — préférer le slug

### 4.5 Codes HTTP

- [ ] Pages utiles → 200
- [ ] Pages obsolètes → 301 vers équivalent (jamais 302 pour du permanent)
- [ ] Vraies pages supprimées → 410 (et non 404) pour accélérer la désindexation
- [ ] Pages d'erreur 404 : présence d'un template avec liens vers menu et recherche
- [ ] Pas de chaînes de redirections > 1 saut

### 4.6 Performances serveur

- [ ] TTFB < 600 ms (idéalement < 200 ms)
- [ ] HTTP/2 ou HTTP/3 activé
- [ ] Compression Brotli (préféré) ou Gzip sur HTML/CSS/JS
- [ ] CDN devant les assets statiques (images, PDF, CSS, JS)
- [ ] Caching headers raisonnables : `Cache-Control: public, max-age=...` sur statiques
- [ ] Images servies en WebP/AVIF + fallback, avec `srcset` responsive

---

## 5. SEO on-page — `[TODO-HTML]`

### 5.1 Title

- [ ] 1 seul `<title>` par page, 50-60 caractères
- [ ] Mot-clé principal en début
- [ ] Variation par page (pas de title identique sur 2 pages)
- [ ] Suffixe de marque court (` | Piano Partition`) — pas répétitif au point d'occuper 30 % du title

**Exemples à viser :**
- Accueil : `Partitions piano à imprimer — débutant à confirmé | Piano Partition`
- Catégorie : `Partitions piano jazz à télécharger en PDF | Piano Partition`
- Fiche : `Clair de Lune (Debussy) — partition piano niveau 4 | Piano Partition`

### 5.2 Meta description

- [ ] 140-160 caractères, 1 seule par page, unique
- [ ] Contient une promesse (impression PDF, niveaux, écoute préalable, prix, gratuit)
- [ ] Inclut un verbe d'action (« Téléchargez », « Imprimez », « Découvrez »)
- [ ] Ne « bourre » pas de mots-clés

### 5.3 Hiérarchie Hn

- [ ] 1 seul `<h1>` par page, contenant le mot-clé principal
- [ ] H2 = sous-thèmes (versions / niveaux / extrait audio / paroles / artiste)
- [ ] H3 sous H2, jamais H3 sans H2 au-dessus
- [ ] Pas de H1 sur le logo (utiliser `<div>` + alt sur l'image)

### 5.4 Contenu

- [ ] Page d'accueil : > 300 mots de texte structuré (pas seulement des cartes produits)
- [ ] Page catégorie : > 500 mots d'intro éditoriale au-dessus / en-dessous de la grille
- [ ] Fiche partition : description originale (≥ 150 mots), pas un copier-coller de Wikipedia
- [ ] Présence du **mot-clé + variantes sémantiques** (LSI) — exemples : « partition piano facile », « pdf », « débutant », « niveau », « doigtés », « accords »
- [ ] Pas de duplicate content interne (variantes triées qui dupliquent la même page)

### 5.5 Images

- [ ] Tous les visuels ont un `alt` descriptif (pas vide, pas « image1 »)
- [ ] Visuels de partitions : `alt="Aperçu partition piano de Clair de Lune, niveau intermédiaire"`
- [ ] Format WebP / AVIF, dimensions adaptées (pas une image 4000×4000 servie en 400×400)
- [ ] `loading="lazy"` sauf pour le LCP (above the fold)
- [ ] `width` + `height` explicites (évite CLS)
- [ ] Nom de fichier signifiant (`clair-de-lune-debussy-piano.webp` plutôt que `IMG_4521.jpg`)

### 5.6 Liens internes (cf. §8)

- [ ] Ancres descriptives, pas « cliquez ici »
- [ ] Pas plus de ~100 liens internes par page
- [ ] Tous les liens importants en HTML `<a href>` (pas en JS onclick)

---

## 6. Mots-clés cibles — stratégie de longue traîne

### 6.1 Tête (très concurrentiel — éviter en frontal)

| Requête | Volume estimé FR | Difficulté | Stratégie |
|---|---|---|---|
| partition piano | 60-100k/mois | Très élevée | Page pilier seulement |
| partition piano gratuite | 20-40k/mois | Très élevée | Cluster « gratuit » uniquement si offre cohérente |
| partition piano facile | 10-20k/mois | Très élevée | Cluster niveau débutant |

### 6.2 Cœur de cible (à attaquer en priorité)

| Requête | Volume | Difficulté | Intention |
|---|---|---|---|
| partition piano [titre morceau] | ~ | Moyenne | Transactionnelle |
| partition piano [artiste] | ~ | Moyenne | Transactionnelle |
| partition piano [niveau] [style] | ~ | Moyenne | Transactionnelle |
| partition piano débutant pdf | ~3-5k | Moyenne | Transactionnelle |
| partition piano romantique facile | ~ | Faible | Transactionnelle |
| partition piano jazz pdf | ~ | Moyenne | Transactionnelle |
| partition piano Disney facile | ~ | Faible-moyenne | Transactionnelle |

### 6.3 Informationnelles (blog, capter le top of funnel)

- comment lire une partition piano
- comment apprendre à déchiffrer une partition piano
- partition piano débutant adulte
- partition piano niveau 1 / 2 / 3 / 4 / 5
- comment imprimer une partition piano
- partition piano vs tablature
- meilleures partitions piano pour s'entraîner [période classique / pop]
- accords piano [morceau]
- doigtés piano [morceau]

### 6.4 Méthodologie de recherche de mots-clés

1. Aspirer le catalogue concurrent (Screaming Frog → CSV) pour récupérer leurs titres
2. Croiser avec **Google Keyword Planner** (compte Ads obligatoire — gratuit)
3. Compléter avec **Google Suggest** (`partition piano *`, `partition piano [a-z]`)
4. Vérifier les **People Also Ask** sur les SERP cibles
5. Catégoriser par **intention** : transactionnelle / informationnelle / navigationnelle
6. Prioriser par : (volume × CTR estimé) / difficulté

---

## 7. Architecture du site recommandée

```
/
├── /partitions/                              (page pilier transactionnelle)
│   ├── /partitions/par-niveau/
│   │   ├── /partitions/par-niveau/debutant/
│   │   ├── /partitions/par-niveau/intermediaire/
│   │   └── /partitions/par-niveau/confirme/
│   ├── /partitions/par-genre/
│   │   ├── /partitions/par-genre/classique/
│   │   ├── /partitions/par-genre/jazz/
│   │   ├── /partitions/par-genre/pop/
│   │   ├── /partitions/par-genre/variete-francaise/
│   │   ├── /partitions/par-genre/disney/
│   │   ├── /partitions/par-genre/musique-film/
│   │   └── /partitions/par-genre/jeux-video/
│   ├── /partitions/par-artiste/<artiste>/
│   └── /partitions/<slug-morceau>/           (fiche unitaire = nœud de conversion)
├── /blog/                                    (top of funnel)
│   ├── /blog/apprendre-piano/
│   ├── /blog/dechiffrer-partition/
│   └── /blog/<article>/
├── /tarifs/                                  (page de conversion)
├── /a-propos/
├── /contact/
├── /mentions-legales/
├── /cgv/                                     (obligatoire e-commerce)
├── /politique-confidentialite/
└── /cookies/
```

### Points clés
- **3 clics maximum** entre l'accueil et n'importe quelle fiche partition
- **Une seule URL par fiche** — pas de duplication via filtres (`/partitions/jazz/morceau` ET `/par-artiste/x/morceau` = duplicate)
- Si plusieurs catégorisations utiles, choisir une URL canonique et lier les autres en breadcrumb sans dupliquer
- **Breadcrumb** présent sur toutes les pages internes + JSON-LD `BreadcrumbList`

---

## 8. Maillage interne

### Règles
1. **Page d'accueil** lie vers les 6-10 catégories top et 10-20 fiches phares (best-sellers / nouveautés)
2. **Chaque catégorie** lie vers ses fiches + au moins 2 catégories sœurs (genres proches, niveaux proches)
3. **Chaque fiche** propose **6-12 partitions similaires** (par artiste / genre / niveau)
4. **Chaque article blog** lie vers la (ou les) page(s) catégorie pilier en ancre exacte ou semi-exacte
5. **Footer** : liens vers catégories principales + pages légales (pas un megafooter à 200 liens)

### Ancres
- Varier les ancres pour la même destination (« partitions piano jazz » / « partition jazz à imprimer » / « morceaux jazz pour piano »)
- Éviter les ancres génériques (« ici », « voir plus »)
- Pas d'ancre exacte sur-optimisée à 100 % (Google peut considérer ça comme manipulatoire)

---

## 9. Schema.org — recommandations spécifiques partitions

### 9.1 `Organization` (à mettre dans le layout)

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Piano Partition",
  "url": "https://piano-partition.fr",
  "logo": "https://piano-partition.fr/logo.png",
  "sameAs": [
    "https://www.facebook.com/...",
    "https://www.instagram.com/...",
    "https://www.youtube.com/@..."
  ],
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "customer support",
    "email": "contact@piano-partition.fr",
    "availableLanguage": ["French"]
  }
}
```

### 9.2 `BreadcrumbList` (toutes pages internes)

### 9.3 Fiche partition — combiner `Product` (si payant) + `MusicComposition`

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Clair de Lune — partition piano niveau 4",
  "image": "https://piano-partition.fr/img/clair-de-lune-preview.webp",
  "description": "Partition PDF de Clair de Lune (Debussy) adaptée niveau 4. Doigtés, pédales, audio d'exemple inclus.",
  "sku": "PP-CDL-N4",
  "brand": { "@type": "Brand", "name": "Piano Partition" },
  "offers": {
    "@type": "Offer",
    "price": "4.90",
    "priceCurrency": "EUR",
    "availability": "https://schema.org/InStock",
    "url": "https://piano-partition.fr/partitions/clair-de-lune-debussy-niveau-4"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "reviewCount": "37"
  }
}
```

Et **en plus** sur la même page (le couplage est valide) :

```json
{
  "@context": "https://schema.org",
  "@type": "MusicComposition",
  "name": "Clair de Lune",
  "composer": { "@type": "Person", "name": "Claude Debussy" },
  "datePublished": "1905",
  "inLanguage": "fr",
  "musicCompositionForm": "Suite",
  "iswcCode": "..."
}
```

### 9.4 `FAQPage` sur les pages catégorie + accueil

Booste fortement le CTR en SERP (rich snippet).

### 9.5 `Review` / `AggregateRating`

À implémenter dès que des avis clients existent (5+ par fiche minimum pour que Google affiche).

### 9.6 Outils de validation

- https://validator.schema.org/
- https://search.google.com/test/rich-results

---

## 10. Performance — Core Web Vitals 2026

Seuils en vigueur (75e percentile sur données CrUX) :

| Métrique | Bon | À améliorer | Mauvais |
|---|---|---|---|
| **LCP** (Largest Contentful Paint) | ≤ 2.5 s | 2.5–4 s | > 4 s |
| **INP** (Interaction to Next Paint) — *remplace FID depuis mars 2024* | ≤ 200 ms | 200–500 ms | > 500 ms |
| **CLS** (Cumulative Layout Shift) | ≤ 0.1 | 0.1–0.25 | > 0.25 |

**Repère :** seulement ~47 % des sites passent les 3 CWV en 2026, et **INP est la métrique la plus échouée** (43 % des sites > 200 ms). C'est là que se cache le levier le plus rentable.

### Checklist Core Web Vitals `[TODO-HTML]`

#### LCP
- [ ] Image LCP préchargée (`<link rel="preload" as="image">`)
- [ ] Pas de `loading="lazy"` sur l'image LCP
- [ ] Police web préchargée (`<link rel="preload" as="font" crossorigin>`)
- [ ] `font-display: swap` ou `optional`
- [ ] CSS critique inline (above the fold)
- [ ] Pas de JS bloquant le rendu en `<head>`
- [ ] Images responsive (`srcset`, `sizes`)
- [ ] CDN actif sur les images
- [ ] Format moderne (WebP / AVIF)

#### INP
- [ ] Pas de long tasks (> 50 ms) en JS sur les interactions principales
- [ ] Évènements `click`, `pointer`, `keydown` rapides
- [ ] Délégation d'évènements + `requestIdleCallback` pour le non-critique
- [ ] Code-splitting (charger uniquement le JS nécessaire à la page)
- [ ] Pas de polyfills inutiles servis aux navigateurs modernes
- [ ] Mesurer avec `PerformanceObserver` + Web Vitals JS

#### CLS
- [ ] `width` + `height` (ou `aspect-ratio` CSS) sur **toutes** les images / iframes / vidéos
- [ ] Réservation d'espace pour les bandeaux pub / consent banner / lazyload
- [ ] Pas d'insertion de contenu au-dessus du viewport après chargement
- [ ] Polices via `font-display: optional` ou `swap` + `size-adjust`

### Outils
- PageSpeed Insights (LCP/INP/CLS field + lab)
- web-vitals (JS) embarqué pour collecte temps réel
- Chrome DevTools → Performance > Web Vitals
- Search Console > Core Web Vitals (données CrUX réelles)

---

## 11. Backlinks & autorité (E-E-A-T)

### Diagnostic
Domaine probablement à **DR/DA ~ 0-10** vu son absence des SERP et des comparatifs. La priorité n'est PAS d'attaquer des requêtes ultra-concurrentielles, mais de construire la confiance.

### Plan d'acquisition de backlinks (12 mois)

#### Trimestre 1 — Fondations
1. Profils sociaux + fiches business cohérents : Facebook page, Instagram, YouTube, Pinterest, TikTok (sameAs dans schema.org)
2. **Google Business Profile** si entité physique ou SARL adressée
3. Annuaires de qualité (FR) : Pages Jaunes, ProntoPro si pertinent, annuaire des éditeurs / disquaires
4. Wikipedia FR : pas de spam, mais une mention contextuelle si un article existe
5. Profils sur communautés piano : Reddit r/piano, r/pianolearning, forums Pianomajeur, PianoWeb, PianoZik

#### Trimestre 2 — Outreach ciblé
6. **Comparatifs « top sites partitions piano »** — vous n'apparaissez nulle part, contactez les auteurs :
   - pianoboulotdodo.com (« 20 endroits fiables… »)
   - tomplay.com/blog
   - blog.newzik.com
   - tous-au-piano.com
   - cahierdupianiste.com
   - latouchemusicale.com
   - blog.allegromusique.fr
7. Approche : email court avec 1 angle différenciateur unique (le scoop, la stat, le service inédit) — pas de « demande de lien »
8. Articles invités : 2-3 blogs piano FR par trimestre

#### Trimestre 3-4 — Contenus aimants à liens
9. **Étude / data viz** (ex. : « Les 100 morceaux piano les plus joués en France en 2026 », sur la base de votre catalogue ou d'API Spotify/YouTube)
10. Outil gratuit en ligne (ex. : transposeur de partition, métronome, identifieur d'accords) → ce sont des aimants à liens
11. Partenariats : écoles de musique, profs de piano (offre affiliation), facteurs de pianos, marques d'instruments

#### Toxic backlinks
- Surveiller dans GSC > Liens > Sites avec le plus de liens
- Disavow uniquement en cas de pénalité manuelle constatée

---

## 12. Contenu éditorial (le blog est non négociable)

### Pourquoi un blog
- ~50 % du potentiel SEO de la niche réside dans les requêtes **informationnelles** (« comment lire une partition », « doigtés », « niveau », « adulte débutant »…)
- Les concurrents qui dominent les SERP « comparatifs » et « tutos » (pianoboulotdodo, cahierdupianiste, tous-au-piano) ne vendent pas de partitions — ils prennent votre trafic et le redirigent en affiliation. Vous devez récupérer ce trafic.
- Backlinks naturels : un bon article tuto attire 5-20 × plus de liens qu'une fiche produit

### Calendrier minimal recommandé
- **1 article / semaine** sur 6 mois, puis 2/semaine
- Mix : 60 % informationnel (top of funnel), 30 % « best-of » (middle of funnel — convertissent vers les catégories), 10 % actualité / interviews / coulisses

### Thèmes pilier
1. Apprendre le piano (débutant, adulte, méthode)
2. Lire une partition (théorie, déchiffrage)
3. Comparatifs et listes (top morceaux par genre, par niveau)
4. Tutoriels par morceau (« Comment jouer X au piano »)
5. Compositeurs et histoire de la musique
6. Matériel piano (claviers, casques, accessoires) — affiliation Amazon possible
7. Bien-être musical (la musique pour le stress, la concentration)

### Optimisation des articles
- 1 200–2 000 mots, structurés en H2/H3
- 1 mot-clé principal + 3-5 secondaires
- Image originale (pas de stock générique)
- CTA en fin et en milieu d'article vers la catégorie ou fiche partition pertinente
- Mise à jour annuelle (`<meta name="last-modified">`, contenu rafraîchi, `dateModified` dans le schema Article)

---

## 13. UX, mobile et accessibilité

### Mobile (>70 % du trafic FR)
- [ ] Viewport meta : `<meta name="viewport" content="width=device-width, initial-scale=1">`
- [ ] Tap targets ≥ 48×48 px, espacement ≥ 8 px
- [ ] Pas de zoom horizontal
- [ ] Texte ≥ 16 px par défaut
- [ ] Pas d'interstitiel intrusif (Google déclasse)
- [ ] PDF de partitions visualisables / téléchargeables sur mobile

### Accessibilité (WCAG 2.2 AA — aussi un signal indirect SEO)
- [ ] Contrastes ≥ 4.5:1 (textes), ≥ 3:1 (UI)
- [ ] Navigation au clavier complète
- [ ] Focus visibles
- [ ] `lang="fr"` sur `<html>`
- [ ] `aria-label` sur les boutons icônes (loupe, panier…)
- [ ] Formulaires : `<label>` lié à chaque `<input>`
- [ ] Lecteur audio des extraits : contrôles accessibles, transcript si possible

---

## 14. RGPD, juridique, e-commerce

Ces éléments influencent indirectement le SEO via la confiance (E-E-A-T) :

- [ ] Mentions légales complètes (raison sociale, SIRET, hébergeur, directeur de publication)
- [ ] CGV claires (e-commerce → obligatoire)
- [ ] Politique de confidentialité conforme RGPD + CNIL 2024
- [ ] Bandeau cookies conforme (refus aussi facile que l'accord, IAB TCF 2.2)
- [ ] Lien vers la médiation de la consommation
- [ ] Si vous vendez à des consommateurs : droit de rétractation 14 jours (sauf produit numérique téléchargé avec renoncement explicite — à formaliser)
- [ ] Avis vérifiés : si vous affichez `AggregateRating`, vous devez pouvoir prouver les avis (Trustpilot, Avis Vérifiés…)

---

## 15. Roadmap 30 / 60 / 90 jours

### J0 → J30 — Stop the bleeding

| # | Action | Responsable | Priorité |
|---|---|---|---|
| 1 | Vérifier `robots.txt`, `<meta robots>`, X-Robots-Tag sur 10 pages clés | Dev | P0 |
| 2 | Connecter Google Search Console (validation DNS) | Marketing | P0 |
| 3 | Soumettre le sitemap.xml dans GSC | Marketing | P0 |
| 4 | Demander indexation manuelle de 10 URLs prioritaires | Marketing | P0 |
| 5 | Audit Lighthouse mobile + desktop, fixer LCP > 4s et CLS > 0.25 | Dev | P0 |
| 6 | Auditer titles/meta descriptions/H1 dupliqués (Screaming Frog) | SEO | P0 |
| 7 | Ajouter Schema.org `Organization`, `BreadcrumbList`, `Product`, `MusicComposition` | Dev | P1 |
| 8 | Brancher Plausible/Matomo + GA4 + console Bing | Marketing | P1 |

### J30 → J60 — Foundations

| # | Action | Priorité |
|---|---|---|
| 9 | Ouvrir le blog (CMS headless ou Wordpress sous-dossier `/blog/` — JAMAIS sous-domaine) | P1 |
| 10 | 4 articles piliers : comment lire une partition, partition piano débutant adulte, niveaux de partition, comment imprimer | P1 |
| 11 | Audit duplicate content + canonicals propres | P1 |
| 12 | Réécriture des 20 fiches partitions les plus stratégiques (description originale 150-300 mots, FAQ) | P1 |
| 13 | Maillage interne fiches → catégories → pilier (~5-10 liens par fiche) | P1 |
| 14 | Profils sociaux + sameAs cohérents | P2 |

### J60 → J90 — Growth

| # | Action | Priorité |
|---|---|---|
| 15 | Outreach 30 sites/comparatifs avec un angle différenciateur | P1 |
| 16 | 1 outil gratuit en ligne (métronome, identifieur d'accords, lecteur MIDI) | P1 |
| 17 | Programme d'avis clients (Trustpilot ou avis natifs vérifiés) | P2 |
| 18 | A/B test des titles sur les 20 fiches stratégiques | P2 |
| 19 | Vidéos YouTube tutos (1-2/semaine) — la chaîne dope l'autorité du domaine | P2 |
| 20 | Newsletter mensuelle (nurturing + signal d'engagement) | P3 |

---

## 16. KPI et instrumentation

### Tableau de bord à mettre en place
| KPI | Cible 3 mois | Cible 6 mois | Cible 12 mois | Source |
|---|---|---|---|---|
| Pages indexées | +90 % du sitemap | 100 % | 100 % stable | GSC |
| Impressions GSC | × 5 | × 20 | × 50 | GSC |
| Clics organiques | × 3 | × 10 | × 30 | GSC |
| Position moyenne | < 30 | < 20 | < 15 | GSC |
| LCP p75 mobile | < 4 s | < 3 s | < 2.5 s | GSC + CrUX |
| INP p75 mobile | < 500 ms | < 300 ms | < 200 ms | GSC + CrUX |
| CLS p75 mobile | < 0.25 | < 0.15 | < 0.1 | GSC + CrUX |
| Backlinks (domaines référents) | +10 | +40 | +120 | Ahrefs / GSC |
| Articles publiés | 12 | 26 | 60 | CMS |
| Taux de conversion organique | mesuré | × 1.5 | × 2.5 | GA4 |

### Outils à brancher
- **Google Search Console** (P0)
- **Bing Webmaster Tools** (P0)
- **GA4** + événements e-commerce
- **Plausible** ou **Matomo** (RGPD-friendly, alternative ou complément)
- **Ahrefs Webmaster Tools** (gratuit pour le propriétaire — backlinks)
- **Logs serveur** (analyse Googlebot — Screaming Frog Log Analyzer)
- **web-vitals.js** pour collecter LCP/INP/CLS en RUM

---

## 17. Risques et pièges à éviter

1. **Migrations sans plan de redirection** — toute refonte URL non redirigée 301 = perte de 30-80 % du trafic
2. **Sous-domaine pour le blog** (`blog.piano-partition.fr`) — Google le traite comme un site séparé. Toujours en `/blog/`
3. **Pubs intrusives mobile** (Better Ads / Google) → déclassement
4. **Contenu généré IA non relu** — Google distingue le contenu utile du contenu trivial (Helpful Content Update). Si l'IA aide, c'est ok ; si elle remplace l'expertise, c'est puni
5. **Schéma frauduleux** (`AggregateRating` sans vrais avis) → pénalité Rich Results et perte de confiance
6. **Cloaking** (servir un HTML différent à Googlebot) → ban
7. **Achat de backlinks bas de gamme** → pénalité Penguin équivalent
8. **Sur-optimisation d'ancres exactes** sur les liens internes ou externes
9. **Partitions sous droit d'auteur** sans licence (Sacem, MPA, éditeurs) → risque juridique + désindexation DMCA
10. **PDF non indexables** (texte en image) — utiliser PDF texte ou pages HTML d'aperçu

---

## 18. `[TODO-HTML]` — à compléter quand vous me transmettez les pages

Quand vous m'envoyez les éléments ci-dessous, je peux convertir cette checklist en **audit nominatif** (avec citations exactes du HTML, lignes à modifier, et patches à appliquer) :

### Ce dont j'ai besoin
1. HTML brut de l'accueil (`curl -A "Mozilla/5.0" https://piano-partition.fr/ > home.html`)
2. HTML d'une page catégorie représentative
3. HTML d'une fiche partition
4. Contenu de `https://piano-partition.fr/robots.txt`
5. Premier niveau de `https://piano-partition.fr/sitemap.xml` (et sitemaps enfants si index)
6. En-têtes HTTP des 3 mêmes pages (`curl -I -A "Mozilla/5.0"`)
7. Capture d'écran mobile + desktop de l'accueil
8. Si possible : export Screaming Frog (titles, descriptions, H1, statuts, profondeur) — CSV
9. Si vous avez Search Console : screenshots Couverture + Performances + Core Web Vitals
10. Capture des `<head>` complets des 3 pages représentatives

Avec ça, je livre :
- audit page par page avec patches concrets
- liste des URLs à désindexer / rediriger
- patchs JSON-LD prêts à coller
- recommandations contenu à la fiche près

---

## 19. Annexe — sources et benchmarks

- Concurrents identifiés : noviscore.fr, quickpartitions.com, partitions-piano.fr, partition-piano.org, e-partitions.fr, dechiffrerpiano.fr, pianofacile.com, partition-piano-gratuite.fr, mypianopop.com
- Blogs influents (cibles outreach) : pianoboulotdodo.com, cahierdupianiste.com, tous-au-piano.com, pianoaccord.fr, blog.newzik.com, blog.allegromusique.fr, latouchemusicale.com, tomplay.com/blog
- Référentiels Schema.org : `MusicComposition`, `MusicRecording`, `MusicPlaylist`, `Product`, `Offer`, `AggregateRating`, `Review`, `BreadcrumbList`, `FAQPage`, `Organization`
- Core Web Vitals 2026 : LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 (75e centile, données CrUX)
- Outils gratuits indispensables : Google Search Console, Bing Webmaster Tools, PageSpeed Insights, Lighthouse, validator.schema.org, Ahrefs Webmaster Tools, web.dev/measure
