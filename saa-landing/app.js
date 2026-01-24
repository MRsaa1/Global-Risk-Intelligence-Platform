/**
 * SAA Alliance - Command Center Style
 * Full Flow: Loading → Welcome → Services → Service Modal → Launch
 */

// ============================================
// SERVICES DATA
// ============================================

const services = {
  learning: {
    name: 'Learning Intelligence',
    desc: 'Advanced AI education platform with interactive courses, real-world projects, and certification programs. Master machine learning, data science, and quantitative finance.',
    url: 'https://academy.saa-alliance.com/',
    features: ['AI Courses', 'Projects', 'Certification', 'Mentorship'],
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M12 14l9-5-9-5-9 5 9 5z"/>
      <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/>
      <path d="M12 14v7"/>
    </svg>`
  },
  trader: {
    name: 'AI Trader',
    desc: 'Institutional-grade crypto trading platform powered by neural networks. 24/7 automated trading with real-time market analysis and risk management.',
    url: 'https://ai-trader.saa-alliance.com/',
    features: ['Auto Trading', 'Multi-Exchange', 'Risk Control', 'Analytics'],
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
    </svg>`
  },
  liquidity: {
    name: 'Liquidity Positioner',
    desc: 'Cross-platform personal finance office with automated portfolio rebalancing, tax optimization, and multi-asset management capabilities.',
    url: 'https://liquidity.saa-alliance.com/',
    features: ['Portfolio Mgmt', 'Rebalancing', 'Tax Optimization', 'Multi-Asset'],
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
    </svg>`
  },
  prediction: {
    name: 'Prediction Market',
    desc: 'AI-powered prediction market protocol with crowd wisdom aggregation and decentralized forecasting for financial markets and global events.',
    url: '#',
    features: ['AI Predictions', 'Crowd Wisdom', 'Decentralized', 'Real-time'],
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 6v6l4 2"/>
    </svg>`
  },
  dashboard: {
    name: 'Investment Dashboard',
    desc: 'Comprehensive stock analysis and portfolio tracking with fundamental metrics, technical indicators, and AI-powered screening tools.',
    url: 'https://invest.saa-alliance.com/',
    features: ['Stock Screening', 'Technical Analysis', 'Fundamentals', 'Portfolio'],
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
    </svg>`
  },
  crypto: {
    name: 'Digital Assets Analytics',
    desc: 'Comprehensive blockchain and digital asset analytics with on-chain metrics, DeFi tracking, whale monitoring, and token analysis.',
    url: 'https://crypto.saa-alliance.com/',
    features: ['On-chain Data', 'DeFi Analytics', 'Whale Tracking', 'Tokens'],
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
    </svg>`
  },
  risk: {
    name: 'Risk Analyzer',
    desc: 'Institutional portfolio risk management platform with VaR calculations, stress testing, scenario analysis, and comprehensive risk reporting.',
    url: 'https://analyzer.saa-alliance.com/',
    features: ['VaR', 'Stress Testing', 'Scenarios', 'Reporting'],
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
    </svg>`
  },
  arin: {
    name: 'ARIN Platform',
    desc: 'Autonomous Risk Intelligence Network - AI-powered continuous monitoring, early warning system, and intelligent risk agents for proactive alerts.',
    url: 'https://arin.saa-alliance.com/dashboard',
    features: ['Autonomous', 'Early Warning', 'AI Agents', 'Real-time'],
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
    </svg>`
  },
  news: {
    name: 'News Analytics',
    desc: 'AI-powered news aggregation and sentiment analysis for financial markets. Real-time market intelligence with impact scoring and custom alerts.',
    url: 'https://news.saa-alliance.com/dashboard?lang=en',
    features: ['News Feed', 'Sentiment', 'Impact Scoring', 'Alerts'],
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"/>
    </svg>`
  },
  pfrp: {
    name: 'Physical-Financial Risk Platform',
    desc: 'Enterprise-grade platform for physical economy risk management. Digital twins, cascade analysis, stress testing powered by NVIDIA PhysicsNeMo.',
    url: 'https://risk.saa-alliance.com',
    features: ['Digital Twins', 'Cascade Analysis', 'Stress Tests', 'NVIDIA AI'],
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
    </svg>`
  }
};

let currentServiceId = null;

// ============================================
// LOADING ANIMATION
// ============================================

const loadingMessages = [
  'INITIALIZING SYSTEMS',
  'CONNECTING APIs',
  'LOADING MODELS',
  'SYNCING DATA',
  'READY'
];

let progress = 0;

function updateLoading() {
  const fill = document.getElementById('loadingBarFill');
  const text = document.getElementById('loadingText');
  const modules = ['mod1', 'mod2', 'mod3', 'mod4'];
  
  if (progress < 100) {
    progress += Math.random() * 12 + 3;
    if (progress > 100) progress = 100;
    
    fill.style.width = progress + '%';
    
    const msgIndex = Math.min(Math.floor(progress / 25), loadingMessages.length - 1);
    text.textContent = loadingMessages[msgIndex];
    
    modules.forEach((id, i) => {
      const el = document.getElementById(id);
      const threshold = (i + 1) * 25;
      if (progress >= threshold) {
        el.classList.remove('active');
        el.classList.add('complete');
      } else if (progress >= threshold - 25) {
        el.classList.add('active');
      }
    });
    
    if (progress < 100) {
      setTimeout(updateLoading, 150 + Math.random() * 200);
    } else {
      setTimeout(goToWelcome, 500);
    }
  }
}

// ============================================
// SCREEN TRANSITIONS
// ============================================

function goToWelcome() {
  const loading = document.getElementById('loadingScreen');
  const welcome = document.getElementById('welcomeScreen');
  
  loading.classList.add('fade-out');
  
  setTimeout(() => {
    loading.style.display = 'none';
    welcome.style.display = 'flex';
    setTimeout(() => welcome.classList.add('visible'), 50);
  }, 500);
}

function goToServices() {
  const welcome = document.getElementById('welcomeScreen');
  const services = document.getElementById('servicesScreen');
  
  welcome.classList.add('fade-out');
  
  setTimeout(() => {
    welcome.style.display = 'none';
    services.style.display = 'flex';
    setTimeout(() => {
      services.classList.add('visible');
      toggleCategory('intelligence');
    }, 50);
  }, 500);
}

function goToWelcomeFromServices() {
  const services = document.getElementById('servicesScreen');
  const welcome = document.getElementById('welcomeScreen');
  
  services.classList.remove('visible');
  services.classList.add('fade-out');
  
  setTimeout(() => {
    services.style.display = 'none';
    services.classList.remove('fade-out');
    welcome.style.display = 'flex';
    welcome.classList.remove('fade-out');
    setTimeout(() => welcome.classList.add('visible'), 50);
  }, 500);
}

// ============================================
// CATEGORY TOGGLE
// ============================================

function toggleCategory(category) {
  const block = document.querySelector(`[data-category="${category}"]`);
  
  if (block) {
    document.querySelectorAll('.category-block.expanded').forEach(b => {
      if (b !== block) b.classList.remove('expanded');
    });
    block.classList.toggle('expanded');
  }
}

// ============================================
// SERVICE MODAL
// ============================================

function openService(serviceId) {
  const service = services[serviceId];
  if (!service) return;
  
  currentServiceId = serviceId;
  
  const modal = document.getElementById('serviceModal');
  const init = document.getElementById('modalInit');
  const content = document.getElementById('modalContent');
  
  // Show modal with init animation
  modal.style.display = 'flex';
  init.style.display = 'flex';
  content.style.display = 'none';
  
  // After init animation, show content
  setTimeout(() => {
    init.style.display = 'none';
    
    // Populate content
    document.getElementById('serviceModalIcon').innerHTML = service.icon;
    document.getElementById('serviceModalTitle').textContent = service.name;
    document.getElementById('serviceModalDesc').textContent = service.desc;
    
    const featuresHtml = service.features
      .map(f => `<span class="feature-tag">${f}</span>`)
      .join('');
    document.getElementById('serviceModalFeatures').innerHTML = featuresHtml;
    
    content.style.display = 'block';
  }, 1200);
}

function closeServiceModal() {
  const modal = document.getElementById('serviceModal');
  modal.style.display = 'none';
  currentServiceId = null;
}

function launchService() {
  if (!currentServiceId) return;
  
  const service = services[currentServiceId];
  if (service && service.url) {
    if (service.url.startsWith('http')) {
      window.open(service.url, '_blank');
    } else {
      window.location.href = service.url;
    }
  }
  closeServiceModal();
}

// ============================================
// ABOUT / CONTACT MODALS
// ============================================

function showAbout() {
  document.getElementById('aboutModal').style.display = 'flex';
}

function closeAbout() {
  document.getElementById('aboutModal').style.display = 'none';
}

function showContact() {
  document.getElementById('contactModal').style.display = 'flex';
}

function closeContact() {
  document.getElementById('contactModal').style.display = 'none';
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(updateLoading, 300);
});

// ESC key to close modals
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeServiceModal();
    closeAbout();
    closeContact();
  }
});

// ============================================
// THEME SWITCHER
// ============================================

function setTheme(theme) {
  document.body.className = theme ? `theme-${theme}` : '';
  
  // Update active button
  document.querySelectorAll('.theme-btn').forEach((btn, i) => {
    btn.classList.remove('active');
    const themes = ['', 'cyan', 'silver', 'emerald']; // '' = Gold (default)
    if (themes[i] === theme) {
      btn.classList.add('active');
    }
  });
}

// Expose functions globally
window.goToServices = goToServices;
window.goToWelcome = goToWelcomeFromServices;
window.toggleCategory = toggleCategory;
window.openService = openService;
window.closeServiceModal = closeServiceModal;
window.launchService = launchService;
window.showAbout = showAbout;
window.closeAbout = closeAbout;
window.showContact = showContact;
window.closeContact = closeContact;
window.setTheme = setTheme;
