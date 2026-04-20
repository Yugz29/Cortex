# Contrat des patterns

## Rôle

Les patterns Cortex forment une couche d'interprétation bornée au-dessus du score par fichier.

Leur rôle est de :

- expliquer pourquoi un fichier ressort
- aider à prioriser où regarder en premier
- rendre le score plus facile à interpréter sans le transformer en verdict

Les patterns sont des signaux de maintenance. Ce ne sont pas des jugements sur le code.

## Signaux autorisés

Les patterns Cortex ne peuvent utiliser que des signaux déjà présents dans le modèle actuel :

- score global du fichier
- composantes du score
- métriques structurelles brutes
- hotspot score
- tendance de score à court terme

Cela inclut des signaux dérivés de :

- complexité
- complexité cognitive
- taille des fonctions
- profondeur d'imbrication
- churn
- nombre de paramètres
- fan-in

La fiabilité décrit à quel point Cortex peut soutenir un pattern à partir des signaux actuels. Elle ne mesure ni la vérité ni la gravité du problème sous-jacent.

## Patterns pris en charge

### Hotspot de maintenance

**Sur quoi il se base**

- score fichier élevé
- hotspot score élevé
- en général une combinaison de charge structurelle et de churn récent

**Ce que cela veut probablement dire**

- ce fichier est coûteux à modifier et il est déjà souvent modifié
- c'est un bon candidat pour une revue en priorité

**Ce que cela ne veut pas dire**

- le fichier contient des bugs
- le churn est nuisible plutôt que routinier
- le fichier doit être refactoré immédiatement

**Fiabilité**

Élevée

### Charge structurelle élevée

**Sur quoi il se base**

- score fichier élevé
- les contributeurs structurels dominent le signal
- surtout la complexité, la complexité cognitive, la taille des fonctions ou la profondeur

**Ce que cela veut probablement dire**

- le fichier est structurellement coûteux à lire ou à modifier
- le score est principalement tiré par la forme du code plutôt que par l'activité de changement récente

**Ce que cela ne veut pas dire**

- le design est mauvais
- la complexité est inutile
- le fichier est dangereux du point de vue produit ou runtime

**Fiabilité**

Moyenne

### Grandes fonctions

**Sur quoi il se base**

- contribution élevée de la taille des fonctions
- présence de routines inhabituellement longues dans le fichier

**Ce que cela veut probablement dire**

- au moins une routine concentre beaucoup de logique au même endroit
- le fichier est probablement coûteux à relire et à modifier

**Ce que cela ne veut pas dire**

- la routine est incorrecte
- la longueur suffit à elle seule pour qualifier le code de mauvais

**Fiabilité**

Élevée

### Fichier à fan-in élevé

**Sur quoi il se base**

- fan-in élevé
- surtout si le fichier est aussi sous forte pression ou déjà critique

**Ce que cela veut probablement dire**

- de nombreux autres fichiers dépendent de ce fichier
- les changements ici peuvent avoir un impact plus large que la moyenne

**Ce que cela ne veut pas dire**

- le fichier est fragile
- le design est mauvais
- le fichier doit être découpé

**Fiabilité**

Élevée pour la centralité de dépendance  
Moyenne pour la préoccupation de maintenance

### Fichier à churn élevé

**Sur quoi il se base**

- contribution élevée du churn
- sans preuve claire que la charge structurelle est le moteur principal

**Ce que cela veut probablement dire**

- ce fichier est souvent touché
- il peut mériter de l'attention parce qu'il a connu des changements récents répétés

**Ce que cela ne veut pas dire**

- le fichier est instable
- les changements récents reflètent de la dette plutôt que des éditions routinières

**Fiabilité**

Moyenne

### Hausse récente du score

**Sur quoi il se base**

- tendance récente du score à la hausse
- ou franchissement récent d'un seuil

**Ce que cela veut probablement dire**

- la pression de maintenance augmente
- ce fichier peut mériter une nouvelle vérification rapide si la hausse continue

**Ce que cela ne veut pas dire**

- la qualité du code a objectivement régressé
- le comportement a régressé
- le changement est significatif au-delà de la fenêtre de scoring actuelle

**Fiabilité**

Moyenne

## Patterns interdits

Cortex ne doit pas prétendre détecter :

- des bugs
- la sûreté
- la sécurité
- une vérité architecturale
- la criticité métier
- l'importance produit
- la correction fonctionnelle
- l'intention du code
- la complexité justifiée vs injustifiée
- le churn trivial vs significatif

Il doit aussi éviter les labels trop proches du jugement, par exemple :

- fichier sujet aux bugs
- fichier non sûr
- fichier sain
- fichier stable
- violation architecturale
- god object
- complexité nécessaire

## Règle d'usage

Les patterns expliquent et aident à prioriser.

Les patterns ne jugent pas.

Ils peuvent décrire ce que le signal actuel suggère.

Ils ne doivent pas présenter cette suggestion comme une vérité.

## Principe central

Cortex nomme des signaux de maintenance, pas des vérités sur le code.
