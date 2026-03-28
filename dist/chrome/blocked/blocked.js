document.getElementById('blocked-url').textContent = document.referrer || 'Blocked site';
document.getElementById('go-back').addEventListener('click', (e) => {
  e.preventDefault();
  history.back();
});
