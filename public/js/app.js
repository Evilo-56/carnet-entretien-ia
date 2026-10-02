// ----------------------------------------------------
// 0. Guard d'authentification (Vérification de session)
// ----------------------------------------------------
(function checkAuthGuard() {
  const currentUser = sessionStorage.getItem("user");
  const isLoginPage = window.location.pathname.includes("login.html");

  if (!currentUser && !isLoginPage) {
    window.location.href = "login.html";
    return;
  }

  if (currentUser && isLoginPage) {
    window.location.href = "vehicles.html";
    return;
  }
})();

// Fonction globale de suppression d'intervention
window.deleteMaintenance = async function(maintenanceId, vehicleId) {
  if (!confirm("Voulez-vous vraiment supprimer cet entretien ?")) {
    return;
  }

  try {
    const response = await fetch(`http://127.0.0.1:8000/api/maintenances/${maintenanceId}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      throw new Error("Erreur de suppression");
    }

    // Rechargement immédiat du tableau de bord et recalcul des indicateurs
    loadVehicleDashboard(vehicleId);
  } catch (error) {
    console.error("Erreur suppression :", error);
    alert("Impossible de supprimer cette opération.");
  }
};

document.addEventListener("DOMContentLoaded", () => {
  // 1. Connexion (login.html)
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const email = document.getElementById("loginEmail").value;
      const password = document.getElementById("loginPassword").value;
      const errorEl = document.getElementById("loginError");

      try {
        const response = await fetch("http://127.0.0.1:8000/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        });

        if (!response.ok) throw new Error("Identifiants incorrects");

        const data = await response.json();
        sessionStorage.setItem("user", JSON.stringify(data.user));
        window.location.href = "vehicles.html";
      } catch (err) {
        if (errorEl) {
          errorEl.textContent = "Identifiants invalides. Réessayez.";
          errorEl.style.display = "block";
        }
      }
    });
  }

  // 2. Déconnexion
  const btnLogout = document.getElementById("btnLogout");
  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      sessionStorage.removeItem("user");
      window.location.href = "login.html";
    });
  }

  // 3. Scan OCR & Ajout d'entretien (add-maintenance.html)
  const invoiceFileInput = document.getElementById("invoiceFile");
  const maintenanceForm = document.getElementById("maintenanceForm");

  if (invoiceFileInput) {
    invoiceFileInput.addEventListener("change", async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      const dropzone = document.querySelector(".ocr-dropzone");
      const label = dropzone ? dropzone.querySelector(".ocr-label") : null;
      if (label) label.textContent = "Analyse OCR en cours sur le serveur…";

      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch("http://127.0.0.1:8000/api/scan-invoice", {
          method: "POST",
          body: formData
        });

        if (!response.ok) throw new Error("Erreur scan");

        const result = await response.json();
        const extracted = result.data;

        document.getElementById("date_intervention").value = extracted.date_operation;
        document.getElementById("kilometrage").value = extracted.kilometrage;
        document.getElementById("type_operation").value = extracted.type_operation;
        document.getElementById("montant_ttc").value = extracted.montant_ttc.toFixed(2);

        if (label) label.textContent = "✓ Facture numérisée avec succès";
      } catch (error) {
        console.error("Erreur OCR :", error);
        if (label) label.textContent = "Erreur lors de l'analyse.";
      }
    });
  }

  if (maintenanceForm) {
    maintenanceForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const rawMontant = document.getElementById("montant_ttc").value.toString().replace(",", ".");
      const montantFinal = parseFloat(rawMontant) || 0.0;
      const urlParams = new URLSearchParams(window.location.search);
      const vehicleId = parseInt(urlParams.get("id") || "1", 10);

      const payload = {
        vehicle_id: vehicleId,
        date_operation: document.getElementById("date_intervention").value,
        kilometrage: parseInt(document.getElementById("kilometrage").value, 10),
        type_operation: document.getElementById("type_operation").value,
        montant_ttc: montantFinal
      };

      try {
        const response = await fetch("http://127.0.0.1:8000/api/maintenances", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error("Erreur enregistrement");

        window.location.href = `detail.html?id=${vehicleId}`;
      } catch (error) {
        console.error("Erreur :", error);
        alert("Impossible d'enregistrer l'opération.");
      }
    });
  }

  // 4. Ajout d'un véhicule (add-vehicle.html)
  const vehicleForm = document.getElementById("vehicleForm");
  if (vehicleForm) {
    vehicleForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const payload = {
        user_id: 1,
        marque: document.getElementById("vehicleMarque").value,
        modele: document.getElementById("vehicleModele").value,
        motorisation: document.getElementById("vehicleMotorisation").value,
        immatriculation: document.getElementById("vehicleImmat").value,
        kilometrage_actuel: parseInt(document.getElementById("vehicleKm").value, 10)
      };

      try {
        const response = await fetch("http://127.0.0.1:8000/api/vehicles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error("Erreur lors de la création du véhicule");

        const result = await response.json();
        window.location.href = `detail.html?id=${result.id}`;
      } catch (error) {
        console.error("Erreur :", error);
        alert("Impossible d'ajouter le véhicule.");
      }
    });
  }

  // 5. Liste des véhicules (vehicles.html)
  loadVehiclesList();

  // 6. Tableau de bord véhicule (detail.html)
  const urlParams = new URLSearchParams(window.location.search);
  const vehicleId = urlParams.get("id") || 1;
  
  const btnAddMaintenance = document.getElementById("btnAddMaintenance");
  if (btnAddMaintenance) {
    btnAddMaintenance.href = `add-maintenance.html?id=${vehicleId}`;
  }

  loadVehicleDashboard(vehicleId);
});

async function loadVehiclesList() {
  const container = document.getElementById("vehiclesList");
  if (!container) return;

  try {
    const response = await fetch("http://127.0.0.1:8000/api/vehicles");
    if (!response.ok) throw new Error("Erreur de récupération des véhicules");

    const vehicles = await response.json();

    container.innerHTML = vehicles.map(v => {
      const badgeClass = v.nb_alertes > 0 ? "badge-warning" : "badge-success";
      const badgeText = v.nb_alertes > 0 ? `${v.nb_alertes} à surveiller` : "À jour";

      return `
        <div class="vehicle-card" onclick="window.location.href='detail.html?id=${v.id}'">
          <div class="vehicle-card-content">
            <div class="vehicle-details">
              <strong class="vehicle-title">${v.marque} ${v.modele}</strong>
              <p class="vehicle-meta">${v.kilometrage_actuel.toLocaleString("fr-FR")} km • ${v.immatriculation}</p>
            </div>
            <div class="vehicle-status">
              <span class="badge ${badgeClass}">${badgeText}</span>
              <span class="chevron">›</span>
            </div>
          </div>
        </div>
      `;
    }).join("");
  } catch (error) {
    console.error("Erreur API véhicules :", error);
    container.innerHTML = "<p>Erreur de chargement des données.</p>";
  }
}

async function loadVehicleDashboard(vehicleId = 1) {
  const titleEl = document.getElementById("vehicleTitle");
  const subtitleEl = document.getElementById("vehicleSubtitle");
  const predictionsContainer = document.getElementById("predictionsContainer");
  const historyList = document.getElementById("historyList");
  const statBudgetEl = document.getElementById("statBudget");
  const statCountEl = document.getElementById("statCount");

  if (!titleEl || !predictionsContainer || !historyList) return;

  try {
    const response = await fetch(`http://127.0.0.1:8000/api/vehicles/${vehicleId}/dashboard`);
    if (!response.ok) throw new Error("Erreur de récupération des données");

    const data = await response.json();

    titleEl.textContent = `${data.vehicle.marque} ${data.vehicle.modele}`;
    subtitleEl.textContent = `${data.vehicle.kilometrage_actuel.toLocaleString("fr-FR")} km • ${data.vehicle.immatriculation}`;

    const totalDepenses = data.maintenances.reduce((acc, m) => acc + (parseFloat(m.montant_ttc) || 0), 0);
    if (statBudgetEl) {
      statBudgetEl.textContent = totalDepenses.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
    }
    if (statCountEl) {
      statCountEl.textContent = data.maintenances.length;
    }

    predictionsContainer.innerHTML = data.predictions.map((p, index) => `
      <div class="ai-recommendation">
        <strong class="recommendation-name">${p.type_operation}</strong>
        <p class="recommendation-sub">Échéance estimée : ${p.echeance_texte}</p>
        <span class="badge ${p.statut === 'Prévu' ? 'badge-success' : 'badge-warning'}">${p.statut}</span>
      </div>
      ${index < data.predictions.length - 1 ? '<hr class="ai-divider">' : ''}
    `).join("");

    if (data.maintenances.length === 0) {
      historyList.innerHTML = `<li class="history-item"><span class="history-meta">Aucune intervention enregistrée pour ce véhicule.</span></li>`;
    } else {
      historyList.innerHTML = data.maintenances.map(m => {
        const dateFr = new Date(m.date_operation).toLocaleDateString("fr-FR");
        const montantFr = Number(m.montant_ttc).toLocaleString("fr-FR", { minimumFractionDigits: 2 });
        
        return `
          <li class="history-item">
            <div class="history-header">
              <span class="history-name">${m.type_operation}</span>
              <button type="button" class="btn-delete-op" onclick="deleteMaintenance(${m.id}, ${vehicleId})" title="Supprimer cette opération">✕</button>
            </div>
            <span class="history-meta">${dateFr} à ${m.kilometrage.toLocaleString("fr-FR")} km</span>
            <span class="history-cost">${montantFr} €</span>
          </li>
        `;
      }).join("");
    }

  } catch (error) {
    console.error("Erreur lors de l'appel API :", error);
  }
}