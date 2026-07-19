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

  // ============================================================
  // Eazzio AI Chatbot Logic
  // ============================================================
  const chatbotWidget = document.getElementById('eazzio-chatbot-widget');
  const chatbotLauncher = document.getElementById('chatbot-launcher');
  const chatbotWindow = document.getElementById('chatbot-window');
  const chatbotCloseBtn = document.getElementById('chatbot-close-btn');
  const chatbotInputForm = document.getElementById('chatbot-input-form');
  const chatbotInputField = document.getElementById('chatbot-input-field');
  const chatbotMessages = document.getElementById('chatbot-messages');
  const chatbotQuickReplies = document.getElementById('chatbot-quick-replies');
  const chatbotTooltip = document.getElementById('chatbot-tooltip');
  const badge = chatbotLauncher.querySelector('.notification-badge');

  if (chatbotWidget && chatbotLauncher && chatbotWindow) {
    let chatbotOpened = false;
    let initialGreetingSent = false;

    // Open/Close Toggles
    chatbotLauncher.addEventListener('click', () => {
      chatbotWindow.classList.remove('hidden');
      chatbotLauncher.style.transform = 'scale(0) translateY(20px)';
      chatbotLauncher.style.opacity = '0';
      chatbotLauncher.style.pointerEvents = 'none';
      chatbotOpened = true;

      // Hide badge and tooltip
      if (badge) badge.style.display = 'none';
      if (chatbotTooltip) chatbotTooltip.classList.remove('visible');

      // Focus input field
      setTimeout(() => chatbotInputField.focus(), 300);

      // Trigger initial greeting if not yet sent
      if (!initialGreetingSent) {
        sendInitialGreeting();
      }
    });

    const closeChatbot = () => {
      chatbotWindow.classList.add('hidden');
      chatbotLauncher.style.transform = '';
      chatbotLauncher.style.opacity = '';
      chatbotLauncher.style.pointerEvents = '';
    };

    chatbotCloseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeChatbot();
    });

    // Close chatbot if clicking outside on desktop
    document.addEventListener('click', (e) => {
      if (window.innerWidth > 480 && chatbotOpened && 
          !chatbotWidget.contains(e.target) && 
          !chatbotLauncher.contains(e.target)) {
        closeChatbot();
      }
    });

    // Quick Action Chips Data
    const quickReplyChips = [
      { text: "What is Eazzio?", value: "what is eazzio" },
      { text: "Pricing plans 💰", value: "pricing plans" },
      { text: "Offline caching 📡", value: "offline cache" },
      { text: "Background Tracking ⚙️", value: "background tracking" },
      { text: "Android Dialer Role 📱", value: "dialer role" },
      { text: "Contact Support 📞", value: "contact support" }
    ];

    // Populate Quick Replies
    const renderQuickReplies = () => {
      chatbotQuickReplies.innerHTML = '';
      quickReplyChips.forEach(chip => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'quick-reply-btn';
        btn.textContent = chip.text;
        btn.addEventListener('click', () => {
          handleUserMessage(chip.text, chip.value);
        });
        chatbotQuickReplies.appendChild(btn);
      });
    };

    // Render message bubble
    const appendMessage = (sender, text, isHtml = false) => {
      const msgWrapper = document.createElement('div');
      msgWrapper.className = `chatbot-msg-wrapper ${sender}`;

      if (sender === 'bot') {
        const avatar = document.createElement('div');
        avatar.className = 'chatbot-msg-avatar';
        avatar.textContent = '🤖';
        msgWrapper.appendChild(avatar);
      }

      const bubble = document.createElement('div');
      bubble.className = 'chatbot-msg-bubble';
      if (isHtml) {
        bubble.innerHTML = text;
      } else {
        bubble.textContent = text;
      }
      
      msgWrapper.appendChild(bubble);
      chatbotMessages.appendChild(msgWrapper);
      chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
    };

    // Show Typing indicator
    const showTypingIndicator = () => {
      const msgWrapper = document.createElement('div');
      msgWrapper.className = 'chatbot-msg-wrapper bot typing-indicator-wrapper';

      const avatar = document.createElement('div');
      avatar.className = 'chatbot-msg-avatar';
      avatar.textContent = '🤖';
      msgWrapper.appendChild(avatar);

      const bubble = document.createElement('div');
      bubble.className = 'chatbot-msg-bubble chatbot-typing-indicator';
      bubble.innerHTML = `
        <span class="chatbot-typing-dot"></span>
        <span class="chatbot-typing-dot"></span>
        <span class="chatbot-typing-dot"></span>
      `;
      msgWrapper.appendChild(bubble);
      chatbotMessages.appendChild(msgWrapper);
      chatbotMessages.scrollTop = chatbotMessages.scrollHeight;

      return msgWrapper;
    };

    // Initial greeting trigger
    const sendInitialGreeting = () => {
      initialGreetingSent = true;
      const indicator = showTypingIndicator();
      setTimeout(() => {
        indicator.remove();
        appendMessage('bot', "<p>Hello! Welcome to Eazzio! 👋</p><p>I am your virtual assistant. How can I help you today? Ask me about our SIM auto dialer, background call sync, pricing, or system security.</p>", true);
        renderQuickReplies();
      }, 800);
    };

    // Automated Launcher Notification popup
    setTimeout(() => {
      if (!chatbotOpened) {
        if (badge) badge.style.display = 'block';
        if (chatbotTooltip) chatbotTooltip.classList.add('visible');
        // Add subtle nudge animation to launcher
        chatbotLauncher.style.animation = 'badge-bounce 1s ease 3';
        setTimeout(() => chatbotLauncher.style.animation = '', 3000);
      }
    }, 4000);

    // Knowledge Base Lookup / NLP Matching
    const getBotResponse = (query) => {
      const q = query.toLowerCase().trim();

      // Greeting synonyms
      if (q.match(/\b(hi|hello|hey|greetings|good morning|good afternoon|yo|hi there)\b/)) {
        return "Hello there! 😊 How can I assist you with Eazzio Telecaller today? Feel free to click any of the options below or ask your questions directly.";
      }

      // What is Eazzio
      if (q.includes("what is") || q.includes("concept") || q.includes("how it works") || q.includes("about eazzio") || q.includes("overview") || q.includes("telecaller")) {
        return "<p><strong>Eazzio Telecaller</strong> is the ultimate SIM-based auto dialer and telecalling CRM designed to upgrade team productivity and outbound outreach.</p><p>Unlike expensive VoIP-based solutions that bill you per minute, Eazzio connects a secure web dashboard to a companion Android app on your caller's phone, placing calls directly through their mobile carrier SIM pack (Jio, Airtel, etc.) at virtually zero extra cost!</p>";
      }

      // Auto Dialer details
      if (q.includes("dialer") || q.includes("auto-dialer") || q.includes("autodialer") || q.includes("how to call") || q.includes("click to dial") || q.includes("outbound")) {
        return "<p>Eazzio features a robust <strong>SIM-Based Auto Dialer</strong>:</p><ul><li><strong>Increased output</strong>: Boost outbound call attempts by up to 200% per day.</li><li><strong>Modes</strong>: Supports automated status-wise calling, simple click-to-dial, or structured list campaigns.</li><li><strong>Post-call flow</strong>: Automatically prompts callers to select call outcomes and log statuses.</li></ul>";
      }

      // Offline caching & SQLite
      if (q.includes("offline") || q.includes("sqlite") || q.includes("no internet") || q.includes("no network") || q.includes("cache") || q.includes("sync")) {
        return "<p>Eazzio integrates a local <strong>SQLite Offline Cache</strong> in the mobile app to handle connectivity issues:</p><ol><li><strong>Local Storage</strong>: In case of poor internet or network dropouts, call activities are saved immediately inside SQLite.</li><li><strong>Deduplication</strong>: A database constraint prevents identical duplicate call syncs.</li><li><strong>Auto-Sync</strong>: When connectivity returns, a sync background loop transfers all pending activities to the server.</li><li><strong>Clean up</strong>: Synchronized rows older than 30 days are auto-pruned from the device.</li></ol>";
      }

      // Background Call Tracking
      if (q.includes("background") || q.includes("foreground") || q.includes("service") || q.includes("phone state") || q.includes("boot") || q.includes("kill") || q.includes("reboot")) {
        return "<p>Eazzio is powered by a native <strong>Android Foreground Service</strong> for background tracking:</p><ul><li><strong>Resilience</strong>: A PhoneStateReceiver monitors transitions (Ringing -> Offhook -> Idle) even if the app is force-closed or the phone is rebooted.</li><li><strong>Privacy Protection</strong>: Filters only matched allotted leads. Personal family or friend calls are completely ignored and preserved.</li><li><strong>Exemption checks</strong>: Prompts users to whitelist Eazzio from native battery optimization settings (preventing OS sleep triggers on Samsung, Xiaomi, Oppo, and Vivo devices).</li></ul>";
      }

      // Android 10+ Default dialer role
      if (q.includes("default dialer") || q.includes("dialer role") || q.includes("android 10") || q.includes("decline") || q.includes("eligibility")) {
        return "<p>To support advanced Android 10+ call-tracking requirements, Eazzio supports integration as the <strong>Default Dialer</strong>:</p><ul><li><strong>Explainer dialogue</strong>: Displays custom educational popups before requesting the system prompt.</li><li><strong>Decline preferences</strong>: Respects user choices. Declining saves a flag, preventing repetitive nag prompts.</li><li><strong>Graceful fallback</strong>: If declined, Eazzio falls back to background logs scraping while displaying a warnings banner at the top of the dashboard.</li></ul>";
      }

      // Pricing & Plans
      if (q.includes("pricing") || q.includes("cost") || q.includes("price") || q.includes("plan") || q.includes("plans") || q.includes("rate") || q.includes("growth") || q.includes("starter") || q.includes("basic") || q.includes("how much")) {
        return "<p>Eazzio has 3 annual subscription plans billed per user:</p><table><thead><tr><th>Plan</th><th>Cost / Yr</th><th>Features</th></tr></thead><tbody><tr><td><strong>Basic</strong></td><td>₹29</td><td>SIM Auto-dialer, max 10 campaigns, standard logs.</td></tr><tr><td><strong>Starter</strong></td><td>₹49</td><td>Max 30 campaigns, live monitor auditing, call recording add-on.</td></tr><tr><td><strong>Growth</strong></td><td>₹99</td><td>Unlimited campaigns, FREE call recording, WhatsApp scripts, Priority support.</td></tr></tbody></table><p>For details, check out our <a href='#pricing'>Pricing Section</a>.</p>";
      }

      // Call Recording
      if (q.includes("record") || q.includes("recording") || q.includes("audio") || q.includes("mp3") || q.includes("voice")) {
        return "<p>Yes, Eazzio supports <strong>Call Recording Playback</strong>! The mobile companion app captures voice logs and uploads them securely to your master web-dashboard.</p><ul><li>Basic Plan: Not available.</li><li>Starter Plan: Available as an add-on (₹3,999/yr).</li><li>Growth Plan: <strong>FREE / Included</strong> in the ₹99 plan!</li></ul>";
      }

      // Security
      if (q.includes("secure") || q.includes("security") || q.includes("encrypt") || q.includes("safe") || q.includes("privacy") || q.includes("aes")) {
        return "<p>Your security is our absolute priority! Eazzio uses industry-standard <strong>AES 256-bit Encryption</strong> for all communications, lead parameters, and logs. Lead databases and phone records remain strictly secure inside PostgreSQL/Neon endpoints.</p>";
      }

      // Integrations
      if (q.includes("integration") || q.includes("crm") || q.includes("webhook") || q.includes("google sheets") || q.includes("api") || q.includes("connect")) {
        return "<p>Eazzio supports <strong>100+ integrations</strong> out of the box:</p><ul><li><strong>Google Sheets</strong>: Sync spreadsheets to update lead statuses.</li><li><strong>Custom Webhooks</strong>: Receive logs onto your custom backend APIs instantly.</li><li><strong>Leading CRMs</strong>: Native connectors for popular customer relations managers.</li></ul>";
      }

      // Support & Contacts
      if (q.includes("support") || q.includes("contact") || q.includes("help") || q.includes("phone number") || q.includes("email") || q.includes("mail") || q.includes("hours")) {
        return "<p>Need help? Our dedicated support team is available Mon - Fri (9:00 AM to 7:00 PM):</p><ul><li>📞 Toll-free Support: <a href='tel:18005726671'>18005726671</a></li><li>✉️ Email Support: <a href='mailto:support.india@eazzio.com'>support.india@eazzio.com</a></li></ul>";
      }

      // Request demo
      if (q.includes("demo") || q.includes("trial") || q.includes("try")) {
        return "<p>We'd love to show you a demo! You can request a sandbox trial immediately by clicking on <a href='/?demo=true'>Request Demo</a> on the main page. Our setup team will help onboard your users.</p>";
      }

      // Fallback
      return "<p>I'm not sure I have details on that topic. 😅</p><p>However, I can help you with:</p><ul><li>Features of the <strong>SIM Auto Dialer</strong></li><li>Local <strong>SQLite offline cache</strong></li><li><strong>Background call tracking</strong> & native dialers</li><li>Pricing details (Basic, Starter, Growth)</li><li>AES 256-bit encryption</li></ul><p>Feel free to click any suggestion below or ask a different question!</p>";
    };

    // User message processing
    const handleUserMessage = (userText, queryText = null) => {
      const query = queryText || userText;
      if (!query.trim()) return;

      // Render user message bubble
      appendMessage('user', userText);

      // Clear input
      chatbotInputField.value = '';

      // Show typing status
      const typingIndicator = showTypingIndicator();

      // Trigger bot response after delay
      setTimeout(() => {
        typingIndicator.remove();
        const botResponse = getBotResponse(query);
        appendMessage('bot', botResponse, true);
        renderQuickReplies();
      }, 700 + Math.random() * 500);
    };

    // Submit handler
    chatbotInputForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = chatbotInputField.value;
      handleUserMessage(val);
    });
  }
});
