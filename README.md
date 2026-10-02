# 🚗 AutoCarnet AI — Carnet d'entretien automobile intelligent

> Fini les factures froissées au fond de la boîte à gants et les révisions oubliées. **AutoCarnet AI** est une application web pensée pour mobile permettant de centraliser l'historique de ses véhicules, de numériser ses factures et d'anticiper les interventions mécaniques à venir.

Projet conçu et développé dans le cadre de la formation **Développeur Web & Intelligence Artificielle (DWWM)**.

---

## 💡 Pourquoi ce projet ?

L'entretien d'une voiture repose souvent sur des carnets papier perdus ou des factures éparpillées. Résultat : on ne sait jamais exactement quand prévoir la prochaine courroie de distribution, si les plaquettes de frein ont 10 000 ou 40 000 km, ni combien la voiture a réellement coûté sur l'année.

**AutoCarnet AI** répond à ce problème en combinant deux axes :
1. **Zéro saisie fastidieuse** : on prend en photo une facture, le système en extrait les données utiles (date, kilomètres, montant, opération) et pré-remplit le formulaire.
2. **Une maintenance anticipée** : l'application calcule en temps réel l'usure prévisionnelle des organes d'usure majeurs pour prévenir le conducteur avant qu'il ne soit trop tard.

---

## ✨ Fonctionnalités actuelles

- 🔐 **Espace personnel** : authentification sécurisée avec contrôle d'accès aux pages (*auth guard*).
- 🚘 **Gestion multi-véhicules** : ajout et suivi de plusieurs voitures (marque, motorisation, plaque, kilométrage).
- 📊 **Tableau de bord par véhicule** :
  - **KPIs directs** : budget total dépensé (€) et nombre d'interventions réalisées.
  - **Historique chronologique** : opérations passées triées par date et kilométrage.
- ⚙️ **Moteur d'échéances prédictives** : calcul dynamique des prochaines interventions (vidange, distribution, freins) avec bascule automatique en statut **« À surveiller »** selon des seuils d'alerte.
- 📄 **Module d'ingestion de facture (OCR)** : upload d'une photo de facture via l'API et extraction automatique des informations.

---

## 🛠️ Stack technique & choix d'architecture

L'objectif était de construire une application performante, maintenable et rapide à déployer sans surcharger l'environnement de dépendances inutiles.

| Brique | Outil | Pourquoi ce choix ? |
| :--- | :--- | :--- |
| **Backend** | **Python / FastAPI** | Ultra-rapide, asynchrone, validation stricte des données avec **Pydantic** et génération automatique de la doc Swagger interactive. Idéal pour manipuler de la donnée et des bibliothèques Python. |
| **Base de données** | **SQLite 3** | SGBD relationnel embarqué, léger, sans serveur lourd à configurer, garantissant l'intégrité référentielle par clés étrangères. |
| **Frontend** | **Vanilla HTML5 / CSS3 / JavaScript** | Approche *Mobile-First*. Aucun framework lourd (React/Vue) ni étape de compilation (`npm build`) : le DOM est mis à jour nativement via l'API Fetch. Léger, lisible et immédiat à charger. |
| **Traitement d'image** | **Pillow / Multipart** | Réception des images via des flux HTTP binaires (`multipart/form-data`) analysés côté serveur. |

---

## 🧠 L'approche « IA » : Un système expert explicable

Plutôt que d'intégrer une IA « boîte noire » (modèle de Deep Learning ou LLM externe) difficile à expliquer et sujette aux hallucinations sur des organes de sécurité critiques, le choix s'est porté sur **un système expert déterministe à base de règles** :

1. **Tolérance lexicale** : une vidange peut être notée « Vidange moteur », « Remplacement filtre à huile » ou « Forfait révision ». L'algorithme analyse l'historique via des racines de mots-clés (`vidange`, `frein`, `plaquette`, `courroie`) pour rattacher automatiquement la facture à la bonne règle constructeur.
2. **Projection différentielle & cyclique** :
   - Si une intervention passée existe : `Prochaine échéance = Dernier kilométrage connu + Intervalle constructeur`.
   - Si la voiture vient d'être enregistrée sans historique : l'algorithme utilise un calcul de reste (`modulo`) pour positionner la voiture dans son cycle constructeur théorique.
3. **Seuils d'alerte configurables** : dès que le delta restant passe sous la tolérance constructeur (ex: moins de 3 000 km avant la vidange), l'alerte passe en orange sur la liste des véhicules et sur la fiche détaillée.

---

## 🗄️ Structure de la base de données

La base relationnelle `carnet_entretien.db` est articulée autour de 4 tables :

```text
 ┌─────────────┐
 │    USERS    │ (id, email, password_hash, created_at)
 └──────┬──────┘
        │ 1:N
        ▼
 ┌─────────────┐
 │  VEHICLES   │ (id, user_id, marque, modele, immatriculation, kilometrage_actuel)
 └──────┬──────┘
        │
   ┌────┴────────────────────────┐
   │ 1:N                         │ 1:N
   ▼                             ▼
┌──────────────┐          ┌─────────────┐
│ MAINTENANCES │          │ PREDICTIONS │
└──────────────┘          └─────────────┘
(type, date, km, montant)  (type, km_estime, echeance, statut)