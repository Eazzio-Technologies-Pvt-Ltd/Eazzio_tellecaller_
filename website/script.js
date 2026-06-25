document.addEventListener('DOMContentLoaded', () => {
  // 1. Sticky Header
  const header = document.querySelector('.header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      header.classList.add('sticky');
    } else {
      header.classList.remove('sticky');
    }
  });

  // 2. Dark/Light Theme Switcher
  const themeToggleBtn = document.querySelector('.theme-toggle-btn');
  const currentTheme = localStorage.getItem('theme') || 'dark';

  if (currentTheme === 'light') {
    document.body.classList.add('light-theme');
  }

  themeToggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    let theme = 'dark';
    if (document.body.classList.contains('light-theme')) {
      theme = 'light';
    }
    localStorage.setItem('theme', theme);
  });

  // 3. FAQ Accordion
  const faqQuestions = document.querySelectorAll('.faq-question');
  
  faqQuestions.forEach(question => {
    question.addEventListener('click', () => {
      const faqItem = question.parentElement;
      const answer = faqItem.querySelector('.faq-answer');
      const isActive = faqItem.classList.contains('active');

      // Close all other accordion items
      document.querySelectorAll('.faq-item').forEach(item => {
        item.classList.remove('active');
        item.querySelector('.faq-answer').style.maxHeight = null;
      });

      if (!isActive) {
        faqItem.classList.add('active');
        answer.style.maxHeight = answer.scrollHeight + 'px';
      }
    });
  });

  // 4. Feature Image Auto-Rotation & Interaction Demo
  const playButton = document.querySelector('.video-play-btn');
  const mockThumbnail = document.querySelector('.video-mock-thumbnail');

  if (playButton && mockThumbnail) {
    mockThumbnail.addEventListener('click', () => {
      // Simulate playing by injecting a mock message
      const introText = mockThumbnail.querySelector('.video-intro-text');
      if (introText) {
        introText.textContent = "Connecting to Eazzio Demo Environment...";
      }
      setTimeout(() => {
        alert("Eazzio Fast auto-dialer simulation initiated! To try the full dashboard, click on 'Login' or 'Request Demo'.");
        if (introText) {
          introText.textContent = "Eazzio FAST - Smarter Telecalling, Better Results";
        }
      }, 800);
    });
  }
});
