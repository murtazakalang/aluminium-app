const express = require('express');
const manufacturingController = require('../controllers/manufacturingController');
const { protect } = require('../controllers/authController');
const rbac = require('../middleware/rbac');

const router = express.Router();

// Protect all routes after this middleware
router.use(protect);

/**
 * @openapi
 * /api/manufacturing/optimize-cuts:
 *   post:
 *     summary: Triggers the cutting optimization process for a given order.
 *     tags: [Manufacturing]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orderId
 *             properties:
 *               orderId:
 *                 type: string
 *                 description: The ID of the order to optimize.
 *     responses:
 *       200:
 *         description: Optimization started, returns the created CuttingPlan.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CuttingPlan'
 *       400:
 *         description: Bad request (e.g., invalid orderId, order not ready).
 *       401:
 *         description: Unauthorized.
 *       404:
 *         description: Order not found.
 *       500:
 *         description: Server error during optimization.
 */
router.post('/optimize-cuts', rbac(['Admin', 'Manager']), manufacturingController.optimizeCutsForOrder);

/**
 * @openapi
 * /api/manufacturing/orders/{orderId}/cutting-plan:
 *   get:
 *     summary: Retrieves the generated cutting plan for a specific order.
 *     tags: [Manufacturing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the order.
 *     responses:
 *       200:
 *         description: Successfully retrieved the cutting plan.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CuttingPlan'
 *       401:
 *         description: Unauthorized.
 *       404:
 *         description: Cutting plan or order not found.
 *       500:
 *         description: Server error.
 */
router.get('/orders/:orderId/cutting-plan', rbac(['Admin', 'Manager', 'Staff']), manufacturingController.getCuttingPlanByOrderId);

/**
 * @openapi
 * /api/manufacturing/orders/{orderId}/cutting-plan/svg:
 *   get:
 *     summary: Generates an SVG representation of the cutting plan for an order.
 *     tags: [Manufacturing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the order.
 *     responses:
 *       200:
 *         description: Successfully generated SVG representation.
 *         content:
 *           image/svg+xml:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Unauthorized.
 *       404:
 *         description: Cutting plan or order not found.
 *       500:
 *         description: Server error during SVG generation.
 */
router.get('/orders/:orderId/cutting-plan/svg', rbac(['Admin', 'Manager', 'Staff']), manufacturingController.getCuttingPlanSvgByOrderId);

/**
 * @openapi
 * /api/manufacturing/orders/{orderId}/cutting-plan/pdf:
 *   get:
 *     summary: Generates a PDF of the cutting plan with company details, client information, and visualizations.
 *     tags: [Manufacturing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the order.
 *     responses:
 *       200:
 *         description: Successfully generated PDF.
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Unauthorized.
 *       404:
 *         description: Cutting plan or order not found.
 *       500:
 *         description: Server error during PDF generation.
 */
router.get('/orders/:orderId/cutting-plan/pdf', rbac(['Admin', 'Manager', 'Staff']), manufacturingController.getCuttingPlanPdfByOrderId);

/**
 * @openapi
 * /api/manufacturing/orders/{orderId}/pipe-order-summary:
 *   get:
 *     summary: Retrieves the pipe order summary (total pipes per length, scrap, weight) for an order's cutting plan.
 *     tags: [Manufacturing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the order.
 *     responses:
 *       200:
 *         description: Successfully retrieved the pipe order summary.
 *         content:
 *           application/json:
 *             schema:
 *               type: object # Define structure based on CuttingPlan.materialPlans.summary for each material
 *       401:
 *         description: Unauthorized.
 *       404:
 *         description: Cutting plan or order not found.
 *       500:
 *         description: Server error.
 */
router.get('/orders/:orderId/pipe-order-summary', rbac(['Admin', 'Manager', 'Staff']), manufacturingController.getPipeOrderSummaryByOrderId);

/**
 * @openapi
 * /api/manufacturing/orders/{orderId}/stage:
 *   put:
 *     summary: Updates the manufacturing stage of an order (e.g., Assembly, QC, Packed).
 *     tags: [Manufacturing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the order.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 description: The new manufacturing stage/status for the order.
 *                 enum: ['Cutting', 'Assembly', 'QC', 'Packed', 'Ready for Dispatch', 'On Hold']
 *               notes:
 *                 type: string
 *                 description: Optional notes for the status change.
 *     responses:
 *       200:
 *         description: Order stage updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 *       400:
 *         description: Bad request (e.g., invalid status).
 *       401:
 *         description: Unauthorized.
 *       404:
 *         description: Order not found.
 *       500:
 *         description: Server error.
 */
router.put('/orders/:orderId/stage', rbac(['Admin', 'Manager', 'Staff']), manufacturingController.updateOrderStage);

/**
 * @openapi
 * /api/manufacturing/orders/{orderId}/commit-cuts:
 *   post:
 *     summary: Commits the generated cutting plan, updates inventory, and changes order status.
 *     tags: [Manufacturing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the order for which to commit cuts.
 *     responses:
 *       200:
 *         description: Cuts committed, inventory updated, and order status changed.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 order:
 *                   $ref: '#/components/schemas/Order'
 *                 cuttingPlan:
 *                   $ref: '#/components/schemas/CuttingPlan'
 *       400:
 *         description: Bad request (e.g., cutting plan not generated or already committed).
 *       401:
 *         description: Unauthorized.
 *       404:
 *         description: Order or cutting plan not found.
 *       500:
 *         description: Server error during commit (potential rollback needed).
 */
router.post('/orders/:orderId/commit-cuts', rbac(['Admin', 'Manager']), manufacturingController.commitCutsForOrder);

/**
 * @openapi
 * /api/manufacturing/queue:
 *   get:
 *     summary: Retrieves the manufacturing queue with optional filters
 *     tags: [Manufacturing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by manufacturing status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by order ID or client name
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Successfully retrieved manufacturing queue
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     orders:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Order'
 *                     results:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/queue', rbac(['Admin', 'Manager', 'Staff']), manufacturingController.getManufacturingQueue);

// Debug endpoint for testing frontend connectivity
router.get('/test', rbac(['Admin', 'Manager', 'Staff']), (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'Manufacturing API is working!',
        timestamp: new Date().toISOString(),
        user: req.user ? req.user._id : 'unknown'
    });
});

module.exports = router; 