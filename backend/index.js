import express from "express";
import cors from "cors";
import http from "http";
import dotenv from "dotenv";

import { ApolloServer } from "@apollo/server"; // Apollo Server library which helps to create a GraphQL server

import mergedTypeDefs from "./typeDefs/index.js";

import mergedResolvers from "./resolvers/index.js";

import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { expressMiddleware } from "@as-integrations/express5";
import connectDb from "./db/connectDb.js";
import ConnectMongoDBSession from "connect-mongodb-session";
import expressSession from "express-session";
import passport from "passport";
import { buildContext } from "graphql-passport";
import { configurePassport } from "./passport/passport.config.js";
const app = express();
dotenv.config();

configurePassport();
const httpServer = http.createServer(app);

const MongoDbStore = ConnectMongoDBSession(expressSession);

const store = new MongoDbStore({
  uri: process.env.MONGO_URI,
  collection: "sessions",
});

store.on("error", (error) => {
  console.error("Session store error:", error);
});

app.use(
  expressSession({
    secret: process.env.SESSION_SECRET,
    resave: false, // don't save session if unmodified
    saveUninitialized: false, // don't save uninitialized session
    store: store,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      httpOnly: true, // prevent client-side JavaScript from accessing the cookie
      secure: process.env.NODE_ENV === "production", // only send cookie over HTTPS in production
    },
  }),
);
app.use(passport.initialize());
app.use(passport.session());
const server = new ApolloServer({
  typeDefs: mergedTypeDefs,
  resolvers: mergedResolvers,
  plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
});
await server.start();

app.use(
  "/",
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  }),
  express.json(),
  expressMiddleware(server, {
    context: async ({ req, res }) => buildContext({ req, res }),
  }),
);
await new Promise((resolve) => httpServer.listen({ port: 4000 }, resolve));
await connectDb();
