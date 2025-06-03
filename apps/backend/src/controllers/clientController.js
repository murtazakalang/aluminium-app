const Client = require('../models/Client');
// Assuming you have a Quotation and Order model for the history
const Quotation = require('../models/Quotation'); 
const Order = require('../models/Order');

// @desc    Get all clients
// @route   GET /api/clients
// @access  Private (requires auth, rbac, multi-tenancy)
exports.getClients = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status, leadSource, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const companyId = req.user.companyId; // Assuming multi-tenancy middleware adds this

    const query = { companyId, isActive: true }; // Default to active clients

    if (search) {
      query.$or = [
        { clientName: { $regex: search, $options: 'i' } },
        { contactPerson: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { contactNumber: { $regex: search, $options: 'i' } }
      ];
    }
    if (status) {
      query.followUpStatus = status;
    }
    if (leadSource) {
      query.leadSource = leadSource;
    }

    const parsedPage = parseInt(page, 10) || 1;
    const parsedLimit = parseInt(limit, 10) || 10;

    const clients = await Client.find(query)
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .limit(parsedLimit)
      .skip((parsedPage - 1) * parsedLimit)
      .exec();

    const count = await Client.countDocuments(query);

    res.status(200).json({
      success: true,
      data: clients,
      totalPages: Math.ceil(count / parsedLimit),
      currentPage: parsedPage,
      count,
      total: count
    });
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Create a new client
// @route   POST /api/clients
// @access  Private
exports.createClient = async (req, res) => {
  try {
    const { clientName, contactPerson, contactNumber, email, billingAddress, siteAddress, gstin, leadSource } = req.body;
    const companyId = req.user.companyId;
    const createdBy = req.user._id;

    // Basic validation
    if (!clientName || !contactNumber) {
      return res.status(400).json({ success: false, message: 'Please provide client name and contact number' });
    }

    // Build address objects if provided
    const billingAddrObj = billingAddress ? { street: billingAddress } : undefined;
    const siteAddrObj = siteAddress ? { street: siteAddress } : undefined;

    const newClient = new Client({
      clientName,
      contactPerson,
      contactNumber,
      email,
      gstin,
      companyId,
      createdBy,
      ...(billingAddrObj && { billingAddress: billingAddrObj }),
      ...(siteAddrObj && { siteAddress: siteAddrObj }),
      leadSource,
    });

    await newClient.save();
    res.status(201).json({ success: true, data: newClient });
  } catch (error) {
    console.error('Error creating client:', error);
    if (error.code === 11000) {
        return res.status(400).json({ success: false, message: 'Client with this email already exists for your company.' });
    }
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// @desc    Get a single client
// @route   GET /api/clients/:clientId
// @access  Private
exports.getClientById = async (req, res) => {
  try {
    const client = await Client.findOne({ _id: req.params.clientId, companyId: req.user.companyId });
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }
    res.status(200).json({ success: true, data: client });
  } catch (error) {
    console.error('Error fetching client by ID:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Update a client
// @route   PUT /api/clients/:clientId
// @access  Private
exports.updateClient = async (req, res) => {
  try {
    const { clientId } = req.params;
    const companyId = req.user.companyId;
    const updates = req.body; // { clientName, contactNumber, email, ... }

    // Wrap address strings if provided
    if (typeof updates.billingAddress === 'string') {
      updates.billingAddress = { street: updates.billingAddress };
    }
    if (typeof updates.siteAddress === 'string') {
      updates.siteAddress = { street: updates.siteAddress };
    }

    // Ensure companyId and createdBy are not updated directly
    delete updates.companyId;
    delete updates.createdBy;
    delete updates.notes;

    const client = await Client.findOneAndUpdate(
      { _id: clientId, companyId },
      updates,
      { new: true, runValidators: true }
    );

    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found or not authorized to update' });
    }
    res.status(200).json({ success: true, data: client });
  } catch (error) {
    console.error('Error updating client:', error);
     if (error.code === 11000) {
        return res.status(400).json({ success: false, message: 'Update failed. A client with this email might already exist for your company.' });
    }
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// @desc    Delete a client (soft delete)
// @route   DELETE /api/clients/:clientId
// @access  Private
exports.deleteClient = async (req, res) => {
  try {
    const { clientId } = req.params;
    const companyId = req.user.companyId;

    const client = await Client.findOneAndUpdate(
      { _id: clientId, companyId },
      { isActive: false },
      { new: true }
    );

    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found or not authorized to delete' });
    }
    res.status(200).json({ success: true, message: 'Client deactivated successfully', data: client });
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Add a note to a client
// @route   POST /api/clients/:clientId/notes
// @access  Private
exports.addClientNote = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { text, reminderDate } = req.body;
    const createdBy = req.user._id;
    const companyId = req.user.companyId;

    if (!text) {
      return res.status(400).json({ success: false, message: 'Note text is required' });
    }

    const client = await Client.findOne({ _id: clientId, companyId });

    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    const newNote = {
      text,
      createdBy,
      createdAt: new Date(), // Ensure notes also have a creation date for sorting
      reminderDate: reminderDate ? new Date(reminderDate) : undefined,
    };

    client.notes.push(newNote);
    await client.save();

    // Return the newly added note in a structure that can be merged into history
    const formattedNote = {
        _id: client.notes[client.notes.length -1]._id, // or generate a temporary unique id if not available immediately
        type: 'Note',
        title: `Note added by ${req.user.firstName || 'User'}`,
        description: text,
        date: newNote.createdAt,
        // documentId: client.notes[client.notes.length -1]._id // Not typically linked like quote/order
    };

    res.status(201).json({ success: true, data: formattedNote, message: 'Note added successfully' });
  } catch (error) {
    console.error('Error adding client note:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Get client history (Quotes/Orders/Notes)
// @route   GET /api/clients/:clientId/history
// @access  Private
exports.getClientHistory = async (req, res) => {
  try {
    const { clientId } = req.params;
    const companyId = req.user.companyId;

    const client = await Client.findOne({ _id: clientId, companyId: companyId });
    if (!client) {
        return res.status(404).json({ success: false, message: 'Client not found' });
    }
    
    const quotations = await Quotation.find({ clientId, companyId }).sort({ createdAt: -1 });
    const orders = await Order.find({ clientId, companyId }).sort({ createdAt: -1 });
    // Notes are directly on the client model, ensure they have a `createdAt` for consistent sorting
    const notes = client.notes || [];

    const history = [
      ...quotations.map(q => ({ 
        _id: q._id.toString(),
        type: 'Quotation', 
        title: `Quotation ${q.quotationIdDisplay}`,
        description: `Total: ${q.grandTotal} (${q.status})`,
        date: q.createdAt,
        amount: parseFloat(q.grandTotal.toString()), // Ensure amount is a number
        status: q.status,
        documentId: q._id.toString()
      })),
      ...orders.map(o => ({ 
        _id: o._id.toString(),
        type: 'Order', 
        title: `Order ${o.orderIdDisplay}`,
        description: `Status: ${o.status}`,
        date: o.createdAt,
        amount: parseFloat(o.finalGrandTotal.toString()), // Ensure amount is a number
        status: o.status,
        documentId: o._id.toString()
      })),
      ...notes.map(n => ({
        _id: n._id.toString(), // Ensure notes have an _id
        type: 'Note',
        title: 'Note Added',
        description: n.text,
        date: n.createdAt, // Assuming notes have createdAt
        // documentId: n._id // Notes might not need a document link in the same way
      }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.status(200).json({ success: true, data: history });
  } catch (error) {
    console.error('Error fetching client history:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Update client follow-up status
// @route   PUT /api/clients/:clientId/status
// @access  Private
exports.updateClientFollowUpStatus = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { followUpStatus } = req.body;
    const companyId = req.user.companyId;

    if (!followUpStatus) {
      return res.status(400).json({ success: false, message: 'Follow-up status is required' });
    }

    // Optional: Validate if followUpStatus is one of the enum values in Client schema
    // const validStatuses = Client.schema.path('followUpStatus').enumValues;
    // if (!validStatuses.includes(followUpStatus)) {
    //   return res.status(400).json({ success: false, message: 'Invalid follow-up status' });
    // }

    const client = await Client.findOneAndUpdate(
      { _id: clientId, companyId },
      { followUpStatus },
      { new: true, runValidators: true }
    );

    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found or not authorized' });
    }

    res.status(200).json({ success: true, data: client, message: 'Follow-up status updated' });
  } catch (error) {
    console.error('Error updating client follow-up status:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
}; 