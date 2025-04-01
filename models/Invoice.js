import mongoose from 'mongoose';
const { Schema } = mongoose;

const invoiceSchema = new Schema({
  invoiceNumber: {
    type: String,
    unique: true,
    default: ''
  }, // Unique invoice number (Auto-generated)
  
  projectId: { 
    type: Schema.Types.ObjectId, 
    ref: "Project" 
  }, // Reference to project
  
  currency: {
    code: { type: String, default: 'INR' }, // Currency code (ISO 4217)
    symbol: { type: String, default: '₹' }  // Currency symbol
  },
  
  agency: { // Agency details
    name: { type: String, required: true, default: "EGMA" },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    logo: { type: String }, // URL to logo image
    website: { type: String },
    registrationNumber: { type: String } // Optional
  },

  client: { // Client details
    name: { type: String, required: true },
    agencyName: { type: String }, // Optional
    email: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    registrationNumber: { type: String } // Optional
  },

  goods: [ // Services/products list
    {
      description: { type: String, required: true }, // Item name or service description
      quantity: { type: Number, required: true, min: 1 }, // Quantity
      price: { type: Number, required: true }, // Price per unit
      total: { type: Number, default: 0 }, // Total cost (auto-calculated)
      taxRate: { type: Number, default: 0 }, // Tax rate in percentage (optional)
      taxAmount: { type: Number, default: 0 } // Tax amount (auto-calculated)
    }
  ],

  payment: { // Payment details
    status: { 
      type: String, 
      enum: ["draft", "pending", "paid", "partially_paid", "overdue", "cancelled"], 
      default: "draft" 
    },
    subtotal: { type: Number, default: 0 }, // Set default instead of required
    taxTotal: { type: Number, default: 0 }, // Total tax amount
    discount: { type: Number, default: 0 }, // Discount amount if any
    totalAmount: { type: Number, default: 0 }, // Set default instead of required
    amountPaid: { type: Number, default: 0 }, // Total amount received
    amountDue: { type: Number, default: 0 }, // Remaining balance (auto-calculated)

    methods: [ // Multiple payment methods
      {
        method: {
          type: String,
          enum: ["bank transfer", "credit card", "paypal", "cash", "crypto", "cheque", "upi", "other"],
          required: true
        },
        date: { type: Date, default: Date.now }, // Date of payment
        transactionId: { type: String, required: function() { return this.method !== "cash"; } }, // Only required for non-cash payments
        accountNumber: { type: String, required: function() { return this.method === "bank transfer"; } }, // Only for bank transfer
        cardLast4Digits: { type: String, required: function() { return this.method === "credit card"; } }, // Only for credit card
        cryptoWalletAddress: { type: String, required: function() { return this.method === "crypto"; } }, // Only for crypto payments
        chequeNumber: { type: String, required: function() { return this.method === "cheque"; } }, // Only for cheque payments
        upiId: { type: String, required: function() { return this.method === "upi"; } }, // Only for UPI payments
        amount: { type: Number, required: true }, // Amount paid using this method
        notes: { type: String } // Additional notes for this payment
      }
    ]
  },

  issuedDate: { type: Date, default: Date.now }, // Invoice date
  dueDate: { type: Date, required: true }, // Payment due date
  
  notes: { type: String }, // Additional notes on the invoice
  terms: { type: String }, // Terms and conditions
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Auto-calculate fields before saving
invoiceSchema.pre("save", function (next) {
  // Initialize required fields to prevent validation errors
  if (!this.payment) {
    this.payment = {};
  }
  
  if (this.payment.methods === undefined) {
    this.payment.methods = [];
  }
  
  // Recalculate amountPaid from payment methods
  this.payment.amountPaid = this.payment.methods.reduce((sum, method) => sum + method.amount, 0);
  
  // Calculate goods totals
  this.goods.forEach(item => {
    item.total = item.quantity * item.price;
    item.taxAmount = item.taxRate ? (item.total * item.taxRate) / 100 : 0;
  });
  
  // Calculate subtotal
  this.payment.subtotal = this.goods.reduce((sum, item) => sum + item.total, 0);
  
  // Calculate tax total
  this.payment.taxTotal = this.goods.reduce((sum, item) => sum + (item.taxAmount || 0), 0);
  
  // Calculate total amount
  this.payment.totalAmount = this.payment.subtotal + this.payment.taxTotal - (this.payment.discount || 0);
  
  // Calculate amount due
  this.payment.amountDue = this.payment.totalAmount - this.payment.amountPaid;
  
  // Update payment status based on amounts
  if (this.payment.amountPaid === 0) {
    if (this.payment.status !== "draft") {
      this.payment.status = "pending";
    }
  } else if (this.payment.amountPaid < this.payment.totalAmount) {
    this.payment.status = "partially_paid";
  } else if (this.payment.amountPaid >= this.payment.totalAmount) {
    this.payment.status = "paid";
  }
  
  // Check if invoice is overdue
  if (new Date() > this.dueDate && this.payment.amountDue > 0) {
    this.payment.status = "overdue";
  }
  
  // Auto-generate invoice number if not provided
  if (!this.invoiceNumber || this.invoiceNumber === '') {
    this.invoiceNumber = `EGMA-INV-${Math.floor(1000 + Math.random() * 9000)}`;
  }
  
  // Update the updatedAt timestamp
  this.updatedAt = Date.now();
  
  next();
});

// Virtual for calculating amounts
invoiceSchema.virtual('paymentPercentage').get(function() {
  if (this.payment.totalAmount === 0) return 0;
  return (this.payment.amountPaid / this.payment.totalAmount) * 100;
});

// Method to add a new payment
invoiceSchema.methods.addPayment = async function(paymentDetails) {
  this.payment.methods.push(paymentDetails);
  this.payment.amountPaid += paymentDetails.amount;
  await this.save();
  return this;
};

// Ensure virtuals are included when converting to JSON
invoiceSchema.set('toJSON', { virtuals: true });
invoiceSchema.set('toObject', { virtuals: true });

const Invoice = mongoose.model("Invoice", invoiceSchema);
export default Invoice;
