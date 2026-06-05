import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  profilePicture: {
    type: String,
    required: false,
  },
  gender: {
    type: String,
    required: false,
    enum: ["male", "female", "other"],
  },
}, { timestamps: true });

const User = mongoose.model("User", userSchema);

export default User;
