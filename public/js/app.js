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