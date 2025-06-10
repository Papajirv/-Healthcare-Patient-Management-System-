const express = require('express');
const router = express.Router();
const Patient = require('../models/Patient');

// === INSERT NEW PATIENT ===
router.post('/', async (req, res) => {
  try {
    const newPatient = new Patient(req.body);
    await newPatient.save();
    res.status(201).json(newPatient);
  } catch (err) {
    console.error("Insert error:", err);
    res.status(400).json({ error: "Failed to add patient" });
  }
});

// === SEARCH + PAGINATION + SORT in one ===
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const sortBy = req.query.sortBy || "createdAt";
    const order = req.query.order === "asc" ? 1 : -1;
    const search = req.query.search || "";

    const skip = (page - 1) * limit;

    const searchRegex = new RegExp(search, "i");
    const searchQuery = search
      ? {
          $or: [
            { name: searchRegex },
            { patientId: searchRegex },
            { medicalHistory: searchRegex },
            { currentPrescriptions: searchRegex },
            { doctorNotes: searchRegex }
          ]
        }
      : {};

    const totalPatients = await Patient.countDocuments(searchQuery);
    const patients = await Patient.find(searchQuery)
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
    console.error("Search+Pagination error:", err);
    res.status(500).json({ error: "Failed to fetch patients" });
  }
});

// === DELETE PATIENT ===
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Patient.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Patient not found" });
    }
    res.json({ message: "Patient deleted successfully" });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ error: "Failed to delete patient" });
  }
});


router.get("/analytics/conditions", async (req, res) => {
  try {
    const result = await Patient.aggregate([
      {
        $group: {
          _id: "$medicalHistory",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
    res.json(result);
  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({ error: "Failed to generate analytics" });
  }
});

module.exports = router;
