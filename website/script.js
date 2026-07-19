document.addEventListener('DOMContentLoaded', () => {
  // 1. Top Security Banner Dismissal
  const securityBanner = document.querySelector('.top-security-banner');
  const closeBannerBtn = document.querySelector('.banner-close-btn');
  
  if (securityBanner && closeBannerBtn) {
    closeBannerBtn.addEventListener('click', () => {
      securityBanner.style.transition = 'all 0.3s ease';
      securityBanner.style.height = '0';
      securityBanner.style.paddingTop = '0';
      securityBanner.style.paddingBottom = '0';
      securityBanner.style.opacity = '0';
      securityBanner.style.overflow = 'hidden';
      securityBanner.style.borderBottom = 'none';
      setTimeout(() => {
        securityBanner.style.display = 'none';
      }, 300);
      localStorage.setItem('securityBannerDismissed', 'true');
    });
  }

  // 2. Sticky Header
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

  // 5. Pricing Slider (3D Circular Carousel) Logic
  const sliderContainer = document.querySelector('.pricing-slider-container');
  if (sliderContainer) {
    const cards = sliderContainer.querySelectorAll('.pricing-card');
    const prevBtn = sliderContainer.querySelector('.prev-btn');
    const nextBtn = sliderContainer.querySelector('.next-btn');
    const dots = document.querySelectorAll('.pricing-dot');
    let activeIndex = 1; // Default active card (Starter Plan)

    const updateSlider = (newIndex) => {
      activeIndex = (newIndex + 3) % 3;

      cards.forEach((card, i) => {
        card.classList.remove('card-left', 'card-center', 'card-right');
        if (i === activeIndex) {
          card.classList.add('card-center');
        } else if (i === (activeIndex - 1 + 3) % 3) {
          card.classList.add('card-left');
        } else if (i === (activeIndex + 1) % 3) {
          card.classList.add('card-right');
        }
      });

      // Update dot states
      if (dots.length > 0) {
        dots.forEach((dot, i) => {
          if (i === activeIndex) {
            dot.classList.add('active');
          } else {
            dot.classList.remove('active');
          }
        });
      }
    };

    // Button interactions
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        updateSlider(activeIndex - 1);
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        updateSlider(activeIndex + 1);
      });
    }

    // Direct card click interaction
    cards.forEach((card, i) => {
      card.addEventListener('click', (e) => {
        // If clicking on links or buttons inside the card, allow default action
        if (e.target.closest('a') || e.target.closest('button')) return;
        
        if (i !== activeIndex) {
          e.preventDefault();
          updateSlider(i);
        }
      });
    });

    // Dot click interaction
    if (dots.length > 0) {
      dots.forEach((dot, i) => {
        dot.addEventListener('click', () => {
          updateSlider(i);
        });
      });
    }

    // Initial run
    updateSlider(activeIndex);
  }
});
