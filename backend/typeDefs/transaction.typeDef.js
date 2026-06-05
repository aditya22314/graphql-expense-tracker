const transactionTypeDef = `#graphql
type Transaction {
    _id: ID! 
    userId: ID! 
    description: String! 
    paymentType: String! 
    category: String! 
    amount: Float! 
    location: String 
    date: String! 
}
type Query {
    transactions: [Transaction!]
    transaction(transactionId: ID!): Transaction
}
type Mutation {
    addTransaction(input: CreateTransactionInput!): Transaction
    updateTransaction(transactionId: ID!, input: UpdateTransactionInput!): Transaction
    deleteTransaction(transactionId: ID!): Transaction!
}
input CreateTransactionInput {
    description: String!
    paymentType: String!
    category: String!
    amount: Float!
    location: String
    date: String!
}
input UpdateTransactionInput {
    description: String
    paymentType: String
    category: String
    amount: Float
    location: String
    date: String
}

`;

export default transactionTypeDef;
