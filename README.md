# Catalogue d'animation PMO

Site statique (HTML/CSS/JS, aucune dépendance à installer) présentant 72 méthodes
d'animation de réunion et de décision, classées en 8 familles d'intention. Chaque
fiche a une page dédiée avec sa description complète et une **maquette interactive**
utilisable en séance (post-it virtuels, minuteur, vote, gabarit à remplir, arbre de
décision, pas-à-pas commenté, ou calculateur selon la méthode).

## Structure

```
site/
├── index.html          ← page unique, tout le routage est en JavaScript (#/...)
├── css/style.css
└── js/
    ├── data.js          ← les 72 fiches + familles + aide au choix + anti-patterns
    ├── widgets.js        ← les 8 moteurs de maquettes interactives
    └── app.js             ← routage et rendu
```

Aucun serveur ni build n'est nécessaire : ce sont des fichiers statiques purs.

## Déployer sur GitHub Pages

1. Créez un nouveau dépôt sur GitHub (public, pour que Pages soit gratuit).
2. Copiez le **contenu du dossier `site/`** (pas le dossier lui-même) à la racine
   de votre dépôt, de sorte que `index.html` soit directement à la racine.
3. Poussez sur la branche `main` :
   ```bash
   git init
   git add .
   git commit -m "Catalogue d'animation PMO"
   git branch -M main
   git remote add origin https://github.com/<votre-compte>/<votre-repo>.git
   git push -u origin main
   ```
4. Sur GitHub : **Settings → Pages → Build and deployment → Source : Deploy from a
   branch**, puis choisissez la branche `main` et le dossier `/ (root)`. Enregistrez.
5. Après une minute ou deux, le site est accessible à
   `https://<votre-compte>.github.io/<votre-repo>/`.

Pour mettre à jour le site plus tard, modifiez les fichiers puis `git push` à
nouveau : GitHub Pages republie automatiquement à chaque push sur `main`.

## Ce que chaque maquette enregistre

Les maquettes utilisent le `localStorage` du navigateur (donc **rien n'est envoyé
à un serveur** ; tout reste sur l'appareil de la personne qui les remplit). Un
bouton « Réinitialiser la maquette » est disponible sur chaque fiche.

## Modifier ou enrichir le contenu

Tout le contenu (textes des fiches, config des maquettes, familles, séquences
types, anti-patterns, annexe) est dans `js/data.js`, sous forme d'un seul objet
`CATALOG`. C'est le seul fichier à toucher pour corriger un texte, ajouter une
méthode, ou changer le type de maquette associé à une fiche.

Les 8 types de maquette disponibles (champ `widget.type` dans `data.js`) :

| Type | Usage | Exemple de fiche |
|---|---|---|
| `sticky` | Post-it dans des zones (colonnes/quadrants), avec variantes `toggle`, `scored`, `group`, `timeline` | B1 SWOT, D1 diagramme d'affinité |
| `matrix` | Placement libre sur deux axes | D3 Impact/Effort |
| `vote` | Modes `dots`, `scale`, `cards`, `budget`, `score-rounds` | D2 Dot voting, E11 Planning Poker |
| `timer` | Séquence phasée avec minuteur, capture de texte, tableau partagé optionnel | C6 1-2-4-Tous |
| `template` | Gabarit à champs (formulaire, tableau, mise en page « nuage ») | A1 Canvas, E12 ADR |
| `flow` | Arbre de décision ou classification en 2 questions | E7 Vroom-Yetton, D5 Kano |
| `demo` | Pas-à-pas commenté avec exemples de phrases | F6 Six chapeaux |
| `calculator` | Tableau chiffré avec formule calculée, dont un mode matriciel pondéré | D6 WSJF, D7 Pugh |

## Origine du contenu

Le contenu des fiches est adapté du benchmark d'animation de réunion fourni dans
le projet (72 fiches réparties en 8 familles, séquences types, anti-patterns,
annexe de méthodes complémentaires).
