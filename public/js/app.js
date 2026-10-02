document.addEventListener("DOMContentLoaded", () => {
  const invoiceFileInput = document.getElementById("invoiceFile");
  const maintenanceForm = document.getElementById("maintenanceForm");

  if (invoiceFileInput) {
    invoiceFileInput.addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (!file) return;

      // Simulation du temps de traitement de l'algorithme OCR
      const dropzone = document.querySelector(".ocr-dropzone");
      const originalLabel = dropzone.querySelector(".ocr-label").textContent;
      dropzone.querySelector(".ocr-label").textContent = "Analyse de la facture par l'IA en cours…";

      setTimeout(() => {
        // Pré-remplissage automatique des champs extraits
        document.getElementById("date_intervention").value = "2026-10-02";
        document.getElementById("kilometrage").value = 162000;
        document.getElementById("type_operation").value = "Courroie de distribution";
        document.getElementById("montant_ttc").value = "650.00";

        dropzone.querySelector(".ocr-label").textContent = "✓ Facture analysée avec succès";
      }, 900);
    });
  }

  if (maintenanceForm) {
    maintenanceForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const payload = {
        vehicle_id: 1,
        date_operation: document.getElementById("date_intervention").value,
        kilometrage: parseInt(document.getElementById("kilometrage").value, 10),
        type_operation: document.getElementById("type_operation").value,
        montant_ttc: parseFloat(document.getElementById("montant_ttc").value)
      };

      try {
        const response = await fetch("http://127.0.0.1:8000/api/maintenances", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error("Erreur lors de l'enregistrement de l'entretien");
        }

        // Redirection vers le détail une fois l'enregistrement validé
        window.location.href = "detail.html";
      } catch (error) {
        console.error("Erreur :", error);
        alert("Impossible d'enregistrer l'opération.");
      }
    });
  }
});
// Chargement dynamique des données de l'API pour l'écran détail
async function loadVehicleDashboard(vehicleId = 1) {
  const titleEl = document.getElementById("vehicleTitle");
  const subtitleEl = document.getElementById("vehicleSubtitle");
  const predictionsContainer = document.getElementById("predictionsContainer");
  const historyList = document.getElementById("historyList");

  // On vérifie qu'on se trouve bien sur la page de détail
  if (!titleEl || !predictionsContainer || !historyList) return;

  try {
    const response = await fetch(`http://127.0.0.1:8000/api/vehicles/${vehicleId}/dashboard`);
    if (!response.ok) throw new Error("Erreur de récupération des données");

    const data = await response.json();

    // 1. Mise à jour des informations du véhicule
    titleEl.textContent = `${data.vehicle.marque} ${data.vehicle.modele}`;
    subtitleEl.textContent = `${data.vehicle.kilometrage_actuel.toLocaleString("fr-FR")} km • ${data.vehicle.immatriculation}`;

    // 2. Injection des prédictions IA
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

    // 3. Injection de l'historique SQL
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

// Déclenchement automatique au chargement du DOM
document.addEventListener("DOMContentLoaded", () => {
  // Récupère l'id passé dans l'URL (ex. detail.html?id=1) ou 1 par défaut
  const urlParams = new URLSearchParams(window.location.search);
  const vehicleId = urlParams.get("id") || 1;

  loadVehiclesList();
  loadVehicleDashboard(vehicleId);
});
// Chargement dynamique de la liste des véhicules
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