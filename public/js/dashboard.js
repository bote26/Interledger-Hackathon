document.getElementById('transfer-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = new FormData(e.target);
  const data = {
    from_user_id: formData.get('from_user_id'),
    to_user_id: formData.get('to_user_id'),
    amount: formData.get('amount'),
    description: formData.get('description')
  };

  // Validate
  if (data.from_user_id === data.to_user_id) {
    showMessage('Cannot transfer to the same account', 'error');
    return;
  }

  try {
    const response = await fetch('/dashboard/transfer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (response.ok) {
      showMessage('Transfer successful! Reloading...', 'success');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } else {
      showMessage(result.error || 'Transfer failed', 'error');
    }
  } catch (error) {
    showMessage('An error occurred: ' + error.message, 'error');
  }
});

function showMessage(message, type) {
  const messageDiv = document.getElementById('transfer-message');
  messageDiv.textContent = message;
  messageDiv.className = type;
  messageDiv.style.display = 'block';

  if (type === 'success') {
    setTimeout(() => {
      messageDiv.style.display = 'none';
    }, 3000);
  }
}
