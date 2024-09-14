const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Review = require("./reviews");
const Candidate = require("./candidate");

const recruitSchema = new Schema({
    islogin: { type: Boolean, default: false }, 
    FirstName: String,
    LastName: String,
    username: String,
    dob: { 
        date: Number,
        month: Number,
        years: Number
     },
    notes: String,
    email: String,
    location: {
        address: String,
        city: String,
        state: String,
        pincode: Number
    },
    img:
    {
        data: Buffer,
        contentType: String
    },
    resume: {
        data: Buffer,        // To store the binary data of the PDF
        contentType: String  // To store the MIME type (e.g., 'application/pdf')
    },
    password: String,
    url: String ,
    phone: Number ,
    skills: [String],
    workexp: {
        projects: {
            title: String,
            description: String,
            tech: [String]
        },
        years: Number
    },
    status: { type: String, enum: ['Applied', 'Interviewed', 'Offered', 'Rejected'], default: 'Applied' },
    earnings: Number,
    company: String,
    aboutme: String
})

recruitSchema.post('findOneAndDelete',async function(doc){
    if(doc){
        await Review.deleteMany({
            _id:{
                $in : doc.reviews
            }
        })
    }
})

recruitSchema.post('findOneAndDelete',async function(doc){
    if(doc){
        await Candidate.deleteMany({
            _id:{
                $in : doc.applied
            }
        })
    }
})

module.exports = mongoose.model('Recruit', recruitSchema);
