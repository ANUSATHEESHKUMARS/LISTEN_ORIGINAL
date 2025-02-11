document.addEventListener('DOMContentLoaded', function() {
    // Toggle password visibility
    const togglePasswordButtons = document.querySelectorAll('.toggle-password');
    togglePasswordButtons.forEach(button => {
        button.addEventListener('click', function() {
            const input = this.previousElementSibling;
            if (input.type === 'password') {
                input.type = 'text';
                this.classList.remove('fa-eye-slash');
                this.classList.add('fa-eye');
            } else {
                input.type = 'password';
                this.classList.remove('fa-eye');
                this.classList.add('fa-eye-slash');
            }
        });
    });

    // Form validation
    const signupForm = document.getElementById('signupForm');
    const loginForm = document.getElementById('loginForm');

    if (signupForm) {
        signupForm.addEventListener('submit', validateSignupForm);
    }

    if (loginForm) {
        loginForm.addEventListener('submit', validateLoginForm);
    }
});

// Validation helper functions
function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    errorElement.textContent = message;
    errorElement.style.display = 'block';
}

function clearError(elementId) {
    const errorElement = document.getElementById(elementId);
    errorElement.textContent = '';
    errorElement.style.display = 'none';
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function isValidMobile(mobile) {
    const mobileRegex = /^[0-9]{10}$/;
    return mobileRegex.test(mobile);
}

function isValidPassword(password) {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/;
    return passwordRegex.test(password);
}

// Signup form validation
function validateSignupForm(event) {
    let isValid = true;
    
    // Name validation
    const name = document.getElementById('name').value.trim();
    if (!name) {
        showError('nameError', 'Name is required');
        isValid = false;
    } else if (name.length < 2) {
        showError('nameError', 'Name must be at least 2 characters');
        isValid = false;
    } else {
        clearError('nameError');
    }

    // Email validation
    const email = document.getElementById('email').value.trim();
    if (!email) {
        showError('emailError', 'Email is required');
        isValid = false;
    } else if (!isValidEmail(email)) {
        showError('emailError', 'Please enter a valid email');
        isValid = false;
    } else {
        clearError('emailError');
    }

    // Mobile validation
    const mobile = document.getElementById('mobile').value.trim();
    if (!mobile) {
        showError('mobileError', 'Mobile number is required');
        isValid = false;
    } else if (!isValidMobile(mobile)) {
        showError('mobileError', 'Please enter a valid 10-digit mobile number');
        isValid = false;
    } else {
        clearError('mobileError');
    }

    // Password validation
    const password = document.getElementById('password').value;
    if (!password) {
        showError('passwordError', 'Password is required');
        isValid = false;
    } else if (!isValidPassword(password)) {
        showError('passwordError', 
            'Password must be at least 8 characters with 1 uppercase, 1 lowercase and 1 number');
        isValid = false;
    } else {
        clearError('passwordError');
    }

    // Confirm password validation
    const confirmPassword = document.getElementById('confirmPassword').value;
    if (!confirmPassword) {
        showError('confirmPasswordError', 'Please confirm your password');
        isValid = false;
    } else if (password !== confirmPassword) {
        showError('confirmPasswordError', 'Passwords do not match');
        isValid = false;
    } else {
        clearError('confirmPasswordError');
    }

    if (!isValid) {
        event.preventDefault();
    }
}

// Login form validation
function validateLoginForm(event) {
    let isValid = true;

    // Email validation
    const email = document.getElementById('email').value.trim();
    if (!email) {
        showError('emailError', 'Email is required');
        isValid = false;
    } else if (!isValidEmail(email)) {
        showError('emailError', 'Please enter a valid email');
        isValid = false;
    } else {
        clearError('emailError');
    }

    // Password validation
    const password = document.getElementById('password').value;
    if (!password) {
        showError('passwordError', 'Password is required');
        isValid = false;
    } else {
        clearError('passwordError');
    }

    if (!isValid) {
        event.preventDefault();
    }
}