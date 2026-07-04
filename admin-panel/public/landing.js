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

  // Mobile Nav Toggle Functionality
  const mobileNavToggle = document.querySelector('.mobile-nav-toggle');
  const navMenu = document.querySelector('.nav-menu');
  if (mobileNavToggle && navMenu) {
    mobileNavToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      navMenu.classList.toggle('active');
      const isExpanded = navMenu.classList.contains('active');
      mobileNavToggle.setAttribute('aria-expanded', isExpanded);
      if (isExpanded) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    });

    document.addEventListener('click', (e) => {
      if (navMenu.classList.contains('active') && !navMenu.contains(e.target) && !mobileNavToggle.contains(e.target)) {
        navMenu.classList.remove('active');
        document.body.style.overflow = '';
      }
    });

    const navLinks = navMenu.querySelectorAll('.nav-link, .btn-mobile-nav');
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('active');
        document.body.style.overflow = '';
      });
    });
  }

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
