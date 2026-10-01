# Carnet d'Entretien Automobile Intelligent (TP DWWM & IA)

Application web mobile-first permettant aux propriétaires de véhicules de suivre leurs entretiens et d'anticiper les pannes grâce à l'intelligence artificielle.

## Fonctionnalités principales

1. **Gestion du parc automobile** : enregistrement des véhicules, suivi du kilométrage et historique des opérations.
2. **Scan intelligent de factures (OCR)** : extraction automatique des données clés (date, kilométrage, montants) depuis une photo de facture pour pré-remplir la saisie.
3. **Maintenance prédictive** : estimation des prochaines échéances d'entretien et détection des opérations critiques selon l'usage réel.

## Architecture technique

* **Front-end** : Interface Web Responsive (HTML5 / CSS3 / JavaScript natif), maquettée sous Figma.
* **Back-end** : API REST et logique métier.
* **Base de données** : Modèle relationnel SQL (MariaDB/MySQL).
* **Briques IA (Python)** :
  * Modèle OCR pour l'extraction de texte sur images.
  * Modèle Scikit-learn pour la régression et la prédiction d'échéances d'usure.
* **DevOps** : Conteneurisation avec Docker.