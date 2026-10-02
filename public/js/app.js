// Auth guard
(function() {
  const user = sessionStorage.getItem("user");
  const isLoginPage = window.location.pathname.includes("login.html");

  if (!user && !isLoginPage) {
    window.location.href = "login.html";
  } else if (user && isLoginPage) {
    window.location.href = "vehicles.html";
  }
})();

// Action suppression
window.deleteMaintenance = async function(maintenanceId, vehicleId) {
  if (!confirm("Supprimer cette opération ?")) return;

  try {
    const res = await fetch(`http://127.0.0.1:8000/api/maintenances/${maintenanceId}`, {
      method: "DELETE"
    });
    if (!res.ok) throw new Error("Erreur suppression");
    loadVehicleDashboard(vehicleId);
  } catch (err) {
    console.error(err);
    alert("Erreur lors de la suppression.");
  }
};

document.addEventListener("DOMContentLoaded", () => {
  // Login
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("loginEmail").value;
      const password = document.getElementById("loginPassword").value;
      const errorEl = document.getElementById("loginError");

      try {
        const res = await fetch("http://127.0.0.1:8000/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        });

        if (!res.ok) throw new Error();
        const data = await res.json();
        sessionStorage.setItem("user", JSON.stringify(data.user));
        window.location.href = "vehicles.html";
      } catch {
        if (errorEl) {
          errorEl.textContent = "Identifiants invalides.";
          errorEl.style.display = "block";
        }
      }
    });
  }

  // Logout
  const btnLogout = document.getElementById("btnLogout");
  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      sessionStorage.removeItem("user");
      window.location.href = "login.html";
    });
  }

  // Upload facture & OCR
  const invoiceFileInput = document.getElementById("invoiceFile");
  if (invoiceFileInput) {
    invoiceFileInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const dropzone = document.querySelector(".ocr-dropzone");
      const label = dropzone ? dropzone.querySelector(".ocr-label") : null;
      if (label) label.textContent = "Analyse en cours…";

      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("http://127.0.0.1:8000/api/scan-invoice", {
          method: "POST",
          body: formData
        });
        if (!res.ok) throw new Error();

        const result = await res.json();
        const extracted = result.data;

        document.getElementById("date_intervention").value = extracted.date_operation;
        document.getElementById("kilometrage").value = extracted.kilometrage;
        document.getElementById("type_operation").value = extracted.type_operation;
        document.getElementById("montant_ttc").value = extracted.montant_ttc.toFixed(2);

        if (label) label.textContent = "Facture analysée avec succès";
      } catch {
        if (label) label.textContent = "Échec du scan.";
      }
    });
  }

  // Formulaire entretien
  const maintenanceForm = document.getElementById("maintenanceForm");
  if (maintenanceForm) {
    maintenanceForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const rawMontant = document.getElementById("montant_ttc").value.replace(",", ".");
      const urlParams = new URLSearchParams(window.location.search);
      const vehicleId = parseInt(urlParams.get("id") || "1", 10);

      const payload = {
        vehicle_id: vehicleId,
        date_operation: document.getElementById("date_intervention").value,
        kilometrage: parseInt(document.getElementById("kilometrage").value, 10),
        type_operation: document.getElementById("type_operation").value,
        montant_ttc: parseFloat(rawMontant) || 0.0
      };

      try {
        const res = await fetch("http://127.0.0.1:8000/api/maintenances", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error();
        window.location.href = `detail.html?id=${vehicleId}`;
      } catch {
        alert("Erreur lors de l'enregistrement.");
      }
    });
  }

  // Formulaire véhicule
  const vehicleForm = document.getElementById("vehicleForm");
  if (vehicleForm) {
    vehicleForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = {
        user_id: 1,
        marque: document.getElementById("vehicleMarque").value,
        modele: document.getElementById("vehicleModele").value,
        motorisation: document.getElementById("vehicleMotorisation").value,
        immatriculation: document.getElementById("vehicleImmat").value,
        kilometrage_actuel: parseInt(document.getElementById("vehicleKm").value, 10)
      };

      try {
        const res = await fetch("http://127.0.0.1:8000/api/vehicles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error();
        const result = await res.json();
        window.location.href = `detail.html?id=${result.id}`;
      } catch {
        alert("Erreur lors de l'ajout du véhicule.");
      }
    });
  }

  // Chargements initiaux
  loadVehiclesList();

  const urlParams = new URLSearchParams(window.location.search);
  const vehicleId = urlParams.get("id") || 1;

  const btnAdd = document.getElementById("btnAddMaintenance");
  if (btnAdd) {
    btnAdd.href = `add-maintenance.html?id=${vehicleId}`;
  }

  loadVehicleDashboard(vehicleId);
});

async function loadVehiclesList() {
  const container = document.getElementById("vehiclesList");
  if (!container) return;

  try {
    const res = await fetch("http://127.0.0.1:8000/api/vehicles");
    if (!res.ok) throw new Error();
    const vehicles = await res.json();

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
  } catch {
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
    const res = await fetch(`http://127.0.0.1:8000/api/vehicles/${vehicleId}/dashboard`);
    if (!res.ok) throw new Error();
    const data = await res.json();

    titleEl.textContent = `${data.vehicle.marque} ${data.vehicle.modele}`;
    subtitleEl.textContent = `${data.vehicle.kilometrage_actuel.toLocaleString("fr-FR")} km • ${data.vehicle.immatriculation}`;

    const totalDepenses = data.maintenances.reduce((acc, m) => acc + (parseFloat(m.montant_ttc) || 0), 0);
    if (statBudgetEl) {
      statBudgetEl.textContent = totalDepenses.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
    }
    if (statCountEl) {
      statCountEl.textContent = data.maintenances.length;
    }

    predictionsContainer.innerHTML = data.predictions.map((p, idx) => `
      <div class="ai-recommendation">
        <strong class="recommendation-name">${p.type_operation}</strong>
        <p class="recommendation-sub">Échéance estimée : ${p.echeance_texte}</p>
        <span class="badge ${p.statut === 'Prévu' ? 'badge-success' : 'badge-warning'}">${p.statut}</span>
      </div>
      ${idx < data.predictions.length - 1 ? '<hr class="ai-divider">' : ''}
    `).join("");

    if (data.maintenances.length === 0) {
      historyList.innerHTML = `<li class="history-item"><span class="history-meta">Aucune intervention enregistrée.</span></li>`;
    } else {
      historyList.innerHTML = data.maintenances.map(m => {
        const dateFr = new Date(m.date_operation).toLocaleDateString("fr-FR");
        const montantFr = Number(m.montant_ttc).toLocaleString("fr-FR", { minimumFractionDigits: 2 });
        return `
          <li class="history-item">
            <div class="history-header">
              <span class="history-name">${m.type_operation}</span>
              <button type="button" class="btn-delete-op" onclick="deleteMaintenance(${m.id}, ${vehicleId})" title="Supprimer">✕</button>
            </div>
            <span class="history-meta">${dateFr} à ${m.kilometrage.toLocaleString("fr-FR")} km</span>
            <span class="history-cost">${montantFr} €</span>
          </li>
        `;
      }).join("");
    }
  } catch (err) {
    console.error(err);
  }
}