require("dotenv").config();

const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const { MongoClient } = require("mongodb");
const bcrypt = require("bcrypt");
const Joi = require("joi");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

const mongoURL =
    `mongodb+srv://${process.env.MONGODB_USER}:` +
    `${process.env.MONGODB_PASSWORD}@` +
    `${process.env.MONGODB_HOST}/` +
    `${process.env.MONGODB_DATABASE}`;

const client = new MongoClient(mongoURL);

let userCollection;

async function startServer() {
    await client.connect();

    const db = client.db(process.env.MONGODB_DATABASE);

    userCollection = db.collection("users");

    app.use(
        session({
            secret: process.env.NODE_SESSION_SECRET,

            store: MongoStore.create({
                mongoUrl: mongoURL,
                crypto: {
                    secret: process.env.MONGODB_SESSION_SECRET
                }
            }),

            saveUninitialized: false,
            resave: true,

            cookie: {
                maxAge: 1000 * 60 * 60
            }
        })
    );

    app.get("/", (req, res) => {
        if (req.session.authenticated) {
            res.send(`
            <h1>Hello ${req.session.name}</h1>

            <a href="/members">Members Area</a><br>
            <a href="/logout">Logout</a>
            `);
        } else {
            res.send(`
            <h1>Home Page</h1>

            <a href="/signup">Signup</a><br>
            <a href="/login">Login</a>
            `);
        }
    });

    app.get("/signup", (req, res) => {
        res.send(`
            <h1>Signup</h1>

            <form method="POST" action="/signupSubmit">

                <input
                    name="name"
                    placeholder="name"
                >
                <br><br>

                <input
                    name="email"
                    placeholder="Email"
                >

                <br><br>

                <input
                    name="password"
                    type="password"
                    placeholder="Password"
                >

                <br><br>

                <button>Signup</button>

            </form>
        `);
    });

    app.post("/signupSubmit", async (req, res) => {
        const schema = Joi.object({
            name: Joi.string().max(20).required(),
            email: Joi.string().email().required(),
            password: Joi.string().max(20).required()
        });

        const validationResult = schema.validate(req.body);

        if (validationResult.error != null) {
            res.send(`
                Invalid input.
                <br><br>

                <a href="/signup">Try again</a>
                `);

            return;
        }

        const name = req.body.name;
        const email = req.body.email;
        const password = req.body.password;

        const hashedPassword =
            await bcrypt.hash(password, 12);

        await userCollection.insertOne({
            name: name,
            email: email,
            password: hashedPassword
        });

        req.session.authenticated = true;
        req.session.name = name;

        res.redirect("/members");
    });

    app.get("/members", (req, res) => {
        if (!req.session.authenticated) {
            res.redirect("/");
            return;
        }

        const images = [
            "Steve.jpg",
            "Squidge.jpg",
            "Sparty.jpg"
        ];

        const randomImage =
            images[Math.floor(Math.random() * images.length)];

        res.send(`
            <h1>Members Area</h1>

            <h2>Hello ${req.session.name}</h2>

            <img
                src="/${randomImage}"
                width="400"
            >

            <br><br>

            <a href="/logout">Logout</a>
        `);
    });

    app.get("/logout", (req, res) => {
        req.session.destroy();

        res.redirect("/");
    });

    app.get("/login", (req, res) => {
        res.send(`
                <h1>Login</h1>

                <form method="POST" action="/loginSubmit">

                    <input
                        name="email"
                        placeholder="Email"
                    >
                    <br><br>

                    <input
                        type="password"
                        name="password"
                        placeholder="Password"
                    >
                    <br><br>

                    <button>Login</button>

                </form>
                `);
    });

    app.post("/loginSubmit", async (req, res) => {
        const schema = Joi.object({
            email: Joi.string().email().required(),
            password: Joi.string().max(20).required()
        });

        const validationResult =
            schema.validate(req.body);

        if (validationResult.error != null) {
            res.send(`
                    Invalid input.
                    <br><br>

                    <a href="/login">Try again</a>
                `);

            return;
        }

        const email = req.body.email;
        const password = req.body.password;

        const user =
            await userCollection.findOne({ email: email });

        if (!user) {
            res.send(`
                    User not found.
                    <br><br>

                    <a href="/login">Try again</a>
                `);

            return;
        }

        const validPassword =
            await bcrypt.compare(password, user.password);

        if (!validPassword) {
            res.send(`
                    Invalid password.
                    <br><br>

                    <a href="/login">Try again</a>
                `);

            return;
        }

        req.session.authenticated = true;
        req.session.name = user.name;

        res.redirect("/members");
    });

    app.use((req, res) => {
        res.status(404);

        res.send(`
            <h1>404 - Page Not Found</h1>
        `);
    });

    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

startServer();

