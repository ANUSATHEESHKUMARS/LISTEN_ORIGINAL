import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import dotenv from 'dotenv';

dotenv.config();

// Verify environment variables
const GOOGLE_CLIENT_ID = process.env.client_id; // Match your .env variable name
const GOOGLE_CLIENT_SECRET = process.env.client_secret; // Match your .env variable name

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.error('Missing Google OAuth credentials in .env file!');
    console.log('Available environment variables:', process.env);
}

passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback",
    passReqToCallback: true
},
async (req, accessToken, refreshToken, profile, done) => {
    try {
        console.log('Google Profile:', profile); // Debug log
        
        const userProfile = {
            id: profile.id,
            displayName: profile.displayName,
            email: profile.emails[0].value,
            firstName: profile.name.givenName,
            lastName: profile.name.familyName,
            picture: profile.photos?.[0]?.value
        };
        
        return done(null, userProfile);
    } catch (error) {
        console.error('Google Strategy Error:', error);
        return done(error, null);
    }
}));

// Serialize the entire user profile
passport.serializeUser((user, done) => {
    console.log('Serializing user:', user); // Debug log
    done(null, user);
});

// Deserialize the entire user profile
passport.deserializeUser((user, done) => {
    console.log('Deserializing user:', user); // Debug log
    done(null, user);
});

export default passport;