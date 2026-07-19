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

  // 4. Interactive Video Presentation Player Logic
  const player = document.getElementById('eazzioVideoPlayer');
  if (player) {
    const playPauseBtn = document.getElementById('playPauseBtn');
    const timeDisplay = document.getElementById('timeDisplay');
    const partIndicator = document.getElementById('partIndicator');
    const videoSubtitles = document.getElementById('videoSubtitles');
    const videoProgress = document.getElementById('videoProgress');
    const progressBarContainer = document.getElementById('progressBarContainer');
    const videoLangSelector = document.getElementById('videoLangSelector');
    const videoParts = player.querySelectorAll('.video-part');
    const whatsappMsgText = document.getElementById('whatsappMsgText');
    const phoneDurationCounter = player.querySelector('.dur-counter');
    
    let isPlaying = true;
    let currentTime = 0; // 0 to 40 seconds
    const duration = 40; // 40 seconds total
    let currentLang = 'en';
    let lastPartIndex = -1;
    let lastLang = 'en';

    const videoData = {
      parts: [
        {
          indicator: {
            en: "Part 1: SIM-Based Auto Dialer",
            hi: "भाग 1: सिम-आधारित ऑटो डायलर",
            ta: "பகுதி 1: சிம்-அடிப்படையிலான ஆட்டோ டயலர்"
          },
          subtitle: {
            en: "Eazzio Telecaller dials leads directly using your agent's SIM card calling plans. This eliminates expensive VoIP calling charges and allows you to run unlimited outbound campaigns.",
            hi: "ईज़ियो टेलीकॉलर आपके एजेंट के सिम कार्ड कॉलिंग प्लान का उपयोग करके सीधे लीड्स को डायल करता है। यह महंगे वीओआईपी कॉलिंग शुल्कों को समाप्त करता है और आपको असीमित आउटबाउंड अभियान चलाने की अनुमति देता है।",
            ta: "ஈசியோ டெலிகாலர் உங்கள் முகவரின் சிம் கார்டு அழைப்பு திட்டங்களை பயன்படுத்தி நேரடியாக அழைப்புகளை மேற்கொள்கிறது. இது விலையுயர்ந்த விஓஐபி கட்டணங்களை தவிர்க்கிறது மற்றும் வரம்பற்ற பிரச்சாரங்களை நடத்த அனுமதிக்கிறது."
          }
        },
        {
          indicator: {
            en: "Part 2: Real-Time Team Monitoring",
            hi: "भाग 2: वास्तविक समय टीम निगरानी",
            ta: "பகுதி 2: நிகழ்நேர குழு கண்காணிப்பு"
          },
          subtitle: {
            en: "Monitor agent activity, break states, talk times, and campaign status live. Admins can audit performance instantly and drive outbound calling efficiency.",
            hi: "एजेंट की गतिविधि, ब्रेक की स्थिति, बात करने का समय और अभियान की स्थिति को लाइव देखें। व्यवस्थापक तुरंत प्रदर्शन का ऑडिट कर सकते हैं और आउटबाउंड कॉलिंग दक्षता बढ़ा सकते हैं।",
            ta: "முகவர் செயல்பாடு, இடைவேளை நிலைகள், பேசும் நேரம் மற்றும் பிரச்சார நிலையை நேரலையாக கண்காணிக்கவும். நிர்வாகிகள் செயல்திறனை உடனடியாக தணிக்கை செய்து அழைப்பு திறனை அதிகரிக்கலாம்."
          }
        },
        {
          indicator: {
            en: "Part 3: CRM Integrations & WhatsApp",
            hi: "भाग 3: सीआरएम सिंक और व्हाट्सएप स्वचालन",
            ta: "பகுதி 3: சிஆர்எம் ஒத்திசைவு & வாட்ஸ்அப்"
          },
          subtitle: {
            en: "Sync contacts automatically with CRM platforms or Google Sheets. Send follow-up WhatsApp messages immediately after a call concludes, without storing numbers.",
            hi: "सीआरएम प्लेटफॉर्म या गूगल शीट्स के साथ संपर्कों को स्वचालित रूप से सिंक करें। कॉल समाप्त होने के तुरंत बाद नंबरों को सहेजने की आवश्यकता के बिना अनुवर्ती व्हाट्सएप संदेश भेजें।",
            ta: "சிஆர்எம் தளங்கள் அல்லது கூகிள் தாள்களுடன் தொடர்புகளை தானாக ஒத்திசைக்கவும். அழைப்பு முடிந்தவுடன் எண்களை சேமிக்காமலேயே வாட்ஸ்அப் பின்தொடர் செய்திகளை அனுப்பலாம்."
          },
          whatsapp: {
            en: "Hello! Your call with Eazzio agent has concluded. Here is your ticket copy.",
            hi: "नमस्ते! ईज़ियो एजेंट के साथ आपकी कॉल समाप्त हो गई है। यह आपकी टिकट प्रति है।",
            ta: "வணக்கம்! ஈசியோ முகவருடனான உங்கள் அழைப்பு முடிவடைந்தது. இதோ உங்கள் டிக்கெட் நகல்."
          }
        },
        {
          indicator: {
            en: "Part 4: Audio Logs & Deep Analytics",
            hi: "भाग 4: कॉल रिकॉर्डिंग और विश्लेषिकी",
            ta: "பகுதி 4: அழைப்பு பதிவு & பகுப்பாய்வு"
          },
          subtitle: {
            en: "Access automatic call recordings and call summaries stored securely in the cloud. Analyze conversion speed, outcomes, and daily team summaries on a unified dashboard.",
            hi: "क्लाउड में सुरक्षित रूप से संग्रहीत स्वचालित कॉल रिकॉर्डिंग और कॉल सारांश तक पहुँचें। एक एकीकृत डैशबोर्ड पर रूपांतरण गति, परिणामों और दैनिक टीम सारांशों का विश्लेषण करें।",
            ta: "கிளவுடில் பாதுகாப்பாக சேமிக்கப்பட்ட தானியங்கி அழைப்பு பதிவுகள் மற்றும் அழைப்பு சுருக்கங்களை அணுகவும். ஒரு ஒருங்கிணைந்த டாஷ்போர்டில் தினசரி குழு சுருக்கங்களை பகுப்பாய்வு செய்யுங்கள்."
          }
        }
      ]
    };

    // Prime the voices list on load to prevent delays/empty list on first play
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
    }

    function speakText(text, langCode) {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        let targetLang = 'en-US';
        if (langCode === 'hi') {
          targetLang = 'hi-IN';
        } else if (langCode === 'ta') {
          targetLang = 'ta-IN';
        }
        utterance.lang = targetLang;
        
        // Find a matching voice for the target language to make it sound native
        const voices = window.speechSynthesis.getVoices();
        let voice = voices.find(v => v.lang.toLowerCase() === targetLang.toLowerCase());
        if (!voice) {
          // Fallback to match language prefix (e.g. 'hi')
          voice = voices.find(v => v.lang.toLowerCase().startsWith(langCode.toLowerCase()));
        }
        if (voice) {
          utterance.voice = voice;
        }
        
        utterance.rate = 0.90; // Slightly slower for clear understanding
        utterance.pitch = 1.0;
        
        window.speechSynthesis.speak(utterance);
      }
    }

    function updatePlayer() {
      // Find current part index
      const partIndex = Math.min(Math.floor(currentTime / 10), 3);
      
      // Update active video part display
      videoParts.forEach((part, index) => {
        if (index === partIndex) {
          part.classList.add('active');
        } else {
          part.classList.remove('active');
        }
      });

      // Update text values according to selected language
      const data = videoData.parts[partIndex];
      partIndicator.textContent = data.indicator[currentLang];
      videoSubtitles.textContent = data.subtitle[currentLang];

      // Part specific dynamic counters/texts
      if (partIndex === 0 && phoneDurationCounter) {
        const offsetSec = Math.floor(currentTime % 10);
        phoneDurationCounter.textContent = `0m 0${offsetSec}s`;
      }
      if (partIndex === 2 && whatsappMsgText && data.whatsapp) {
        whatsappMsgText.textContent = data.whatsapp[currentLang];
      }

      // Update progress bar
      const progressPercent = (currentTime / duration) * 100;
      videoProgress.style.width = `${progressPercent}%`;

      // Update time display
      const displayMin = Math.floor(currentTime / 60);
      const displaySec = Math.floor(currentTime % 60);
      const displaySecStr = displaySec < 10 ? `0${displaySec}` : displaySec;
      
      const totalMin = Math.floor(duration / 60);
      const totalSec = Math.floor(duration % 60);
      const totalSecStr = totalSec < 10 ? `0${totalSec}` : totalSec;

      timeDisplay.textContent = `${displayMin}:${displaySecStr} / ${totalMin}:${totalSecStr}`;

      // Trigger Speech Narration if part index or language changed while playing
      if (isPlaying && (partIndex !== lastPartIndex || currentLang !== lastLang)) {
        speakText(data.subtitle[currentLang], currentLang);
        lastPartIndex = partIndex;
        lastLang = currentLang;
      }
    }

    // Toggle Play / Pause
    function togglePlay() {
      isPlaying = !isPlaying;
      playPauseBtn.textContent = isPlaying ? '⏸' : '▶';
      if (!isPlaying) {
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
      } else {
        const partIndex = Math.min(Math.floor(currentTime / 10), 3);
        const data = videoData.parts[partIndex];
        speakText(data.subtitle[currentLang], currentLang);
      }
    }

    playPauseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePlay();
    });

    // ProgressBar seeking
    progressBarContainer.addEventListener('click', (e) => {
      const rect = progressBarContainer.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const width = rect.width;
      const clickPercent = clickX / width;
      currentTime = clickPercent * duration;
      lastPartIndex = -1; // Reset to force immediate Speech trigger
      updatePlayer();
    });

    // Language selection
    videoLangSelector.addEventListener('change', (e) => {
      currentLang = e.target.value;
      lastPartIndex = -1; // Reset to force immediate Speech trigger
      updatePlayer();
    });

    // Player tick loop
    setInterval(() => {
      if (isPlaying) {
        currentTime += 0.1;
        if (currentTime >= duration) {
          currentTime = 0;
        }
        updatePlayer();
      }
    }, 100);

    // Initial update
    updatePlayer();
  }

  // 5. Smooth Scroll for Anchor Links (fixes iframe and parent routing issues)
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return; // Ignore dummy hashes
      
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        e.preventDefault();
        
        // If it's a mobile menu link, close the menu
        const navMenu = document.querySelector('.nav-menu');
        if (navMenu && navMenu.classList.contains('active')) {
          navMenu.classList.remove('active');
          document.body.style.overflow = '';
        }
        
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });

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
