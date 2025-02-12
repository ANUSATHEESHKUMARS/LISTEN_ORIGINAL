import Admin from '../models/adminModel.js';
import bcrypt from 'bcrypt';
import connectDB from '../models/db.js';

async function createAdminUser() {
    try {
        await connectDB();
        
        const adminExists = await Admin.findOne({ email: 'admin@listen.com' });
        
        if (adminExists) {
            console.log('Admin user already exists');
            return;
        }

        const hashedPassword = await bcrypt.hash('admin123', 10);
        
        const admin = new Admin({
            email: 'admin@listen.com',
            password: hashedPassword,
            name: 'Admin User'
        });

        await admin.save();
        console.log('Admin user created successfully');
    } catch (error) {
        console.error('Error creating admin:', error);
    }
}

createAdminUser();