# Contrat du score

## Ce que le score est

Le score Cortex est une estimation du risque de maintenance par fichier relative aux seuils et baselines actuels de Cortex, pas un diagnostic.

Il est dérivé de signaux structurels et historiques locaux du codebase, comme :

- complexité
- complexité cognitive
- taille des fonctions
- profondeur d'imbrication
- churn récent
- nombre de paramètres
- fan-in

Son rôle est d'aider à classer les fichiers par pression de maintenance probable, pour savoir où regarder en premier.

## Ce que le score n'est pas

Le score ne mesure pas :

- des bugs réels
- des problèmes de sécurité
- la correction métier
- l'importance produit
- la correction fonctionnelle
- la qualité des tests
- l'impact utilisateur
- l'intention du code

Ce n'est pas une vérité sur la qualité du code.

## Ce que signifie un score élevé

Un score élevé signifie généralement que le fichier combine certains de ces traits :

- difficile à lire
- difficile à modifier avec confiance
- structurellement dense
- souvent touché
- utilisé par de nombreux autres fichiers

Inférences raisonnables :

- ce fichier mérite de l'attention avant les fichiers au score plus faible
- ce fichier a plus de chances de générer du coût de maintenance ou de la friction en revue
- ce fichier est un bon candidat à inspecter, pas à condamner automatiquement

## Ce que signifie un score faible

Un score faible signifie généralement que le fichier paraît structurellement plus léger et moins actif dans l'historique récent que les fichiers au score plus élevé.

Inférences raisonnables :

- ce fichier a moins de chances d'être un hotspot de maintenance immédiat
- ce fichier n'a probablement pas besoin d'être inspecté en premier

Ce que vous ne devez pas en déduire :

- le fichier est correct
- le fichier est sûr
- le fichier est bien conçu
- le fichier ne cache aucun risque

Un score faible signifie un signal structurel plus faible, pas une preuve de qualité.

## Comment l'utiliser

Utilisez le score pour :

- prioriser la revue de code
- décider où inspecter en premier
- comparer un fichier à son propre historique
- identifier les fichiers qui combinent charge structurelle et activité de changement récente élevée
- concentrer la discussion sur des hotspots de maintenance probables

Utilisez-le comme un signal de classement, puis lisez le fichier.

## Comment ne pas l'utiliser

N'utilisez pas le score pour :

- affirmer qu'un fichier contient des bugs
- affirmer qu'un fichier est sûr
- remplacer une revue humaine
- comparer trop littéralement des rôles de fichiers très différents
- justifier à lui seul des conclusions d'architecture
- présenter Cortex comme une source de vérité objective sur la qualité du code

Le score soutient le jugement. Il ne le remplace pas.

## Principe central

Cortex vous aide à décider où regarder. Il ne décide pas à votre place.
