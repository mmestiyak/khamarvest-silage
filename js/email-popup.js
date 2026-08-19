// Email capture popup - appears after 5 seconds
document.addEventListener('DOMContentLoaded', function() {
  // Don't show if user already subscribed in this session
  if (sessionStorage.getItem('email-popup-shown')) return;

  setTimeout(function() {
    showEmailPopup();
    sessionStorage.setItem('email-popup-shown', 'true');
  }, 5000);
});

function showEmailPopup() {
  const popup = document.getElementById('email-popup');
  if (!popup) return;

  // Show with fade-in animation
  popup.classList.remove('hidden');
  popup.classList.add('fadeIn');
}

function closeEmailPopup() {
  const popup = document.getElementById('email-popup');
  popup.classList.add('hidden');
  // Remember for 30 days
  localStorage.setItem('email-popup-closed', new Date().getTime().toString());
}

function handleEmailSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('popup-email').value.trim();
  const name = document.getElementById('popup-name').value.trim();

  if (!email || !name) {
    alert('নাম এবং ইমেইল দুটোই দিতে হবে।');
    return;
  }

  // Validate email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    alert('সঠিক ইমেইল লিখুন প্লিজ।');
    return;
  }

  // Send to WhatsApp or email service (basic implementation)
  const message = `নতুন সাবস্ক্রাইবার: ${name} (${email})`;

  // Option 1: Send to WhatsApp
  const waLink = `https://wa.me/8801303438063?text=${encodeURIComponent(message)}`;

  // Option 2: Store in localStorage (for now, as backup)
  const subscribers = JSON.parse(localStorage.getItem('subscribers') || '[]');
  subscribers.push({ name, email, timestamp: new Date().toISOString() });
  localStorage.setItem('subscribers', JSON.stringify(subscribers));

  // Show success message
  document.getElementById('popup-form').style.display = 'none';
  document.getElementById('popup-success').style.display = 'block';

  // Send WhatsApp
  setTimeout(() => {
    window.open(waLink, '_blank');
    closeEmailPopup();
  }, 2000);

  // GA event
  if (typeof gaEvent === 'function') {
    gaEvent('email_signup', { subscriber_name: name, subscriber_email: email });
  }
}

// Close on Escape key
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    closeEmailPopup();
  }
});

// Close on background click
document.getElementById('email-popup')?.addEventListener('click', function(e) {
  if (e.target === this) {
    closeEmailPopup();
  }
});
