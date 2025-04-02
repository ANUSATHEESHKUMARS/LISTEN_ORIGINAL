import Order from "../../models/orderModels.js"
import ExcelJS from 'exceljs'
import PDFDocument from "pdfkit-table"

const getSalesReport = async (req, res, next) => {
    try {
        const { startDate, endDate, period } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = 10;

        let query = {
            'items': {
                $elemMatch: {
                    'order.status': { $nin: ['cancelled', 'returned'] }
                }
            },
            'payment.paymentStatus': { $nin: ['failed', 'cancelled'] }
        };

        let dateRange = {};

        //handle different periods types
        if (period) {
            const now = new Date();
            switch (period) {
                case 'daily':
                    dateRange.start = new Date(now.setHours(0, 0, 0, 0));
                    dateRange.end = new Date(now.setHours(23, 59, 59, 999));
                    break;
                case 'weekly':
                    dateRange.start = new Date(now.setDate(now.getDate() - 7));
                    dateRange.end = new Date();
                    break;
                case 'monthly':
                    dateRange.start = new Date(now.setMonth(now.getMonth() - 1));
                    dateRange.end = new Date();
                    break;
                case 'yearly':
                    dateRange.start = new Date(now.setFullYear(now.getFullYear() - 1));
                    dateRange.end = new Date();
                    break;
            }
        } else if (startDate && endDate) {
            dateRange.start = new Date(new Date(startDate).setHours(0, 0, 0, 0));
            dateRange.end = new Date(new Date(endDate).setHours(23, 59, 59, 999));

        }

        if (dateRange.start && dateRange.end) {
            query.createdAt = {
                $gte: dateRange.start,
                $lte: dateRange.end
            };
        }

        // Count total documents for pagination
        const totalOrders = await Order.countDocuments(query);
        const totalPages = Math.ceil(totalOrders / limit);

        // Fetch paginated orders
        const orders = await Order.find(query)
            .populate('userId', 'firstName lastName email')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        // Calculate metrics with cancelled items excluded
        const metrics = {
            totalOrders: orders.length,
            totalSales: orders.reduce((sum, order) => {
                // Calculate total excluding cancelled items
                const validItemsTotal = order.items.reduce((itemSum, item) => {
                    if (item.order.status !== 'cancelled' && item.order.status !== 'returned') {
                        return itemSum + (item.price * item.quantity);
                    }
                    return itemSum;
                }, 0);
                return sum + validItemsTotal;
            }, 0),
            totalDiscount: orders.reduce((sum, order) => {
                // Only include discounts for non-cancelled items
                if (order.items.some(item => 
                    item.order.status !== 'cancelled' && 
                    item.order.status !== 'returned'
                )) {
                    return sum + (order.coupon?.discount || 0);
                }
                return sum;
            }, 0)
        };

        // Calculate net revenue
        metrics.netRevenue = metrics.totalSales - metrics.totalDiscount;
        
        // Calculate average order value
        metrics.averageOrderValue = orders.length ? metrics.netRevenue / orders.length : 0;

        // Group orders by date with cancelled items excluded
        const dailyData = orders.reduce((acc, order) => {
            const date = order.createdAt.toISOString().split('T')[0];
            if (!acc[date]) {
                acc[date] = {
                    orders: 0,
                    sales: 0,
                    discount: 0,
                    netRevenue: 0
                };
            }

            // Calculate daily totals excluding cancelled items
            const validItemsTotal = order.items.reduce((sum, item) => {
                if (item.order.status !== 'cancelled' && item.order.status !== 'returned') {
                    return sum + (item.price * item.quantity);
                }
                return sum;
            }, 0);

            if (validItemsTotal > 0) {
                acc[date].orders++;
                acc[date].sales += validItemsTotal;
                acc[date].discount += (order.coupon?.discount || 0);
                acc[date].netRevenue += (validItemsTotal - (order.coupon?.discount || 0));
            }

            return acc;
        }, {});

        res.render('admin/salesReport', {
            orders,
            metrics,
            dailyData,
            dateRange,
            period: period || 'custom',
            currentPage: page,
            totalPages,
            hasPrevPage: page > 1,
            hasNextPage: page < totalPages,
            startDate: startDate || '',
            endDate: endDate || ''
        });
    } catch (error) {
        next(error)
    }
};

const downloadExcel = async (req, res, next) => {
    try {
        const { startDate, endDate } = req.query;

        const startDay = new Date(startDate);
        const endDay = new Date(endDate);

        const start = new Date(startDay.setHours(0, 0, 0, 0));
        const end = new Date(endDay.setHours(23, 59, 59, 999));

        const orders = await Order.find({
            createdAt: { $gte: start, $lte: end },
            'items.order.status': { $nin: ['pending', 'cancelled'] },
            'payment.paymentStatus': { $nin: ['failed', 'cancelled'] }
        })
            .populate('userId', 'firstName lastName email')
            .populate('items.product', 'productName')
            .lean();

        // Create a new workbook and worksheet
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sales Report');

        // Define columns
        worksheet.columns = [
            { header: 'Order ID', key: 'orderId', width: 15 },
            { header: 'Date', key: 'date', width: 12 },
            { header: 'Customer', key: 'customer', width: 20 },
            { header: 'Items', key: 'items', width: 30 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Payment Method', key: 'paymentMethod', width: 15 },
            { header: 'Amount', key: 'amount', width: 12 }
        ];

        // Style header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        // Add data rows
        orders.forEach(order => {
            worksheet.addRow({
                orderId: order._id.toString(),
                date: new Date(order.createdAt).toLocaleDateString(),
                customer: `${order.userId?.firstName || ''} ${order.userId?.lastName || ''}`,
                items: order.items.map(item => `${item.product?.productName} (${item.quantity})`).join(', '),
                status: order.items[0]?.order?.status || 'N/A',
                paymentMethod: order.payment?.method || 'N/A',
                amount: order.totalAmount
            });
        });

        // Add totals row
        const totalAmount = orders.reduce((sum, order) => sum + order.totalAmount, 0);
        worksheet.addRow({
            orderId: '',
            date: '',
            customer: '',
            items: '',
            status: '',
            paymentMethod: 'Total:',
            amount: totalAmount
        }).font = { bold: true };

        // Set response headers
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            `attachment; filename=sales-report-${startDate}-to-${endDate}.xlsx`
        );

        // Write to response
        await workbook.xlsx.write(res);

    } catch (error) {
        console.error('Excel download error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate Excel report'
        });
    }
};


const downloadPDF = async (req, res, next) => {
    try {
        const { startDate, endDate } = req.query;
        console.log(startDate, endDate)
        const startDay = new Date(startDate);
        const endDay = new Date(endDate);

        const start = new Date(startDay.setHours(23, 59, 59, 999));
        const end = new Date(endDay.setHours(23, 59, 59, 999));

        const orders = await Order.find({
            createdAt: { $gte: start, $lte: end },
            'items.order.status': { $nin: ['pending', 'cancelled'] },
            'payment.paymentStatus': { $nin: ['failed', 'cancelled'] }
        })
            .populate('userId', 'firstName lastName email')
            .populate('items.product', 'name')
            .lean();

        const doc = new PDFDocument();

        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=sales-report-${startDate}-${endDate}.pdf`);

        // Pipe the PDF to the response
        doc.pipe(res);

        // Add content
        doc.fontSize(16).text('Sales Report', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Period: ${start.toLocaleDateString()} to ${end.toLocaleDateString()}`, { align: 'center' });
        doc.moveDown();

        // Create the table
        const table = {
            headers: ['Order ID', 'Date', 'Customer', 'Amount', 'Status'],
            rows: orders.map(order => [
                order.orderCode,
                new Date(order.createdAt).toLocaleDateString(),
                `${order.userId?.firstName || ''} ${order.userId?.lastName || ''}`,
                `₹${order.totalAmount.toFixed(2)}`,
                order.items[0]?.order?.status || 'N/A'
            ])
        };

        // Add table to document
        doc.table(table, {
            prepareHeader: () => doc.font('Helvetica-Bold').fontSize(10),
            prepareRow: () => doc.font('Helvetica').fontSize(10)
        });

        // Finalize PDF file
        doc.end();

    } catch (error) {
        next(error)
    }
};

export default {
    getSalesReport,
    downloadExcel,
    downloadPDF
}