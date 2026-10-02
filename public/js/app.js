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
    maintenanceForm.addEventListener("submit", (event) => {
      event.preventDefault();
      // Redirection vers la page détail du véhicule après validation
      window.location.href = "detail.html";
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
  loadVehicleDashboard(1);
});