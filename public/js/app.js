document.addEventListener("DOMContentLoaded", () => {
  // 1. Gestion de la connexion (login.html)
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

        if (!response.ok) {
          throw new Error("Identifiants incorrects");
        }

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

  // 2. Gestion de l'upload et appel du service OCR backend (add-maintenance.html)
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

        if (!response.ok) {
          throw new Error("Erreur de numérisation");
        }

        const result = await response.json();
        const extracted = result.data;

        // Pré-remplissage automatique des champs à partir de la réponse OCR
        document.getElementById("date_intervention").value = extracted.date_operation;
        document.getElementById("kilometrage").value = extracted.kilometrage;
        document.getElementById("type_operation").value = extracted.type_operation;
        document.getElementById("montant_ttc").value = extracted.montant_ttc.toFixed(2);

        if (label) label.textContent = "✓ Facture numérisée avec succès";
      } catch (error) {
        console.error("Erreur OCR :", error);
        if (label) label.textContent = "Erreur lors de l'analyse. Saisie manuelle possible.";
      }
    });
  }

  // 3. Enregistrement de l'entretien
  if (maintenanceForm) {
    maintenanceForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const rawMontant = document.getElementById("montant_ttc").value.toString().replace(",", ".");
      const montantFinal = parseFloat(rawMontant) || 0.0;

      const payload = {
        vehicle_id: 1,
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

        if (!response.ok) {
          throw new Error("Erreur lors de l'enregistrement");
        }

        window.location.href = "detail.html";
      } catch (error) {
        console.error("Erreur :", error);
        alert("Impossible d'enregistrer l'opération.");
      }
    });
  }

  // 4. Chargement de la liste des véhicules (vehicles.html)
  loadVehiclesList();

  // 5. Chargement du tableau de bord véhicule (detail.html)
  const urlParams = new URLSearchParams(window.location.search);
  const vehicleId = urlParams.get("id") || 1;
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
        <div class="vehicle-item-card" onclick="window.location.href='detail.html?id=${v.id}'" style="cursor: pointer;">
          <div class="vehicle-info">
            <strong class="vehicle-title">${v.marque} ${v.modele}</strong>
            <p class="vehicle-meta">${v.kilometrage_actuel.toLocaleString("fr-FR")} km • ${v.immatriculation}</p>
          </div>
          <span class="badge ${badgeClass}">${badgeText}</span>
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

  if (!titleEl || !predictionsContainer || !historyList) return;

  try {
    const response = await fetch(`http://127.0.0.1:8000/api/vehicles/${vehicleId}/dashboard`);
    if (!response.ok) throw new Error("Erreur de récupération des données");

    const data = await response.json();

    titleEl.textContent = `${data.vehicle.marque} ${data.vehicle.modele}`;
    subtitleEl.textContent = `${data.vehicle.kilometrage_actuel.toLocaleString("fr-FR")} km • ${data.vehicle.immatriculation}`;

    predictionsContainer.innerHTML = data.predictions.map((p, index) => `
      <div class="ai-recommendation">
        <div class="recommendation-content">
          <strong class="recommendation-name">${p.type_operation}</strong>
          <p class="recommendation-sub">Échéance estimée : ${p.echeance_texte}</p>
        </div>
        <span class="badge ${p.statut === 'Prévu' ? 'badge-success' : 'badge-warning'}">${p.statut}</span>
      </div>
      ${index < data.predictions.length - 1 ? '<hr class="ai-divider">' : ''}
    `).join("");

    historyList.innerHTML = data.maintenances.map(m => {
      const dateFr = new Date(m.date_operation).toLocaleDateString("fr-FR");
      const montantFr = Number(m.montant_ttc).toLocaleString("fr-FR", { minimumFractionDigits: 2 });
      
      return `
        <li class="history-item">
          <span class="history-name">${m.type_operation}</span>
          <span class="history-meta">${dateFr} à ${m.kilometrage.toLocaleString("fr-FR")} km</span>
          <span class="history-cost">${montantFr} €</span>
        </li>
      `;
    }).join("");

  } catch (error) {
    console.error("Erreur lors de l'appel API :", error);
  }
}