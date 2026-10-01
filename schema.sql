-- Suppression des tables si elles existent déjà
DROP TABLE IF EXISTS predictions;
DROP TABLE IF EXISTS maintenances;
DROP TABLE IF EXISTS vehicles;
DROP TABLE IF EXISTS users;

-- 1. Table Utilisateurs (Authentification et sécurité)
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(180) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    nom VARCHAR(100),
    prenom VARCHAR(100),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Table Véhicules
CREATE TABLE vehicles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    immatriculation VARCHAR(15) NOT NULL,
    marque VARCHAR(50) NOT NULL,
    modele VARCHAR(50) NOT NULL,
    annee INT NOT NULL,
    motorisation VARCHAR(50),
    kilometrage_actuel INT NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_vehicle_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Table Entretiens (Alimentée à la main ou via l'OCR de facture)
CREATE TABLE maintenances (
    id INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id INT NOT NULL,
    date_intervention DATE NOT NULL,
    kilometrage INT NOT NULL,
    type_operation VARCHAR(100) NOT NULL,
    montant_ttc DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    garage_nom VARCHAR(150),
    facture_image_url VARCHAR(255),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_maintenance_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Table Prédictions IA (Résultats du modèle prédictif)
CREATE TABLE predictions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id INT NOT NULL,
    type_operation VARCHAR(100) NOT NULL,
    kilometrage_estime INT NOT NULL,
    date_estimee DATE,
    confiance DECIMAL(5, 2),
    generee_le DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_prediction_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;