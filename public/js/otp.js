document.addEventListener('DOMContentLoaded', function() {
    const otpInputs = document.querySelectorAll('.otp-input');
    const resendBtn = document.getElementById('resendBtn');
    const timerSpan = document.getElementById('timer');
    let timeLeft = 120; // 2 minutes

    // OTP input handling
    otpInputs.forEach((input, index) => {
        input.addEventListener('keyup', (e) => {
            if (e.key >= 0 && e.key <= 9) {
                if (index < otpInputs.length - 1) {
                    otpInputs[index + 1].focus();
                }
            } else if (e.key === 'Backspace') {
                if (index > 0) {
                    otpInputs[index - 1].focus();
                }
            }
        });
    });

    // Timer functionality
    function updateTimer() {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerSpan.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        if (timeLeft === 0) {
            resendBtn.disabled = false;
            return;
        }
        
        timeLeft--;
        setTimeout(updateTimer, 1000);
    }

    updateTimer();

    // Resend OTP functionality
    resendBtn.addEventListener('click', async () => {
        try {
            const response = await fetch('/user/resend-otp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            if (data.success) {
                resendBtn.disabled = true;
                timeLeft = 120;
                updateTimer();
                alert('OTP has been resent!');
            } else {
                alert(data.message || 'Failed to resend OTP');
            }
        } catch (error) {
            alert('An error occurred. Please try again.');
        }
    });
});