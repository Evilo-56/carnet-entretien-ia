# Image de base officielle Python légère
FROM python:3.10-slim

# Définition du répertoire de travail dans le conteneur
WORKDIR /app

# Variables d'environnement pour optimiser l'exécution de Python dans Docker
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Installation des dépendances
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copie du code de l'API et de la base de données SQLite initiale
COPY api/ ./api/
COPY carnet_entretien.db .

# Exposition du port d'écoute de l'API
EXPOSE 8000

# Démarrage de l'API avec Uvicorn sur l'adresse 0.0.0.0 (nécessaire dans Docker)
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]