const mongoose = require('mongoose')

const incidentSchema = new mongoose.Schema({
    monitorId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "monitor",
        required : true
    },
    userId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "user",
        required : true
    },
    startedAt :{
        type : Date,
        required : true
    },
    resolvedAt : {
        type : Date,
        default : null,
    },
    status : {
        type : String,
        enum : ["open" , "resolved"],
        required : true,
    },
    reason : {
        type : String,
        required : true
    }

} , { timestamps: true })

const Incident = mongoose.model("incident", incidentSchema);

module.exports = Incident;