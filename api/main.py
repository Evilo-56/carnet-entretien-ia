import sqlite3
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="AutoCarnet AI API",
    description="API de suivi d'entretien automobile et prédictions de maintenance",
    version="1.0.0"
)

# Autoriser les requêtes depuis les fichiers front-end locaux
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_NAME = "carnet_entretien.db"

def get_db_connection():
    """Ouvre une connexion SQLite avec accès aux colonnes par leur nom."""
    conn = sqlite3.connect(DATABASE_NAME)
    conn.row_factory = sqlite3.Row
    return conn

@app.get("/")
def read_root():
    return {"status": "ok", "message": "API AutoCarnet AI opérationnelle"}

@app.get("/api/vehicles/{vehicle_id}/dashboard")
def get_vehicle_dashboard(vehicle_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Données du véhicule
    cursor.execute("SELECT * FROM vehicles WHERE id = ?", (vehicle_id,))
    vehicle = cursor.fetchone()

    if not vehicle:
        conn.close()
        raise HTTPException(status_code=404, detail="Véhicule introuvable")

    # 2. Prédictions IA
    cursor.execute("""
        SELECT type_operation, kilometrage_estime, echeance_texte, statut 
        FROM predictions 
        WHERE vehicle_id = ?
    """, (vehicle_id,))
    predictions = [dict(row) for row in cursor.fetchall()]

    # 3. Historique réel des entretiens
    cursor.execute("""
        SELECT type_operation, date_operation, kilometrage, montant_ttc 
        FROM maintenances 
        WHERE vehicle_id = ? 
        ORDER BY date_operation DESC
    """, (vehicle_id,))
    maintenances = [dict(row) for row in cursor.fetchall()]

    conn.close()

    return {
        "vehicle": dict(vehicle),
        "predictions": predictions,
        "maintenances": maintenances
    }