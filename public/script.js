// Smooth scrolling for navigation links
function scrollToSection(sectionId) {
    const element = document.getElementById(sectionId);
    if (element) {
        element.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
}

// Modal functions
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        
        // Add click outside to close
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeModal(modalId);
            }
        });
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

function switchModal(currentModalId, targetModalId) {
    closeModal(currentModalId);
    setTimeout(() => {
        openModal(targetModalId);
    }, 100);
}

// Form handling
document.addEventListener('DOMContentLoaded', function() {
    // Contact form
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleContactForm(this);
        });
    }

    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleLoginForm(this);
        });
    }

    // Register form
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleRegisterForm(this);
        });
    }

    // Project form
    const projectForm = document.getElementById('projectForm');
    if (projectForm) {
        projectForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleProjectForm(this);
        });
    }

    // Mobile menu toggle
    const mobileToggle = document.querySelector('.mobile-menu-toggle');
    const navMenu = document.querySelector('.nav-menu');
    
    if (mobileToggle && navMenu) {
        mobileToggle.addEventListener('click', function() {
            navMenu.classList.toggle('active');
        });
    }

    // Header scroll effect
    window.addEventListener('scroll', function() {
        const header = document.querySelector('.header');
        if (window.scrollY > 100) {
            header.style.background = 'rgba(15, 15, 35, 0.98)';
        } else {
            header.style.background = 'rgba(15, 15, 35, 0.95)';
        }
    });

    // Intersection Observer for animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    // Observe elements for animation
    const animateElements = document.querySelectorAll('.service-card, .stat, .contact-item');
    animateElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
});

// Form handlers
function handleContactForm(form) {
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    // Add loading state
    const submitBtn = form.querySelector('.btn-submit');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
    submitBtn.disabled = true;
    
    // Simulate API call
    setTimeout(() => {
        console.log('Contact form data:', data);
        showNotification('Mensagem enviada com sucesso! Entraremos em contato em breve.', 'success');
        form.reset();
        
        // Reset button
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }, 2000);
}

function handleLoginForm(form) {
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    // Add loading state
    const submitBtn = form.querySelector('.btn-modal');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';
    submitBtn.disabled = true;
    
    // Simulate API call
    setTimeout(() => {
        console.log('Login data:', data);
        
        // Simulate login validation
        if (data.loginEmail && data.loginPassword) {
            showNotification('Login realizado com sucesso!', 'success');
            closeModal('loginModal');
            
            // Update UI for logged in state
            updateUIForLoggedInUser(data.loginEmail);
        } else {
            showNotification('Por favor, preencha todos os campos.', 'error');
        }
        
        // Reset button
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        form.reset();
    }, 1500);
}

function handleRegisterForm(form) {
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    // Validate password confirmation
    if (data.registerPassword !== data.confirmPassword) {
        showNotification('As senhas não coincidem.', 'error');
        return;
    }
    
    // Add loading state
    const submitBtn = form.querySelector('.btn-modal');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cadastrando...';
    submitBtn.disabled = true;
    
    // Simulate API call
    setTimeout(() => {
        console.log('Register data:', data);
        showNotification('Cadastro realizado com sucesso! Você já pode fazer login.', 'success');
        closeModal('registerModal');
        
        // Reset button
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        form.reset();
        
        // Open login modal
        setTimeout(() => {
            openModal('loginModal');
        }, 500);
    }, 2000);
}

function handleProjectForm(form) {
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    // Add loading state
    const submitBtn = form.querySelector('.btn-modal');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
    submitBtn.disabled = true;
    
    // Simulate API call
    setTimeout(() => {
        console.log('Project form data:', data);
        showNotification('Proposta enviada com sucesso! Nossa equipe entrará em contato em até 24 horas.', 'success');
        closeModal('contactModal');
        
        // Reset button
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        form.reset();
    }, 2000);
}

// Notification system
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas ${getNotificationIcon(type)}"></i>
            <span>${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        z-index: 3000;
        background: ${getNotificationColor(type)};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        animation: slideInRight 0.3s ease-out;
        max-width: 400px;
        word-wrap: break-word;
    `;
    
    // Add to DOM
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

function getNotificationIcon(type) {
    switch (type) {
        case 'success': return 'fa-check-circle';
        case 'error': return 'fa-exclamation-circle';
        case 'warning': return 'fa-exclamation-triangle';
        default: return 'fa-info-circle';
    }
}

function getNotificationColor(type) {
    switch (type) {
        case 'success': return 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
        case 'error': return 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
        case 'warning': return 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
        default: return 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
    }
}

// Update UI for logged in user
function updateUIForLoggedInUser(email) {
    const loginBtn = document.querySelector('.btn-login');
    const registerBtn = document.querySelector('.btn-register');
    
    if (loginBtn && registerBtn) {
        // Replace login/register buttons with user menu
        const userMenu = document.createElement('div');
        userMenu.className = 'user-menu';
        userMenu.innerHTML = `
            <div class="user-info">
                <i class="fas fa-user-circle"></i>
                <span>${email.split('@')[0]}</span>
                <i class="fas fa-chevron-down"></i>
            </div>
            <div class="user-dropdown">
                <a href="#" onclick="showNotification('Redirecionando para o dashboard...', 'info')">
                    <i class="fas fa-tachometer-alt"></i> Dashboard
                </a>
                <a href="#" onclick="showNotification('Redirecionando para o perfil...', 'info')">
                    <i class="fas fa-user"></i> Perfil
                </a>
                <a href="#" onclick="logout()">
                    <i class="fas fa-sign-out-alt"></i> Sair
                </a>
            </div>
        `;
        
        // Add styles for user menu
        userMenu.style.cssText = `
            position: relative;
            cursor: pointer;
        `;
        
        // Replace buttons
        loginBtn.parentElement.replaceChild(userMenu, loginBtn);
        registerBtn.remove();
        
        // Add dropdown functionality
        userMenu.addEventListener('click', function() {
            const dropdown = this.querySelector('.user-dropdown');
            dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
        });
    }
}

// Logout function
function logout() {
    showNotification('Logout realizado com sucesso!', 'success');
    
    // Reload page to reset UI
    setTimeout(() => {
        location.reload();
    }, 1000);
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            opacity: 0;
            transform: translateX(100%);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    
    @keyframes slideOutRight {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(100%);
        }
    }
    
    .notification-content {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }
    
    .notification-close {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        padding: 0.25rem;
        border-radius: 4px;
        transition: background-color 0.2s;
    }
    
    .notification-close:hover {
        background-color: rgba(255, 255, 255, 0.2);
    }
    
    .user-menu {
        position: relative;
    }
    
    .user-info {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 1rem;
        background: rgba(139, 92, 246, 0.1);
        border: 1px solid var(--primary-purple);
        border-radius: 12px;
        color: var(--text-light);
        font-weight: 500;
        transition: all 0.3s ease;
    }
    
    .user-info:hover {
        background: rgba(139, 92, 246, 0.2);
        transform: translateY(-2px);
    }
    
    .user-dropdown {
        display: none;
        position: absolute;
        top: 100%;
        right: 0;
        background: var(--dark-bg);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        padding: 0.5rem 0;
        min-width: 200px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(20px);
        z-index: 1000;
        margin-top: 0.5rem;
    }
    
    .user-dropdown a {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem 1rem;
        color: var(--text-light);
        text-decoration: none;
        transition: background-color 0.2s;
    }
    
    .user-dropdown a:hover {
        background: rgba(139, 92, 246, 0.1);
    }
    
    @media (max-width: 768px) {
        .nav-menu.active {
            display: flex;
            position: fixed;
            top: 80px;
            left: 0;
            right: 0;
            background: var(--dark-bg);
            flex-direction: column;
            padding: 2rem;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
        }
        
        .notification {
            right: 10px;
            left: 10px;
            max-width: none;
        }
    }
`;
document.head.appendChild(style);

// Keyboard navigation
document.addEventListener('keydown', function(e) {
    // Close modals with Escape key
    if (e.key === 'Escape') {
        const openModals = document.querySelectorAll('.modal[style*="block"]');
        openModals.forEach(modal => {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        });
    }
});

// Prevent form submission on Enter in input fields (except textarea)
document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
        e.preventDefault();
    }
});

// Add loading states to buttons
function addLoadingState(button, loadingText = 'Carregando...') {
    const originalText = button.innerHTML;
    button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${loadingText}`;
    button.disabled = true;
    
    return function removeLoadingState() {
        button.innerHTML = originalText;
        button.disabled = false;
    };
}

// Utility function for API calls (placeholder)
async function apiCall(endpoint, data = null, method = 'GET') {
    try {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            }
        };
        
        if (data && method !== 'GET') {
            options.body = JSON.stringify(data);
        }
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
        
        // Simulate response
        return {
            success: true,
            data: data,
            message: 'Operação realizada com sucesso!'
        };
    } catch (error) {
        console.error('API Error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Initialize tooltips (if needed)
function initTooltips() {
    const tooltipElements = document.querySelectorAll('[data-tooltip]');
    tooltipElements.forEach(element => {
        element.addEventListener('mouseenter', function() {
            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.textContent = this.getAttribute('data-tooltip');
            tooltip.style.cssText = `
                position: absolute;
                background: var(--dark-bg);
                color: var(--text-light);
                padding: 0.5rem 1rem;
                border-radius: 6px;
                font-size: 0.875rem;
                white-space: nowrap;
                z-index: 1000;
                border: 1px solid rgba(255, 255, 255, 0.1);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                pointer-events: none;
            `;
            
            document.body.appendChild(tooltip);
            
            const rect = this.getBoundingClientRect();
            tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
            tooltip.style.top = rect.top - tooltip.offsetHeight - 8 + 'px';
        });
        
        element.addEventListener('mouseleave', function() {
            const tooltip = document.querySelector('.tooltip');
            if (tooltip) {
                tooltip.remove();
            }
        });
    });
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initTooltips();
    
    // Add smooth reveal animation to hero section
    const heroElements = document.querySelectorAll('.hero-title, .hero-subtitle, .hero-buttons');
    heroElements.forEach((element, index) => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(30px)';
        element.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
        
        setTimeout(() => {
            element.style.opacity = '1';
            element.style.transform = 'translateY(0)';
        }, 200 * (index + 1));
    });
});

