const mongoose = require('mongoose');
const Monitor = require('../models/Monitor');
const CheckResult = require('../models/CheckResult')
const { prepareHeaders, HeaderError } = require('../monitoring/credentials');

const handleMonitorError = (err) => {
  let errors = {
    name: "",
    url: "",
    method: "",
    interval: "",
    expectedStatusCode: "",
    headers: "",
  };

  if (err instanceof HeaderError) {
    errors.headers = err.message;
    return errors;
  }

  if (err.code === 11000) {
    errors.name = "A monitor with this information already exists";
    return errors;
  }

  if (err.message.includes("monitor validation failed")) {
    // CastErrors (e.g. interval: "soon") have no `properties`, so key by path and fall back to their message.
    Object.entries(err.errors).forEach(([path, error]) => {
      if (path in errors) {
        errors[path] = error.properties?.message ?? error.message;
      }
    });
  }

  return errors;
};

module.exports.createMonitor = async (req,res) => {
    const name = req.body.name;
    const url = req.body.url;
    const method = req.body.method;
    const interval = req.body.interval;
    const expectedStatusCode = req.body.expectedStatusCode;

    const userId = req.user._id;

    try{
        // The id is chosen up front because header values are encrypted for this monitor only.
        const _id = new mongoose.Types.ObjectId();
        const headers = req.body.headers === undefined ? [] : prepareHeaders(req.body.headers, { monitorId: _id });
        const monitor = await Monitor.create({_id , userId , name , url , method , interval , expectedStatusCode , headers});
        res.status(200).json({ monitor: monitor._id});
    }catch(err){
        const handelerror = handleMonitorError(err);
        res.status(400).json({ errors: handelerror });
    }
}

module.exports.getMonitors = async (req , res) =>{
    const id = req.user._id;

    const usermonitor = await Monitor.find({userId : id});

    res.status(200).json({ monitors: usermonitor });
}

module.exports.getMonitorById = async (req , res) =>{
    const Id = req.params.id;
    const id = req.user._id;

    try{
        const monitor = await Monitor.findOne({_id : Id , userId : id });

        if (!monitor) {
      return res.status(404).json({
        error: "Monitor not found",
      });
    }


        res.status(200).json({ monitors: monitor });
    }catch (err) {
    return res.status(400).json({
      error: "Invalid monitor ID",
    });
  }
}

module.exports.updateMonitor = async (req, res) => {
  const monitorId = req.params.id;
  const userId = req.user._id;

  const { name, url, method, interval, expectedStatusCode } = req.body;
  const update = { name, url, method, interval, expectedStatusCode };

  try {
    // Headers need the saved values (to keep unchanged ones) and the current URL.
    if (req.body.headers !== undefined || url !== undefined) {
      const current = await Monitor.findOne({ _id: monitorId, userId: userId }, "url headers").lean();
      if (!current) {
        return res.status(404).json({ error: "Monitor not found" });
      }

      const headers = req.body.headers === undefined
        ? current.headers.map(({ name }) => ({ name }))
        : req.body.headers;
      const prepared = prepareHeaders(headers, { monitorId: current._id, existing: current.headers });

      // A saved credential is only ever sent to the host it was entered for:
      // moving the monitor to another origin requires re-entering every value.
      if (url !== undefined && originOf(url) !== originOf(current.url)) {
        const kept = prepared.filter((h) => current.headers.some((c) => c.value === h.value));
        if (kept.length) {
          return res.status(400).json({
            errors: { headers: `Re-enter the ${kept.map((h) => h.name).join(", ")} header value${kept.length === 1 ? "" : "s"} when changing the URL's host.` },
          });
        }
      }
      if (req.body.headers !== undefined) update.headers = prepared;
    }

    const monitor = await Monitor.findOneAndUpdate(
      { _id: monitorId, userId: userId },
      update,
      { new: true, runValidators: true }
    );

    if (!monitor) {
      return res.status(404).json({ error: "Monitor not found" });
    }

    res.status(200).json({ monitor });
  } catch (err) {
    if (err instanceof HeaderError) {
      return res.status(400).json({ errors: { headers: err.message } });
    }
    res.status(400).json({ error: "Failed to update monitor" });
  }
};

// "https://api.example.com:443" style origin, or the raw string if it doesn't parse.
function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return String(url);
  }
}


module.exports.deleteMonitor = async (req,res) =>{
    const montId = req.params.id;
    const userId = req.user._id;

    try{
        const deletemonitor = await Monitor.deleteOne({_id : montId , userId: userId});

    if (deletemonitor.deletedCount === 0) {
      return res.status(404).json({
        error: "Monitor not found",
      });
    }

    res.status(200).json({ deletemonitor });
    }
    catch(err){
res.status(400).json({
      error: "Invalid monitor ID",
    });
    }
}

module.exports.getMonitorHistory = async (req,res) =>{
    const monitorId = req.params.id;

    const userId = req.user._id;

    try{
        const monitor = await Monitor.findOne({_id :monitorId , userId : userId });

        if(!monitor){
            return res.status(404).json({ error: "Monitor not found" });
        }

            const checkresult = await CheckResult.find({monitorId , userId}).sort({ checkedAt: -1 });
            res.status(200).json({ checkresult });
    }catch(err){
        if (err.name === "CastError") {
            return res.status(400).json({ error: "Invalid monitor ID" });
        }
res.status(500).json({
      error: "Failed to fetch monitor history",
    });
    }
}


