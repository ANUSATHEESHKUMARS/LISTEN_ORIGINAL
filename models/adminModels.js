import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const adminSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    role: {
        type: String,
        default: 'admin'
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Create default admin method
adminSchema.statics.createDefaultAdmin = async function() {
    try {
        const adminExists = await this.findOne({ email: 'admin@listen.com' });
        
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await this.create({
                name: 'Super Admin',
                email: 'admin@listen.com',
                password: hashedPassword,
                role: 'admin',
                isActive: true
            });
            console.log('Default admin created successfully');
        }
    } catch (error) {
        console.error('Error creating default admin:', error);
    }
};

const Admin = mongoose.model('Admin', adminSchema);

export default Admin;