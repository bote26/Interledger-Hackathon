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

    if (result.requiresInteraction) {
      // ILP payment requires user to approve grant
      showMessage('Opening authorization page...', 'info');
      const newWindow = window.open(result.interactUrl, '_blank', 'width=600,height=800');
      
      // Show continue button
      const continueBtn = document.createElement('button');
      continueBtn.textContent = 'I have approved the payment - Click to complete';
      continueBtn.className = 'btn btn-primary';
      continueBtn.style.marginTop = '10px';
      continueBtn.onclick = async () => {
        try {
          const completeResponse = await fetch(`/dashboard/complete-transfer/${result.transactionId}`, {
            method: 'POST'
          });
          const completeResult = await completeResponse.json();
          if (completeResponse.ok) {
            showMessage('Transfer successful! Reloading...', 'success');
            setTimeout(() => window.location.reload(), 1500);
          } else {
            showMessage(completeResult.error || 'Failed to complete transfer', 'error');
          }
        } catch (err) {
          showMessage('Error completing transfer: ' + err.message, 'error');
        }
      };
      document.getElementById('transfer-message').appendChild(continueBtn);
      return;
    }

    if (response.ok && result.success) {
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
  messageDiv.innerHTML = ''; // Clear previous content
  const textNode = document.createTextNode(message);
  messageDiv.appendChild(textNode);
  messageDiv.className = type;
  messageDiv.style.display = 'block';

  if (type === 'success') {
    setTimeout(() => {
      messageDiv.style.display = 'none';
    }, 3000);
  }
}
