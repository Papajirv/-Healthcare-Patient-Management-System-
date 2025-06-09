const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema({
  patientId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  age: { type: Number, required: true },
  gender: { type: String, enum: ["Male", "Female", "Other"], required: true },
  contact: { type: String, required: true },
  allergies: { type: [String], default: [] },
  medicalHistory: { type: [String], default: [] },
  currentPrescriptions: { type: [String], default: [] },
  doctorNotes: { type: String, default: "" },
  department: { type: String, default: "General" },
  visits: [{
    date: { type: Date, default: Date.now },
    reason: { type: String, default: "" }
  }]
}, { timestamps: true });

module.exports = mongoose.models.Patient || mongoose.model("Patient", patientSchema);
