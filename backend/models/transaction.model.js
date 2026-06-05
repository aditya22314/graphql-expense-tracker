import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    paymentType: {
        type: String,
        required: true,
        enum: ["CASH", "CARD", "OTHER"],
    },
    category: {
        type: String,
        required: true,
        enum:["saving","expense","investment","other"],
    },
    amount: {
        type: Number,
        required: true,
    },
    location: {
        type: String,
        required: false,
    },
    date: {
        type: Date,
        required: true,
    },
}, { timestamps: true });

const Transaction = mongoose.model("Transaction", transactionSchema);

export default Transaction;