import sqlite3
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(
    title="AutoCarnet AI API",
    description="API de suivi d'entretien automobile et prédictions de maintenance",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_NAME = "carnet_entretien.db"

# Règles constructeur avec mots-clés tolérants aux variations de libellé
MAINTENANCE_INTERVALS = {
    "Vidange & filtre à huile": {
        "keywords": ["vidange"],
        "intervalle": 20000,
        "seuil_alerte": 3000
    },
    "Courroie de distribution": {
        "keywords": ["courroie", "distribution"],
        "intervalle": 100000,
        "seuil_alerte": 15000
    },
    "Disques et plaquettes AV": {
        "keywords": ["plaquette", "disque", "frein"],
        "intervalle": 60000,
        "seuil_alerte": 5000
    },
}

def get_db_connection():
    conn = sqlite3.connect(DATABASE_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def update_predictions(cursor, vehicle_id: int, current_km: int):
    """Recalcule les prédictions en retrouvant le dernier entretien par mot-clé."""
    for operation, rules in MAINTENANCE_INTERVALS.items():
        # Correspondance SQL insensible à la casse sur chacun des mots-clés
        where_clause = " OR ".join(["LOWER(type_operation) LIKE ?" for _ in rules["keywords"]])
        params = [vehicle_id] + [f"%{kw.lower()}%" for kw in rules["keywords"]]

        cursor.execute(f"""
            SELECT kilometrage 
            FROM maintenances 
            WHERE vehicle_id = ? AND ({where_clause})
            ORDER BY kilometrage DESC 
            LIMIT 1
        """, tuple(params))
        last_op = cursor.fetchone()

        last_km = last_op["kilometrage"] if last_op else 0
        next_km = last_km + rules["intervalle"]
        remaining_km = next_km - current_km

        if remaining_km <= rules["seuil_alerte"]:
            statut = "À surveiller"
            texte = f"dans ~{max(remaining_km, 0):,} km".replace(",", " ")
        else:
            statut = "Prévu"
            texte = f"dans ~{remaining_km:,} km".replace(",", " ")

        cursor.execute("""
            SELECT id FROM predictions 
            WHERE vehicle_id = ? AND type_operation = ?
        """, (vehicle_id, operation))
        row = cursor.fetchone()

        if row:
            cursor.execute("""
                UPDATE predictions 
                SET kilometrage_estime = ?, echeance_texte = ?, statut = ?
                WHERE id = ?
            """, (next_km, texte, statut, row["id"]))
        else:
            cursor.execute("""
                INSERT INTO predictions (vehicle_id, type_operation, kilometrage_estime, echeance_texte, statut)
                VALUES (?, ?, ?, ?, ?)
            """, (vehicle_id, operation, next_km, texte, statut))

class MaintenanceCreate(BaseModel):
    vehicle_id: int
    type_operation: str
    date_operation: str
    kilometrage: int
    montant_ttc: float

@app.get("/")
def read_root():
    return {"status": "ok", "message": "API AutoCarnet AI opérationnelle"}

@app.get("/api/vehicles")
def get_vehicles():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT v.*, 
               (SELECT COUNT(*) FROM predictions p WHERE p.vehicle_id = v.id AND p.statut = 'À surveiller') AS nb_alertes
        FROM vehicles v
    """)
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

@app.get("/api/vehicles/{vehicle_id}/dashboard")
def get_vehicle_dashboard(vehicle_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM vehicles WHERE id = ?", (vehicle_id,))
    vehicle = cursor.fetchone()

    if not vehicle:
        conn.close()
        raise HTTPException(status_code=404, detail="Véhicule introuvable")

    # Recalcul automatique des prédictions
    update_predictions(cursor, vehicle_id, vehicle["kilometrage_actuel"])
    conn.commit()

    cursor.execute("""
        SELECT type_operation, kilometrage_estime, echeance_texte, statut 
        FROM predictions 
        WHERE vehicle_id = ?
        ORDER BY kilometrage_estime ASC
    """, (vehicle_id,))
    predictions = [dict(row) for row in cursor.fetchall()]

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

@app.post("/api/maintenances", status_code=201)
def create_maintenance(maintenance: MaintenanceCreate):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO maintenances (vehicle_id, type_operation, date_operation, kilometrage, montant_ttc)
        VALUES (?, ?, ?, ?, ?)
    """, (
        maintenance.vehicle_id,
        maintenance.type_operation,
        maintenance.date_operation,
        maintenance.kilometrage,
        maintenance.montant_ttc
    ))

    # Mise à jour du compteur kilométrique
    cursor.execute("""
        UPDATE vehicles 
        SET kilometrage_actuel = MAX(kilometrage_actuel, ?) 
        WHERE id = ?
    """, (maintenance.kilometrage, maintenance.vehicle_id))

    cursor.execute("SELECT kilometrage_actuel FROM vehicles WHERE id = ?", (maintenance.vehicle_id,))
    updated_km = cursor.fetchone()["kilometrage_actuel"]

    # Recalcul immédiat des échéances
    update_predictions(cursor, maintenance.vehicle_id, updated_km)

    conn.commit()
    conn.close()

    return {"message": "Entretien enregistré et prédictions actualisées"}