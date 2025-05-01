document.addEventListener('DOMContentLoaded', function() {
  // Handle QR code refresh
  const refreshQR = async () => {
      try {
          const response = await fetch('/api/refresh-qr');
          const data = await response.json();
          if (data.qrCode) {
              document.querySelector('#qrcode-container img').src = data.qrCode;
          }
      } catch (error) {
          console.error('Error refreshing QR code:', error);
      }
  };

  // Refresh QR code every 30 seconds if not connected
  if (document.querySelector('#qrcode-container')) {
      setInterval(refreshQR, 30000);
  }

  // Handle WhatsApp logout
  const logoutBtn = document.querySelector('#logout-btn');
  if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
          try {
              await fetch('/api/logout-whatsapp', { method: 'POST' });
              window.location.reload();
          } catch (error) {
              console.error('Error logging out:', error);
          }
      });
  }
});