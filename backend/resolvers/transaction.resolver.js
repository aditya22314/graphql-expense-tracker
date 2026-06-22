import Transaction from "../models/transaction.model.js";
const transactionResolver = {
  Query: {
    transactions: async (_, {}, context) => {
      try {
        const userId = await context.getUser()._id;
        const transactions = await Transaction.find({ userId });
        return transactions;
      } catch (error) {
        console.error("Error getting transactions:", error);
        throw new Error(error.message);
      }
    },
    transaction: async (_, { transactionId }, context) => {
      try {
        const transaction = await Transaction.findById(transactionId);
        return transaction;
      } catch (error) {
        console.error("Error getting transaction:", error);
        throw new Error(error.message);
      }
    },
  },
  Mutation: {
    createTransaction: async (_, { input }, context) => {
      try {
        const transaction = new Transaction({
          ...input,
          userId: context.getUser()._id,
        });
        await transaction.save();

        return transaction;
      } catch (error) {
        console.error("Error creating transaction:", error);
        throw new Error(error.message);
      }
    },
    updateTransaction: async (_, { input }, context) => {
      try {
        const transaction = await Transaction.findByIdAndUpdate(
          input.transactionId,
          { $set: input },
          { new: true }, // gives object after update
        );
        return transaction;
      } catch (error) {
        console.error("Error updating transaction:", error);
        throw new Error(error.message);
      }
    },
    deleteTransaction: async (_, { transactionId }, context) => {
      try {
        const transaction = await Transaction.findByIdAndDelete(transactionId);
        return transaction;
      } catch (error) {
        console.error("Error deleting transaction:", error);
        throw new Error(error.message);
      }
    },
    //TODO: Add relationships with user and category
  },
};

export default transactionResolver;
