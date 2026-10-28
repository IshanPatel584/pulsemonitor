
const Incident = require("../models/Incident");

module.exports.getIncidents = async (req, res) => {
  try {
    const incidents = await Incident.find({
      userId: req.user._id,
    })
      .populate("monitorId", "name url")
      .sort({ startedAt: -1 });

    res.status(200).json({ incidents });
  } catch (err) {
    console.error("Failed to fetch incidents:", err.message);
    res.status(500).json({ error: "Failed to fetch incidents" });
  }
};
