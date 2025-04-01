import mongoose from 'mongoose';
const { Schema } = mongoose;

const proposalSchema = new Schema({
  projectId: { 
    type: Schema.Types.ObjectId, 
    ref: "Project"
  },
  clientDetails: {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String }
  },
  title: { type: String, required: true },
  description: { type: String, required: true },
  scope: { type: String, required: true },
  deliverables: [{ type: String }],
  timeline: { type: String, required: true },
  currency: {
    code: { type: String, default: 'INR' }, // Currency code (ISO 4217)
    symbol: { type: String, default: '₹' }  // Currency symbol
  },
  budgetEstimate: { type: Number, required: true },
  terms: { type: String },
  status: { 
    type: String, 
    enum: ["draft", "sent", "accepted", "rejected", "negotiating"],
    default: "draft"
  },
  sentDate: { type: Date },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

const Proposal = mongoose.model("Proposal", proposalSchema);
export default Proposal;
