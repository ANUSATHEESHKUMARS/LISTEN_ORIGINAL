import userSchema from "../../models/userModels.js";
import { generateOTP, sendOTPEmail } from "../../utils/sentOTP.js";

const getProfile = async (req, res) => {
    try {
        const user = await userSchema.findById(req.session.user);
        res.render('user/profile', { user });
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).send('Error loading profile');
    }
};

const updateProfile = async (req, res) => {
    try {
        const { firstName, lastName, email } = req.body;


        const nameRegex = /^[A-Za-z]+$/;
        const errors = [];


        if (!firstName || firstName.trim().length === 0) {
            errors.push('First name is required');
        } else if (firstName.trim().length < 3 || firstName.trim().length > 10) {
            errors.push('First name must be between 3 and 10 characters');
        } else if (!nameRegex.test(firstName.trim())) {
            errors.push('First name can only contain letters');
        }

        // Last Name validation
        if (!lastName || lastName.trim().length === 0) {
            errors.push('Last name is required');
        } else if (lastName.trim().length < 1 || lastName.trim().length > 10) {
            errors.push('Last name must be between 1 and 10 characters');
        } else if (!nameRegex.test(lastName.trim())) {
            errors.push('Last name can only contain letters');
        }

        if (errors.length > 0) {
            return res.status(400).json({
                message: errors.join(', ')
            });
        }

        // Update user profile if validation passes
        await userSchema.findOneAndUpdate(
            { email: email },
            {
                firstName: firstName.trim(),
                lastName: lastName.trim(),
            },
            { new: true }
        );

        res.status(200).json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ message: 'Error updating profile' });
    }
};

const initiateEmailChange = async (req, res) => {
    try {
        const { newEmail } = req.body;
        
        // Check if email is different from current email
        const currentUser = await userSchema.findById(req.session.user);
        if (currentUser.email === newEmail) {
            return res.status(400).json({ message: 'New email must be different from current email' });
        }

        // Check if email is already in use
        const existingUser = await userSchema.findOne({ email: newEmail });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already in use' });
        }

        // Generate OTP
        const otp = generateOTP();
        
        // Store OTP and new email in session
        req.session.emailChange = {
            otp,
            newEmail,
            timestamp: Date.now()
        };

        // Send OTP email
        await sendOTPEmail(newEmail, otp);

        res.status(200).json({ message: 'OTP sent successfully' });
    } catch (error) {
        console.error('Error initiating email change:', error);
        res.status(500).json({ message: 'Failed to send OTP' });
    }
};

const verifyEmailOTP = async (req, res) => {
    try {
        const { otp } = req.body;

        if (!req.session.emailChange) {
            return res.status(400).json({ message: 'No email change request found' });
        }

        const { otp: storedOTP, newEmail, timestamp } = req.session.emailChange;

        // Check if OTP has expired (10 minutes)
        if (Date.now() - timestamp > 600000) {
            delete req.session.emailChange;
            return res.status(400).json({ message: 'OTP has expired' });
        }

        // Verify OTP
        if (otp !== storedOTP) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        // Update email
        await userSchema.findByIdAndUpdate(req.session.user, { email: newEmail });

        // Clear email change session data
        delete req.session.emailChange;

        res.status(200).json({ message: 'Email updated successfully' });
    } catch (error) {
        console.error('Error verifying email OTP:', error);
        res.status(500).json({ message: 'Failed to verify OTP' });
    }
};

export default { getProfile, updateProfile, initiateEmailChange, verifyEmailOTP };