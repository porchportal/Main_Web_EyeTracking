const response = await fetch(`/api/user-preferences/${userId}`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(updatedPreferences)
}); 