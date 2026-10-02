import sqlite3

DATABASE_NAME = "carnet_entretien.db"

def init_database():
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()

    # 1. Création des tables via schema.sql
    with open("schema.sql", "r", encoding="utf-8") as f:
        schema = f.read()
    cursor.executescript(schema)

    # 2. Insertion des données de test
    cursor.execute("""
        INSERT OR IGNORE INTO users (id, email, password_hash)
        VALUES (1, 'contact@autocarnet.fr', 'hash_test_123')
    """)

    cursor.execute("""
        INSERT OR IGNORE INTO vehicles (id, user_id, marque, modele, motorisation, immatriculation, kilometrage_actuel)
        VALUES (1, 1, 'Citroën', 'C4 Picasso', '1.5 BlueHDi', 'FG-660-DT', 162000)
    """)

    cursor.execute("""
        INSERT OR IGNORE INTO maintenances (id, vehicle_id, type_operation, date_operation, kilometrage, montant_ttc)
        VALUES 
        (1, 1, 'Vidange moteur + filtre', '2026-03-12', 150000, 185.00),
        (2, 1, 'Disques et plaquettes AV', '2025-09-15', 138000, 320.00)
    """)

    cursor.execute("""
        INSERT OR IGNORE INTO predictions (id, vehicle_id, type_operation, kilometrage_estime, echeance_texte, statut)
        VALUES 
        (1, 1, 'Courroie de distribution', 180000, 'dans ~18 000 km', 'À surveiller'),
        (2, 1, 'Vidange & filtre à huile', 165000, 'dans 3 000 km', 'Prévu')
    """)

    conn.commit()
    conn.close()
    print("Base SQLite initialisée avec succès : carnet_entretien.db")

if __name__ == "__main__":
    init_database()