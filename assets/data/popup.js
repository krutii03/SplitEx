// popupModal.js

// Function to initialize the modal
export function showModal(message, onConfirm, onCancel) {
    // Get the modal and its elements
    const modal = document.getElementById("commonModal");
    const modalMessage = document.getElementById("modalMessage");
    const confirmBtn = document.getElementById("modalConfirmBtn");
    const cancelBtn = document.getElementById("modalCancelBtn");
    
    // Set the message dynamically
    modalMessage.textContent = message;
    
    // Show the modal
    modal.style.display = "block";
  
    // When "Confirm" button is clicked
    confirmBtn.onclick = () => {
      modal.style.display = "none";
      if (onConfirm) onConfirm();
    };
  
    // When "Cancel" button is clicked
    cancelBtn.onclick = () => {
      modal.style.display = "none";
      if (onCancel) onCancel();
    };
  
    // When the close button (×) is clicked
    const closeBtn = document.querySelector(".close-btn");
    closeBtn.onclick = () => {
      modal.style.display = "none";
    };
  
    // Close the modal if the user clicks outside of it
    window.onclick = function(event) {
      if (event.target === modal) {
        modal.style.display = "none";
      }
    };
  }
  
  // You can also create a function to hide the modal explicitly if needed
  export function hideModal() {
    const modal = document.getElementById("commonModal");
    modal.style.display = "none";
  }

  function showOkPopup(message) {
    const popup = document.getElementById("okPopup");
    const messageElement = document.getElementById("okPopupMessage");

    if (messageElement && popup) {
      messageElement.textContent = message;
      popup.style.display = "flex";
    }
  }

  // Close on "OK"
  const okBtn = document.getElementById("okPopupBtn");
  if (okBtn) {
    okBtn.addEventListener("click", () => {
      const popup = document.getElementById("okPopup");
      popup.style.display = "none";
    });
  }

  function setupOkPopup() {
    const okBtn = document.getElementById("okPopupBtn");
    if (okBtn) {
      okBtn.addEventListener("click", () => {
        document.getElementById("okPopup").style.display = "none";
      });
    }
  }
  
  function showOkPopup(message) {
    const popup = document.getElementById("okPopup");
    const messageElement = document.getElementById("okPopupMessage");
  
    if (popup && messageElement) {
      messageElement.textContent = message;
      popup.style.display = "flex";
    }
  }