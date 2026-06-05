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
const app = express();
dotenv.config();
const httpServer = http.createServer(app);

const server = new ApolloServer({
  // Apollo Server instance
  typeDefs: mergedTypeDefs, // GraphQL schema
  resolvers: mergedResolvers, // GraphQL resolvers
  plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
});
await server.start();

app.use(
  "/",
  cors(),
  express.json(),
  expressMiddleware(server, {
    context: async ({ req }) => ({ req }),
  }),
);
// Modified server startup
await new Promise((resolve) => httpServer.listen({ port: 4000 }, resolve));

await connectDb();
console.log(`🚀 Server ready at http://localhost:4000/`);
