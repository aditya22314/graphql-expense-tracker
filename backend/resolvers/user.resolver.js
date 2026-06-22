import { users } from "../dummyData/data.js";
import User from "../models/user.model.js";
import Transaction from "../models/transaction.model.js";
const userResolver = {
  Query: {
    users: () => {
      return users;
    },
    user: async (_, { userId }, context) => {
      try {
        const user = await User.findById(userId);
        return user;
      } catch (error) {
        console.error("Error getting user:", error);
        throw new Error(error.message);
      }
    },
    authUser: async (_, {}, context) => {
      try {
        const user = await context.getUser();
        return user;
      } catch (error) {
        console.error("Error getting authenticated user:", error);
        throw new Error(error.message);
      }
    },
  },
  Mutation: {
    signUp: async (_, { input }, context) => {
      try {
        const { username, name, password, gender } = input;
        const existingUser = await User.findOne({ username });
        if (existingUser) {
          throw new Error("Username already exists");
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const boyProfilePicture = `https://avatar.iran.liara.run/public/boy?username=${username}`;
        const girlProfilePicture = `https://avatar.iran.liara.run/public/girl?username=${username}`;
        const newUser = new User({
          username,
          name,
          password: hashedPassword,
          gender,
          profilePicture:
            gender === "male" ? boyProfilePicture : girlProfilePicture,
        });
        await newUser.save();
        await context.login(newUser); // login the user after signing up from passport.js
        return newUser;
      } catch (error) {
        console.error("Error signing up:", error);
        throw new Error(error.message);
      }
    },
    login: async (_, { input }, context) => {
      try {
        const { username, password } = input;
        const user = await context.authenticate("graphql-local", {
          username,
          password,
        });
        await context.login(user); // login the user after login from passport.js
        return user;
      } catch (error) {
        console.error("Error logging in:", error);
        throw new Error(error.message);
      }
    },
    logout: async (_, {}, context) => {
      try {
        await context.logout();
        req.session.destroy();
        res.clearCookie("connect.sid");
        return { message: "Logged out successfully" };
      } catch (error) {
        console.error("Error logging out:", error);
        throw new Error(error.message);
      }
    },
  },
};

export default userResolver;
