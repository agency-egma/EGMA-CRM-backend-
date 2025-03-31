import mongoose from 'mongoose';
const { Schema } = mongoose;

const projectSchema = new Schema({
  name: { type: String, required: true }, // Project ka naam
  client: {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
  },
  // Proposal tracking
  proposal: {
    id: { type: Schema.Types.ObjectId, ref: "Proposal" }, // Proposal reference
    status: {
      type: String,
      enum: ["not_sent", "sent", "accepted", "rejected", "needs_revision"],
      default: "not_sent",
    },
    sentDate: { type: Date },
  },
  invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice" }, // Invoice reference
  status: {
    type: String,
    enum: ["pending", "in-progress", "completed", "on-hold", "cancelled"],
    default: "pending",
  },
  startDate: { type: Date, required: true }, // Start date
  endDate: { type: Date }, // Expected end date
  totalBudget: { type: Number, required: true }, // Total budget
  amountReceived: { type: Number, default: 0 }, // Kitna paisa mil chuka
  description: { type: String }, // Project details
  priority: { type: String, enum: ["low", "medium", "high"], default: "medium" }, // Priority
  createdAt: { type: Date, default: Date.now }, // Project creation time
  updatedAt: { type: Date, default: Date.now }, // Last updated
});

// Auto-calculate amountPending before saving
projectSchema.virtual("amountPending").get(function () {
  return this.totalBudget - this.amountReceived;
});

const Project = mongoose.model("Project", projectSchema);
export default Project;
