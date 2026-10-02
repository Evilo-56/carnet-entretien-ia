import io
import re
import sqlite3
import random
from datetime import date
from fastapi import FastAPI, HTTPException, UploadFile, File
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

MOCK_INVOICE_TEMPLATES = [
    {
        "type_operation": "Vidange moteur + filtre",
        "montant_ttc": 195.50,
        "km_delta": 3000
    },
    {
        "type_operation": "Disques et plaquettes AV",
        "montant_ttc": 340.00,
        "km_delta": 4500
    },
    {
        "type_operation": "Courroie de distribution",
        "montant_ttc": 680.00,
        "km_delta": 5000
    },
    {
        "type_operation": "Purge liquide de frein",
        "montant_ttc": 85.00,
        "km_delta": 1500
    }
]

def get_db_connection():
    conn = sqlite3.connect(DATABASE_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def update_predictions(cursor, vehicle_id: int, current_km: int):
    for operation, rules in MAINTENANCE_INTERVALS.items():
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

        if last_op:
            last_km = last_op["kilometrage"]
            next_km = last_km + rules["intervalle"]
            remaining_km = next_km - current_km
        else:
            # Sans facture passée : projection sur le cycle théorique constructeur
            modulo = current_km % rules["intervalle"]
            remaining_km = rules["intervalle"] - modulo if modulo != 0 else rules["intervalle"]
            next_km = current_km + remaining_km

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

class LoginRequest(BaseModel):
    email: str
    password: str

class VehicleCreate(BaseModel):
    user_id: int = 1
    marque: str
    modele: str
    motorisation: str
    immatriculation: str
    kilometrage_actuel: int

class MaintenanceCreate(BaseModel):
    vehicle_id: int
    type_operation: str
    date_operation: str
    kilometrage: int
    montant_ttc: float

@app.get("/")
def read_root():
    return {"status": "ok", "message": "API AutoCarnet AI opérationnelle"}

@app.post("/api/scan-invoice")
async def scan_invoice(file: UploadFile = File(...)):
    await file.read()

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT kilometrage_actuel FROM vehicles WHERE id = 1")
    row = cursor.fetchone()
    current_km = row["kilometrage_actuel"] if row else 162000
    conn.close()

    filename_lower = file.filename.lower()
    if "vidange" in filename_lower:
        template = MOCK_INVOICE_TEMPLATES[0]
    elif "frein" in filename_lower or "plaquette" in filename_lower:
        template = MOCK_INVOICE_TEMPLATES[1]
    elif "distribution" in filename_lower or "courroie" in filename_lower:
        template = MOCK_INVOICE_TEMPLATES[2]
    else:
        template = random.choice(MOCK_INVOICE_TEMPLATES)

    return {
        "status": "success",
        "filename": file.filename,
        "data": {
            "date_operation": date.today().strftime("%Y-%m-%d"),
            "kilometrage": current_km + template["km_delta"],
            "type_operation": template["type_operation"],
            "montant_ttc": template["montant_ttc"]
        }
    }

@app.post("/api/login")
def login(credentials: LoginRequest):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, email 
        FROM users 
        WHERE email = ? AND password_hash = ?
    """, (credentials.email, credentials.password))
    user = cursor.fetchone()
    conn.close()

    if not user:
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")

    return {
        "message": "Connexion réussie",
        "user": dict(user)
    }

@app.get("/api/vehicles")
def get_vehicles():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT v.*, 
               (SELECT COUNT(*) FROM predictions p WHERE p.vehicle_id = v.id AND p.statut = 'À surveiller') AS nb_alertes
        FROM vehicles v
        ORDER BY v.id DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

@app.post("/api/vehicles", status_code=201)
def create_vehicle(vehicle: VehicleCreate):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO vehicles (user_id, marque, modele, motorisation, immatriculation, kilometrage_actuel)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (
        vehicle.user_id,
        vehicle.marque.strip(),
        vehicle.modele.strip(),
        vehicle.motorisation.strip(),
        vehicle.immatriculation.strip().upper(),
        vehicle.kilometrage_actuel
    ))
    new_vehicle_id = cursor.lastrowid

    update_predictions(cursor, new_vehicle_id, vehicle.kilometrage_actuel)

    conn.commit()
    conn.close()

    return {"message": "Véhicule créé avec succès", "id": new_vehicle_id}

@app.get("/api/vehicles/{vehicle_id}/dashboard")
def get_vehicle_dashboard(vehicle_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM vehicles WHERE id = ?", (vehicle_id,))
    vehicle = cursor.fetchone()

    if not vehicle:
        conn.close()
        raise HTTPException(status_code=404, detail="Véhicule introuvable")

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
        ORDER BY date_operation DESC, kilometrage DESC
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

    cursor.execute("""
        UPDATE vehicles 
        SET kilometrage_actuel = MAX(kilometrage_actuel, ?) 
        WHERE id = ?
    """, (maintenance.kilometrage, maintenance.vehicle_id))

    cursor.execute("SELECT kilometrage_actuel FROM vehicles WHERE id = ?", (maintenance.vehicle_id,))
    updated_km = cursor.fetchone()["kilometrage_actuel"]

    update_predictions(cursor, maintenance.vehicle_id, updated_km)

    conn.commit()
    conn.close()

    return {"message": "Entretien enregistré et prédictions actualisées"}