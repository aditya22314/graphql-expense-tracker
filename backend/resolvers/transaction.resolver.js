const transactionResolver = {
  Query: {
    transactions: () => transactions,
  },
  Mutation: {},
};

export default transactionResolver;
