import Coupon from '../../models/couponModel.js';
import userSchema from '../../models/userModels.js';

const couponController = {
    getCoupons: async (req, res) => {
        try {
            const currentDate = new Date();
            const user = await userSchema.findById(req.session.user);
            
            // Find all active coupons (including scheduled ones)
            const coupons = await Coupon.find({
                isActive: true,
                expiryDate: { $gt: currentDate }  // Only check if not expired
            }).sort({ startDate: 1 }); // Sort by start date

            // Filter and categorize coupons
            const availableCoupons = coupons.filter(coupon => {
                // Check total usage limit
                if (coupon.totalCoupon && coupon.usedCouponCount >= coupon.totalCoupon) {
                    return false;
                }

                // Check if coupon is currently active or scheduled
                const startDate = new Date(coupon.startDate);
                const isScheduled = startDate > currentDate;
                const isActive = startDate <= currentDate;

                return isActive || isScheduled; // Include both active and scheduled coupons
            });

            res.render('user/coupon', { 
                coupons: availableCoupons,
                user,
                currentDate: currentDate // Pass current date to template
            });
            
        } catch (error) {
            console.error('Get coupons error:', error);
            res.status(500).render('error', { 
                message: 'Error fetching coupons'
            });
        }
    }
};

export default couponController; 