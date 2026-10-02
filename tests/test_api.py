import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import time
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)

def test_root_endpoint():
    """Vérifie que l'API répond correctement sur sa route racine."""
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_login_invalid_credentials():
    """Vérifie le rejet d'une tentative de connexion avec de mauvais identifiants."""
    response = client.post("/api/login", json={
        "email": "inconnu@test.fr",
        "password": "mauvais_mot_de_passe"
    })
    assert response.status_code == 401

def test_register_and_duplicate_check():
    """Vérifie la création d'un compte et le blocage des doublons d'email."""
    unique_email = f"dev_{int(time.time())}@autocarnet.fr"

    # Création de compte réussie
    response = client.post("/api/register", json={
        "email": unique_email,
        "password": "mon_password_test"
    })
    assert response.status_code == 201
    assert response.json()["user"]["email"] == unique_email

    # Tentative avec le même email -> Doit échouer avec une erreur 400
    duplicate_res = client.post("/api/register", json={
        "email": unique_email,
        "password": "autre_password"
    })
    assert duplicate_res.status_code == 400

def test_vehicle_creation_and_predictions_init():
    """Vérifie la création d'un véhicule et le calcul initial des prédictions d'échéances."""
    payload = {
        "user_id": 1,
        "marque": "Renault",
        "modele": "Clio V",
        "motorisation": "1.0 TCe 90",
        "immatriculation": "WW-999-ZZ",
        "kilometrage_actuel": 42000
    }
    create_res = client.post("/api/vehicles", json=payload)
    assert create_res.status_code == 201
    vehicle_id = create_res.json()["id"]

    # Consultation du dashboard du nouveau véhicule
    dash_res = client.get(f"/api/vehicles/{vehicle_id}/dashboard")
    assert dash_res.status_code == 200
    data = dash_res.json()

    assert data["vehicle"]["marque"] == "Renault"
    assert len(data["predictions"]) == 3

def test_maintenance_lifecycle():
    """Vérifie l'enregistrement d'une intervention puis sa suppression avec recalcul."""
    payload = {
        "vehicle_id": 1,
        "type_operation": "Test Contrôle Pression",
        "date_operation": "2026-10-02",
        "kilometrage": 166500,
        "montant_ttc": 25.0
    }
    add_res = client.post("/api/maintenances", json=payload)
    assert add_res.status_code == 201

    dash = client.get("/api/vehicles/1/dashboard").json()
    maintenance_id = dash["maintenances"][0]["id"]

    del_res = client.delete(f"/api/maintenances/{maintenance_id}")
    assert del_res.status_code == 200