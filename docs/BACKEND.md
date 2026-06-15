# Expense Tracker — Backend Documentation

A beginner-friendly guide to how this backend works. Written for someone learning GraphQL, Apollo, Express, MongoDB, and authentication for the first time.

---

## Table of contents

1. [What does this backend do?](#1-what-does-this-backend-do)
2. [The restaurant analogy](#2-the-restaurant-analogy)
3. [Project folder structure](#3-project-folder-structure)
4. [Part 1 — `backend/index.js` explained](#part-1--backendindexjs-explained)
   - [Every import and why it exists](#every-import-and-why-it-exists)
   - [Startup order step by step](#startup-order-step-by-step)
   - [Sessions and the `sessions` collection](#sessions-and-the-sessions-collection)
   - [Passport and login (planned flow)](#passport-and-login-planned-flow)
5. [Part 2 — How GraphQL works in this project](#part-2--how-graphql-works-in-this-project)
   - [GraphQL vs REST (simple comparison)](#graphql-vs-rest-simple-comparison)
   - [typeDefs — the menu / contract](#typedefs--the-menu--contract)
   - [resolvers — the kitchen / implementation](#resolvers--the-kitchen--implementation)
   - [Merging schemas and resolvers](#merging-schemas-and-resolvers)
   - [A full request from browser to database](#a-full-request-from-browser-to-database)
   - [Mongoose models vs GraphQL types](#mongoose-models-vs-graphql-types)
6. [Environment variables](#environment-variables)
7. [Current project status](#current-project-status)
8. [Glossary](#glossary)

---

## 1. What does this backend do?

This backend is a **server program** that runs on your computer (or a cloud machine) and listens on **port 4000**.

When your frontend app (React, etc.) needs data — like a list of users or expenses — it sends a request to this server. The server:

1. Checks if you are logged in (sessions + Passport)
2. Understands your request using **GraphQL**
3. Fetches or saves data (resolvers → MongoDB)
4. Sends back JSON the frontend can display

You start it with:

```bash
npm run dev
```

That runs `nodemon backend/index.js`, which auto-restarts when you change code.

---

## 2. The restaurant analogy

If the backend were a restaurant:

| Real piece | Restaurant role | What it does |
|------------|-----------------|--------------|
| **Express** | The building | Handles HTTP — doors, tables, receiving orders |
| **Apollo Server** | Order system | Reads GraphQL orders, checks they're valid |
| **typeDefs** | The menu | Lists what you *can* order and what you get back |
| **resolvers** | The kitchen | Actually makes the food (fetches/saves data) |
| **MongoDB** | Pantry + storage | Where users, expenses, and sessions are stored |
| **Mongoose** | Pantry manager | Speaks to MongoDB using JavaScript models |
| **express-session** | Coat check ticket | Remembers who you are between visits |
| **Passport** | Bouncer / ID check | Verifies username/password at login |
| **`sessions` collection** | Coat check drawer | Stores "this ticket = this logged-in person" |
| **dotenv / `.env`** | Locked safe | Holds secrets (DB password, session secret) |

A customer (browser) never talks to MongoDB directly. They only talk to Express → Apollo → resolvers → database.

---

## 3. Project folder structure

```
expense-tracker/
├── .env                          # Secrets (never commit to Git)
├── package.json                  # Dependencies and npm scripts
├── docs/
│   └── BACKEND.md                # This file
└── backend/
    ├── index.js                  # Main entry — starts everything
    ├── db/
    │   └── connectDb.js          # Connects to MongoDB via Mongoose
    ├── typeDefs/                 # GraphQL schema (the "menu")
    │   ├── user.typeDef.js       # User types, queries, mutations
    │   ├── transaction.typeDef.js
    │   └── index.js              # Merges all schemas into one
    ├── resolvers/                # GraphQL logic (the "kitchen")
    │   ├── user.resolver.js
    │   ├── transaction.resolver.js
    │   └── index.js              # Merges all resolvers into one
    ├── models/                   # MongoDB shape (Mongoose)
    │   ├── user.model.js
    │   └── transaction.model.js
    └── dummyData/
        └── data.js               # Fake data (temporary, for learning)
```

**Three layers to remember:**

| Layer | Folder | Purpose |
|-------|--------|---------|
| API contract | `typeDefs/` | What clients are *allowed* to ask for |
| API logic | `resolvers/` | How the server *answers* those requests |
| Database | `models/` + MongoDB | Where data is *stored* long-term |

---

# Part 1 — `backend/index.js` explained

`backend/index.js` is the **main file**. It wires together Express, GraphQL, sessions, Passport, and the database.

## Every import and why it exists

### `express` — the web server framework

```js
import express from "express";
const app = express();
```

**Layman:** Express is like a reception desk for HTTP. Every request from the internet hits Express first. Express can run small checks (middleware) before passing work along.

**Technical:** Express 5 provides routing, middleware pipeline, and JSON body parsing. Apollo mounts on top of it.

---

### `cors` — letting the frontend talk to the backend

```js
import cors from "cors";
// used as: app.use("/", cors(), ...)
```

**Layman:** Your React app might run on `http://localhost:5173` but the API is on `http://localhost:4000`. Browsers block "cross-origin" requests by default. CORS tells the browser: "It's OK, this frontend is allowed to call me."

**Technical:** Adds `Access-Control-Allow-Origin` headers on responses.

---

### `http` — the low-level server

```js
import http from "http";
const httpServer = http.createServer(app);
```

**Layman:** Express builds the app logic; `http.createServer` is the actual network listener that opens port 4000.

**Technical:** Apollo's `ApolloServerPluginDrainHttpServer` needs this reference to shut down cleanly.

---

### `dotenv` — loading secrets from `.env`

```js
import dotenv from "dotenv";
dotenv.config();
```

**Layman:** Passwords and connection strings should not be written in code (especially if you push to GitHub). `.env` is a local file with lines like `MONGO_URI=...`. `dotenv` loads them into `process.env.MONGO_URI`.

**Technical:** Runs at startup; variables become available as `process.env.VARIABLE_NAME`.

---

### `@apollo/server` — the GraphQL engine

```js
import { ApolloServer } from "@apollo/server";

const server = new ApolloServer({
  typeDefs: mergedTypeDefs,
  resolvers: mergedResolvers,
  plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
});
await server.start();
```

**Layman:** Apollo is the brain that understands GraphQL. You give it the menu (`typeDefs`) and the kitchen staff (`resolvers`). When a query arrives, Apollo checks it's valid and runs the right resolver.

**Technical:** Parses GraphQL documents, validates against schema, executes resolver tree, formats errors, returns JSON `{ data, errors }`.

---

### `@as-integrations/express5` — connecting Apollo to Express

```js
import { expressMiddleware } from "@as-integrations/express5";

app.use("/", cors(), express.json(), expressMiddleware(server, {
  context: async ({ req, res }) => buildContext({ req, res }),
}));
```

**Layman:** This plugin says "when someone POSTs to `/`, treat the body as a GraphQL query and hand it to Apollo."

**Technical:** Mounts GraphQL HTTP handler. `express.json()` parses JSON body. `context` function runs per request and passes shared data into every resolver.

---

### `mergedTypeDefs` and `mergedResolvers` — your app's API

```js
import mergedTypeDefs from "./typeDefs/index.js";
import mergedResolvers from "./resolvers/index.js";
```

**Layman:** These are imported from other files where user and transaction logic are defined separately, then combined.

**Technical:** `mergeTypeDefs` and `mergeResolvers` from `@graphql-tools/merge` produce a single schema + resolver map Apollo can use.

---

### `connectDb` — MongoDB connection

```js
import connectDb from "./db/connectDb.js";
await connectDb();  // mongoose.connect(process.env.MONGO_URI)
```

**Layman:** Opens a persistent connection to your MongoDB database (local or Atlas cloud).

**Technical:** Uses Mongoose. On failure, logs error and `process.exit(1)`.

> **Note:** Currently `connectDb()` runs *after* the server starts listening. For production, connecting before accepting traffic is often safer.

---

### `express-session` — remembering logged-in users

```js
import expressSession from "express-session";

app.use(expressSession({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: store,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7,  // 7 days in milliseconds
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  },
}));
```

**Layman:** When you log in, the server doesn't want to ask for your password on every click. Instead it gives your browser a small **cookie** (like a wristband at a concert). On every later request, the browser sends that cookie back, and the server knows "oh, this is Aditya."

| Setting | Plain English |
|---------|---------------|
| `secret` | A password used to sign cookies so hackers can't fake them |
| `resave: false` | Don't waste work re-saving unchanged sessions |
| `saveUninitialized: false` | Don't create a session until someone actually logs in |
| `maxAge: 7 days` | Wristband expires after a week |
| `httpOnly: true` | JavaScript on the webpage can't steal the cookie |
| `secure: true` (production) | Cookie only sent over HTTPS, not plain HTTP |

---

### `connect-mongodb-session` — where sessions are saved

```js
import ConnectMongoDBSession from "connect-mongodb-session";

const MongoDbStore = ConnectMongoDBSession(expressSession);
const store = new MongoDbStore({
  uri: process.env.MONGO_URI,
  collection: "sessions",
});
```

**Layman:** Sessions could live in the server's memory, but then they're lost when you restart the server. This store saves them in MongoDB in a collection called **`sessions`**.

**What's in `sessions`?** Documents like:
- Session ID (matches the cookie)
- Who is logged in (user id)
- When it expires

**How is it accessed?** You don't write code to query `sessions` yourself. `express-session` reads and writes automatically on every request. You *can* view the collection in MongoDB Atlas for debugging.

---

### `passport` — authentication helper

```js
import passport from "passport";

app.use(passport.initialize());
app.use(passport.session());
```

**Layman:** Passport is a popular library that handles "prove you are who you say you are." It doesn't store users itself — you plug in a **strategy** (usually "local" = username + password). After successful login, Passport attaches the user to `req.user`.

**Technical:** `initialize()` adds Passport to the request pipeline. `session()` restores `req.user` from the session on each request.

---

### `graphql-passport` — GraphQL + Passport bridge

```js
import { buildContext } from "graphql-passport";

context: async ({ req, res }) => buildContext({ req, res }),
```

**Layman:** Resolvers need access to the HTTP request (for cookies/session). `buildContext` packages `req`, `res`, and helpers like `login()`, `logout()`, and `getUser()` so your GraphQL mutations can log people in/out.

**Why it matters:** Your schema has `login`, `logout`, and `authUser`. Those will use this context once resolvers are fully implemented.

---

## Startup order step by step

When you run `npm run dev`, this is what happens in order:

```
1. dotenv.config()           → Load MONGO_URI, SESSION_SECRET from .env
2. Create Express app
3. Create HTTP server
4. Create MongoDB session store
5. app.use(expressSession)   → Enable sessions (before GraphQL!)
6. app.use(passport...)      → Enable auth (before GraphQL!)
7. new ApolloServer(...)     → Create GraphQL server
8. await server.start()      → Prepare Apollo
9. app.use(expressMiddleware)→ Mount GraphQL at /
10. listen on port 4000       → Server is live
11. await connectDb()        → Connect to MongoDB
```

**Why session/Passport come before Apollo:** Every GraphQL request must already have `req.session` and `req.user` loaded before resolvers run.

---

## Sessions and the `sessions` collection

### Login flow (once fully wired)

```
User sends login mutation with username + password
        ↓
Passport checks password (bcrypt compare)
        ↓
If correct → save user id in session
        ↓
express-session writes session to MongoDB "sessions" collection
        ↓
Browser receives Set-Cookie header (session id only, not password)
        ↓
Next request → browser sends cookie automatically
        ↓
Server loads session from MongoDB → req.user is set
        ↓
authUser query returns the logged-in user
```

### Logout flow

```
logout mutation → destroy session → remove from MongoDB → clear cookie
```

---

## Passport and login (planned flow)

Your `package.json` includes `bcryptjs` for hashing passwords. The intended flow:

| Step | What happens |
|------|--------------|
| **signUp** | Hash password → save User to MongoDB |
| **login** | Check password → Passport creates session |
| **authUser** | Return `req.user` if session exists |
| **logout** | Destroy session |
| **addTransaction** | Use logged-in user's id as `userId` |

Passport strategy configuration is the next piece to add (not yet in the repo at time of writing).

---

# Part 2 — How GraphQL works in this project

## GraphQL vs REST (simple comparison)

### REST style (many endpoints)

```
GET  /users          → list users
GET  /users/123      → one user
POST /transactions   → create expense
```

Each URL is different. The server often returns a fixed shape.

### GraphQL style (one endpoint)

```
POST /               → everything goes here
```

The **body** says what you want:

```graphql
query {
  users { name username }
  transactions { amount description }
}
```

You get back **only the fields you asked for** in one round trip.

| | REST | GraphQL |
|--|------|---------|
| Endpoints | Many URLs | Usually one (`/`) |
| Response shape | Server decides | Client picks fields |
| Over-fetching | Common | Rare |
| Learning curve | Lower | Higher |

---

## typeDefs — the menu / contract

**Location:** `backend/typeDefs/`

**What it is:** A text description of your API written in **GraphQL SDL** (Schema Definition Language). Stored inside JavaScript template strings:

```js
const userTypeDef = `#graphql
type User {
  _id: ID!
  name: String!
}
`;
export default userTypeDef;
```

**Why backticks?** GraphQL syntax like `type User {` is not valid JavaScript. Wrapping it in a string lets Node load the file; Apollo parses the string as GraphQL.

### Building blocks in your project

#### Object types — "what does data look like?"

**`User`** — a person using the app:

| Field | Type | Required? | Meaning |
|-------|------|-----------|---------|
| `_id` | `ID!` | Yes | Unique identifier |
| `username` | `String!` | Yes | Login name |
| `name` | `String!` | Yes | Display name |
| `password` | `String!` | Yes | Stored hashed in DB (not plain text in production responses) |
| `profilePicture` | `String` | No | Optional image URL |
| `gender` | `String` | No | Optional |

**`Transaction`** — one expense/income record:

| Field | Type | Required? | Meaning |
|-------|------|-----------|---------|
| `_id` | `ID!` | Yes | Transaction id |
| `userId` | `ID!` | Yes | Who owns this expense |
| `description` | `String!` | Yes | What it was for |
| `paymentType` | `String!` | Yes | CASH, CARD, OTHER |
| `category` | `String!` | Yes | saving, expense, investment, other |
| `amount` | `Float!` | Yes | Money amount |
| `location` | `String` | No | Optional place |
| `date` | `String!` | Yes | When it happened |

#### The `!` symbol

- `String!` = "this field must always have a value; never null"
- `String` = "this field can be missing or null"
- `[User!]` = "a list where each item is a User (items can't be null)"
- `[User!]!` = "a list that itself is never null (can be empty `[]`)"

#### `Query` — read operations (built-in root type)

GraphQL has special root types. **`Query`** is for reading data.

**From users:**

| Field | Arguments | Returns | Plain English |
|-------|-----------|---------|---------------|
| `users` | none | `[User!]` | Get all users |
| `authUser` | none | `User` | Who am I? (logged-in user) |
| `user` | `userId: ID!` | `User` | Get one user by id |

**From transactions:**

| Field | Arguments | Returns | Plain English |
|-------|-----------|---------|---------------|
| `transactions` | none | `[Transaction!]` | Get all transactions |
| `transaction` | `transactionId: ID!` | `Transaction` | Get one by id |

**Example — client asks for users:**

```graphql
query GetUsers {
  users {
    _id
    name
    username
  }
}
```

The server responds with JSON. Password is **not** included because the client didn't ask for it.

#### `Mutation` — write operations (built-in root type)

**`Mutation`** is for changing data (create, update, delete).

| Mutation | What it does |
|----------|--------------|
| `signUp` | Create new account |
| `login` | Start a session |
| `logout` | End session |
| `addTransaction` | Create expense |
| `updateTransaction` | Edit expense |
| `deleteTransaction` | Remove expense |

**Example — add an expense:**

```graphql
mutation AddCoffee {
  addTransaction(input: {
    description: "Morning coffee"
    paymentType: "CARD"
    category: "expense"
    amount: 5.50
    date: "2026-06-03"
  }) {
    _id
    amount
    description
  }
}
```

#### `input` types — the form the client fills in

Separate from `type` because **what you send** and **what you get back** are often different.

**`CreateTransactionInput`** — all required fields for a new expense (except optional `location`):

```graphql
input CreateTransactionInput {
  description: String!
  paymentType: String!
  category: String!
  amount: Float!
  location: String
  date: String!
}
```

Notice: no `_id` (server generates it) and no `userId` (server sets it from logged-in user).

**`UpdateTransactionInput`** — all fields optional (send only what changed):

```graphql
input UpdateTransactionInput {
  description: String
  amount: Float
  ...
}
```

**`SignUpInput` / `LoginInput`** — credentials for auth mutations.

---

## resolvers — the kitchen / implementation

**Location:** `backend/resolvers/`

**What it is:** Plain JavaScript functions that **actually fetch or save data** when a GraphQL field is requested.

**Layman:** The menu says "Burger — $10 exists." The resolver is the cook who makes the burger.

### Resolver object shape

```js
const userResolver = {
  Query: {
    users: () => { /* return array of users */ },
    user: (parent, args, context, info) => { /* return one user */ },
  },
  Mutation: {
    login: (parent, args, context) => { /* ... */ },
  },
};
```

### The four arguments (technical)

Every resolver function receives:

```js
(parent, args, context, info) => { ... }
```

| Argument | Layman | Example in this project |
|----------|--------|-------------------------|
| `parent` | Result from the level above | Unused for root `Query` fields |
| `args` | Inputs from the GraphQL query | `{ userId: "abc" }` for `user(userId: ...)` |
| `context` | Shared toolbox for this request | `{ req, res }`, login helpers from `buildContext` |
| `info` | Metadata about the query | Advanced use; ignore when learning |

### Current resolvers in the project

**`user.resolver.js`** — partially done:

```js
Query: {
  users: () => users,  // returns dummy data from dummyData/data.js
  user: (_, { userId }) => users.find((user) => user._id === userId),
},
Mutation: {},  // signUp, login, logout not implemented yet
```

**`transaction.resolver.js`** — stub:

```js
Query: {
  transactions: () => transactions,  // needs to be wired to MongoDB
},
Mutation: {},  // add/update/delete not implemented yet
```

### How a resolver maps to a typeDef

| typeDef says | Resolver must provide |
|--------------|----------------------|
| `Query.users` | `Query: { users: () => ... }` |
| `Query.user(userId: ID!)` | `Query: { user: (_, { userId }) => ... }` |
| `Mutation.login(...)` | `Mutation: { login: (_, { input }, context) => ... }` |

If the schema defines a field but no resolver exists, Apollo may return `null` or error depending on the field.

---

## Merging schemas and resolvers

You split the API into **user** and **transaction** files for organization. But Apollo needs **one** combined schema.

### typeDefs merge (`typeDefs/index.js`)

```js
import { mergeTypeDefs } from "@graphql-tools/merge";
import userTypeDef from "./user.typeDef.js";
import transactionTypeDef from "./transaction.typeDef.js";

const mergedTypeDefs = mergeTypeDefs([userTypeDef, transactionTypeDef]);
```

**Layman:** Both files define their own `type Query` and `type Mutation`. Merging combines them so the final API has `users`, `transactions`, `login`, `addTransaction`, etc. in one place.

### resolvers merge (`resolvers/index.js`)

```js
import { mergeResolvers } from "@graphql-tools/merge";
import userResolver from "./user.resolver.js";
import transactionResolver from "./transaction.resolver.js";

const mergedResolvers = mergeResolvers([userResolver, transactionResolver]);
```

**Layman:** User resolvers handle user fields; transaction resolvers handle transaction fields. Merge puts them in one object Apollo understands.

---

## A full request from browser to database

### Example: "Get all users"

**1. Frontend sends HTTP request:**

```http
POST http://localhost:4000/
Content-Type: application/json

{
  "query": "query { users { _id name username } }"
}
```

**2. Express receives it** → session middleware loads cookie → Passport sets `req.user` if logged in.

**3. Apollo receives the GraphQL query** → validates against `mergedTypeDefs` → finds field `Query.users`.

**4. Apollo calls the resolver:**

```js
userResolver.Query.users()
```

**5. Resolver returns data** (currently from `dummyData/data.js`; later from `User.find()`).

**6. Apollo shapes JSON** with only requested fields:

```json
{
  "data": {
    "users": [
      { "_id": "1", "name": "John", "username": "john" }
    ]
  }
}
```

**7. Browser displays the list.**

### Visual flow

```
┌──────────┐     POST /      ┌─────────┐    validate    ┌──────────┐
│ Frontend │ ──────────────► │ Express │ ─────────────► │  Apollo  │
└──────────┘                 └─────────┘                └──────────┘
                                   │                           │
                            session + passport                  │
                                   │                           ▼
                                   │                    ┌──────────┐
                                   │                    │ resolver │
                                   │                    └──────────┘
                                   │                           │
                                   │                           ▼
                                   │                    ┌──────────┐
                                   │                    │ MongoDB  │
                                   │                    └──────────┘
                                   │                           │
                                   ◄───────────────────────────┘
                                         JSON response
```

---

## Mongoose models vs GraphQL types

These are **two different layers**. Beginners often confuse them.

| | GraphQL (`typeDefs`) | Mongoose (`models/`) |
|--|---------------------|----------------------|
| **Who sees it?** | Frontend / API clients | Only your server |
| **Purpose** | API contract | Database rules |
| **File** | `typeDefs/user.typeDef.js` | `models/user.model.js` |
| **Example** | `amount: Float!` | `amount: { type: Number, required: true }` |

### User model (database)

```js
// models/user.model.js
username: { type: String, required: true, unique: true }
password: { type: String, required: true }  // store bcrypt hash, not plain text
```

### Transaction model (database)

```js
// models/transaction.model.js
userId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",       // links to User collection
  required: true,
}
```

**`ref: "User"`** means: `userId` stores a User's MongoDB id. Mongoose can `.populate("userId")` to fetch the full user document when needed. GraphQL's `userId: ID!` just exposes that id to clients.

### How they connect (in resolvers, when fully built)

```js
// Future resolver example (conceptual)
addTransaction: async (_, { input }, context) => {
  const user = context.getUser();  // from graphql-passport
  return Transaction.create({
    ...input,
    userId: user._id,
  });
}
```

The resolver **translates** between GraphQL world and MongoDB world.

---

## Environment variables

Create a `.env` file in the project root (already in `.gitignore`):

```env
MONGO_URI=mongodb+srv://...your-connection-string...
SESSION_SECRET=some-long-random-string-at-least-32-chars
NODE_ENV=development
```

| Variable | Required | Purpose |
|----------|----------|---------|
| `MONGO_URI` | Yes | MongoDB connection (used by Mongoose + session store) |
| `SESSION_SECRET` | Yes | Signs session cookies |
| `NODE_ENV` | Optional | `production` enables secure cookies |

> **Important:** Use the same variable name everywhere. `MONGO_URI` in `.env` must match `process.env.MONGO_URI` in code.

---

## Current project status

| Feature | Schema (typeDefs) | Resolver | Database model |
|---------|-------------------|----------|----------------|
| List users | ✅ | ✅ (dummy data) | ✅ User model |
| Get user by id | ✅ | ✅ (dummy data) | ✅ |
| authUser | ✅ | ❌ | ✅ |
| signUp / login / logout | ✅ | ❌ | ✅ |
| List transactions | ✅ | ❌ (stub) | ✅ Transaction model |
| add / update / delete transaction | ✅ | ❌ | ✅ |
| Sessions in MongoDB | ✅ wired in index.js | — | `sessions` collection |
| Passport strategy | ❌ not configured yet | — | — |

---

## Glossary

| Term | Simple definition |
|------|-----------------|
| **API** | How frontend talks to backend |
| **GraphQL** | Query language; one endpoint, client picks fields |
| **Apollo Server** | Node library that runs GraphQL |
| **typeDefs** | Schema strings describing allowed operations |
| **resolvers** | Functions that return data for each field |
| **Query** | Read operation |
| **Mutation** | Write operation |
| **input** | Object type for mutation arguments |
| **context** | Per-request data passed to all resolvers |
| **Express** | Web framework for HTTP |
| **middleware** | Functions that run on every request (session, auth, GraphQL) |
| **MongoDB** | NoSQL database |
| **Mongoose** | Library to define models and query MongoDB |
| **collection** | MongoDB table-like bucket (`users`, `transactions`, `sessions`) |
| **Session** | Server-side memory of "who is logged in" |
| **Cookie** | Small id browser sends back to identify the session |
| **Passport** | Authentication middleware |
| **bcrypt** | Password hashing (one-way scramble) |
| **CORS** | Permission for frontend on another port to call API |
| **dotenv** | Loads `.env` secrets into `process.env` |
| **SDL** | Schema Definition Language (the `type User { ... }` syntax) |
| **mergeTypeDefs** | Combines multiple schema files into one |
| **mergeResolvers** | Combines multiple resolver files into one |

---

## Quick reference — files to edit for common tasks

| I want to... | Edit this file |
|--------------|----------------|
| Add a new API field clients can request | `typeDefs/*.typeDef.js` |
| Add logic to fetch/save that data | `resolvers/*.resolver.js` |
| Change database storage rules | `models/*.model.js` |
| Change server startup / auth setup | `backend/index.js` |
| Add a secret | `.env` |

---

*Last updated to match the codebase structure of the expense-tracker backend.*
