const express = require("express");
const router = express.Router();
const Patient = require("../models/Patient");

// === UTIL: Convert comma-separated values or arrays ===
const toArray = (val) => {
  if (!val) return [];
  return Array.isArray(val)
    ? val
    : val.split(",").map((s) => s.trim()).filter(Boolean);
};

// === SEARCH ===
router.get("/search", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: "Missing search query" });

    const regex = new RegExp(q, "i");
    const results = await Patient.find({
      $or: [
        { name: regex },
        { patientId: regex },
        { medicalHistory: regex },
        { currentPrescriptions: regex },
        { doctorNotes: regex }
      ]
    });

    res.json(results);
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Search failed" });
  }
});

// === PAGINATION + SORT ===
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const sortBy = req.query.sortBy || "createdAt";
    const order = req.query.order === "asc" ? 1 : -1;

    const skip = (page - 1) * limit;
    const totalPatients = await Patient.countDocuments();

    const patients = await Patient.find()
      .sort({ [sortBy]: order })
      .skip(skip)
      .limit(limit);

    res.json({
      data: patients,
      currentPage: page,
      totalPages: Math.ceil(totalPatients / limit),
      totalPatients
    });
  } catch (err) {
    console.error("Pagination error:", err);
    res.status(500).json({ error: "Failed to load patients" });
  }
});

// === CREATE PATIENT ===
router.post("/", async (req, res) => {
  try {
    const newPatient = new Patient({
      name: req.body.name,
      age: req.body.age,
      gender: req.body.gender,
      contact: req.body.contact,
      patientId: req.body.patientId,
      allergies: toArray(req.body.allergies),
      medicalHistory: toArray(req.body.medicalHistory),
      currentPrescriptions: toArray(req.body.currentPrescriptions),
      doctorNotes: req.body.doctorNotes,
      department: req.body.department,
      visits: req.body.visits || []
    });

    await newPatient.save();
    res.status(201).json(newPatient);
  } catch (error) {
    console.error("Add patient error:", error);
    res.status(500).json({ error: "Failed to add patient" });
  }
});

// === UPDATE PATIENT ===
router.patch("/:id", async (req, res) => {
  try {
    const updates = {};
    const mongoUpdate = {};

    // Direct updates
    const directFields = ["name", "age", "gender", "contact", "patientId", "doctorNotes", "department"];
    directFields.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    if (Object.keys(updates).length > 0) {
      mongoUpdate["$set"] = updates;
    }

    // Array add operations
    if (req.body.addPrescription) {
      mongoUpdate["$push"] = { ...(mongoUpdate["$push"] || {}), currentPrescriptions: req.body.addPrescription };
    }
    if (req.body.addDiagnosis) {
      mongoUpdate["$push"] = { ...(mongoUpdate["$push"] || {}), medicalHistory: req.body.addDiagnosis };
    }
    if (req.body.addLabReport) {
      mongoUpdate["$push"] = { ...(mongoUpdate["$push"] || {}), labReports: req.body.addLabReport };
    }

    // Array remove operations
    if (req.body.removePrescription) {
      mongoUpdate["$pull"] = { ...(mongoUpdate["$pull"] || {}), currentPrescriptions: req.body.removePrescription };
    }
    if (req.body.removeDiagnosis) {
      mongoUpdate["$pull"] = { ...(mongoUpdate["$pull"] || {}), medicalHistory: req.body.removeDiagnosis };
    }

    // Unique allergy add
    if (req.body.addUniqueAllergy) {
      mongoUpdate["$addToSet"] = { ...(mongoUpdate["$addToSet"] || {}), allergies: req.body.addUniqueAllergy };
    }

    if (Object.keys(mongoUpdate).length === 0) {
      return res.status(400).json({ error: "No valid update fields provided" });
    }

    const result = await Patient.findByIdAndUpdate(req.params.id, mongoUpdate, {
      new: true,
      runValidators: true
    });

    if (!result) return res.status(404).json({ error: "Patient not found" });

    res.status(200).json({ message: "Patient updated", data: result });
  } catch (err) {
    console.error("Update error:", err);
    res.status(500).json({ error: "Failed to update patient" });
  }
});

// === DELETE PATIENT ===
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Patient.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Patient not found" });

    res.status(200).json({ message: "Patient deleted" });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ error: "Failed to delete patient" });
  }
});

// === ANALYTICS ===

// Conditions frequency
router.get("/analytics/conditions", async (req, res) => {
  try {
    const data = await Patient.aggregate([
      { $unwind: "$medicalHistory" },
      { $group: { _id: "$medicalHistory", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch condition analytics" });
  }
});

// Prescriptions frequency
router.get("/analytics/prescriptions", async (req, res) => {
  try {
    const data = await Patient.aggregate([
      { $unwind: "$currentPrescriptions" },
      { $group: { _id: "$currentPrescriptions", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch prescription analytics" });
  }
});

// Average age per department
router.get("/analytics/avg-age-department", async (req, res) => {
  try {
    const data = await Patient.aggregate([
      {
        $group: {
          _id: "$department",
          averageAge: { $avg: "$age" }
        }
      }
    ]);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to calculate average age per department" });
  }
});

// Visits per month
router.get("/analytics/visits-per-month", async (req, res) => {
  try {
    const data = await Patient.aggregate([
      { $unwind: "$visits" },
      {
        $group: {
          _id: { $month: "$visits.date" },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    const monthNames = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const formatted = data.map((item) => ({
      month: monthNames[item._id],
      count: item.count
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: "Failed to calculate monthly visits" });
  }
});

module.exports = router;
