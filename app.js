const express = require('express');
const app = express();
const path = require('path');
const methodOverride = require('method-override');
const mongoose = require('mongoose');
const ejsMate = require('ejs-mate');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const session = require('express-session');
require('dotenv').config();

const Candidate = require('./models/candidate');
const Recruiter = require('./models/manager');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Configure email transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
    }
});

// Middleware setup
app.engine('ejs', ejsMate);
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(session({
    secret: 'your-secret-key', // Change this to a strong secret
    resave: false,
    saveUninitialized: true
}));

// Mongoose connection
mongoose.connect('mongodb://localhost:27017/hire')
    .then(() => {
        console.log("MONGO CONNECTION OPEN!!!");
    })
    .catch(err => {
        console.log("OH NO MONGO CONNECTION ERROR!!!!");
        console.log(err);
    });

app.set("view engine", "ejs");
app.set('views', path.join(__dirname, 'pages'));
app.use(express.static('img'));

// Multer setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    },
});
const upload = multer({ storage: storage });

// Generate OTP
const generateOTP = () => {
    return crypto.randomInt(100000, 999999).toString(); // 6-digit OTP
};

// Send OTP email
const sendOTPEmail = async (email, otp) => {
    try {
        await transporter.sendMail({
            from: process.env.GMAIL_USER,
            to: email,
            subject: 'Your OTP Code',
            text: `Your OTP code is ${otp}`
        });
    } catch (error) {
        console.error('Error sending OTP email:', error);
    }
};

// Routes
app.get('/landing', (req, res) => {
    res.render("landing");
});

app.get('/image', async (req, res) => {
    try {
        const candidates = await Candidate.find({});
        res.render('home', { items: candidates });
    } catch (err) {
        console.log('Error fetching images:', err);
        res.status(500).send('Error fetching images');
    }
});

app.post('/upload-image', upload.single('image'), async (req, res) => {
    try {
        const obj = {
            name: req.body.name,
            desc: req.body.desc,
            img: {
                data: fs.readFileSync(path.join(uploadDir, req.file.filename)),
                contentType: req.file.mimetype
            }
        };

        const candidate = await Candidate.create(obj);
        fs.unlinkSync(req.file.path);
        res.redirect('/image');
    } catch (err) {
        console.log('Error uploading image:', err);
        res.status(500).send('Error uploading image');
    }
});

app.post('/upload-pdf', upload.single('pdf'), async (req, res) => {
    try {
        const pdfObject = {
            name: req.body.name,
            desc: req.body.desc,
            pdf: {
                data: fs.readFileSync(path.join(uploadDir, req.file.filename)),
                contentType: 'application/pdf'
            }
        };

        const candidate = await Candidate.create(pdfObject);
        fs.unlinkSync(req.file.path);
        res.redirect('/pdfs');
    } catch (err) {
        console.log('Error uploading PDF:', err);
        res.status(500).send('Error uploading PDF');
    }
});

app.get('/pdfs', async (req, res) => {
    try {
        const candidates = await Candidate.find({});
        res.render('pdfs', { items: candidates });
    } catch (err) {
        console.log('Error fetching PDFs:', err);
        res.status(500).send('Error fetching PDFs');
    }
});

app.get('/home', (req, res) => {
    res.render("home");
});

app.get('/auth', (req, res) => {
    res.render("auth");
});

app.get('/freelancerRegi', (req, res) => {
    res.render("freelancerRegi");
});

app.get('/clientRegi', (req, res) => {
    res.render("clientRegi");
});

app.post("/clientDetails",async(req,res)=>{
    const rec = new Recruiter(req.body.Manager);
    await rec.save();
    res.redirect(`clientDashboard/${rec._id}`)
})

app.post("/freelancerDetails",async(req,res)=>{
    const free = new Candidate(req.body.Candidate);
    await free.save();
    res.redirect(`freelancerDashboard/${free._id}`)
})



app.get('/aboutus', (req, res) => {
    res.render("aboutus");
});

app.get('/tos', (req, res) => {
    res.render("tos");
});

app.get('/policy', (req, res) => {
    res.render("policy");
});

app.get('/faq', (req, res) => {
    res.render("faq");
});

app.get('/team', (req, res) => {
    res.render("team");
});

app.get('/contact', (req, res) => {
    res.render("contact");
});

app.get('/', (req, res) => {
    res.render("landing");
});

app.get('/pdf', (req, res) => {
    res.render("pdf");
});

app.post('/upload-resume', upload.single('resume'), async (req, res) => {
    try {
        let text = '';
        if (path.extname(req.file.originalname) === '.pdf') {
            text = await extractTextFromPDF(req.file.path);
        } else {
            throw new Error('Unsupported file type');
        }

        const candidateData = extractCandidateData(text);
        const candidate = new Candidate(candidateData);
        await candidate.save();

        fs.unlinkSync(req.file.path);
        res.render('details', { candidate: candidateData });
    } catch (error) {
        console.error(error);
        res.render('details', { error: 'Error processing the resume. Please try again.' });
    }
});

app.get('/clientDashboard/:id', async(req, res) => {
    const { id } = req.params;
    const client = await Recruiter.findById(id);
    res.render("clientdash", {client});
});


app.post("/clientsignin", async (req, res) => {
    try {
        // Extract the email from the request body
        const { email } = req.body.Manager;

        // Find the client by email
        const existingClient = await Recruiter.findOne({ email });

        // Check if the client exists
        if (existingClient) {
            res.redirect(`/clientDashboard/${existingClient._id}`);
        } else {
            res.status(404).send("Client not found");
        }
    } catch (error) {
        console.error(error);
        res.status(500).send("An error occurred while processing the request.");
    }
});

app.post("/clientsignin", async (req, res) => {
    try {
        // Extract the email from the request body
        const { email } = req.body.Manager;

        // Find the client by email
        const existingClient = await Recruiter.findOne({ email });

        // Check if the client exists
        if (existingClient) {
            res.redirect(`/clientDashboard/${existingClient._id}`);
        } else {
            res.status(404).send("Client not found");
        }
    } catch (error) {
        console.error(error);
        res.status(500).send("An error occurred while processing the request.");
    }
});

app.get('/forum', (req, res) => {
    res.render("forum2");
});

app.get('/freelancerDashboard/:id', async(req, res) => {
    const {id} = req.params;
    const free = await Candidate.findById(id);
    res.render("freelancerdash", {free});
});

app.put('/freelancerDashboard/:id', async(req, res) => {
    const {id} = req.params;
    const free = await Candidate.findByIdAndUpdate(id,req.body.Candidate);
    res.redirect(`/freelancerDashboard/${free._id}`);
});


app.get('/request-otp', (req, res) => {
    res.render('landing');
});
// OTP Routes
app.post('/request-otp', async (req, res) => {
    const { email } = req.body;

    const otp = generateOTP();
    req.session.otp = otp;
    req.session.otpEmail = email;

    await sendOTPEmail(email, otp);

    res.send('OTP has been sent to your email.');
});

app.post('/verify-otp', (req, res) => {
    const { otp } = req.body;

    if (req.session.otp && req.session.otp === otp) {
        res.send('OTP verified successfully!');
    } else {
        res.status(400).send('Invalid OTP.');
    }
});

app.listen(3000, () => {
    console.log("Server Running on port 3000...");
});
