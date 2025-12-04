import { pgTable, uuid, varchar, timestamp, text, integer, index, unique, vector } from "drizzle-orm/pg-core";

export const conversations = pgTable("conversations", {
    id: uuid('id').primaryKey().defaultRandom(),
    claudeConversationId: varchar("claude_conversation_id", { length: 255 }).unique().notNull(),
    title: varchar("title", { length: 255 }).notNull().default("Untitled Conversation"),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    messageCount: integer("message_count").notNull().default(0),
},
(table) => ({
    createdAtIdx: index("conversations_created_at_idx").on(table.created_at),
    claudeIdIdx: index("idx_conversations_claude_id").on(table.claudeConversationId),
}));

export const messages = pgTable("messages", {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
        .notNull()
        .references(() => conversations.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 50 }).notNull(),
    content: text("content").notNull(),
    timestamp: timestamp("timestamp").notNull(),
    sequence_number: integer("sequence_number").notNull(),
}, table => ({
    conversationIdIdx: index("messages_conversation_id_idx").on(table.conversationId),
    sequenceIdx: index("idx_messages_sequence").on(table.conversationId, table.sequence_number),
    uniqueSequence: unique().on(table.conversationId, table.sequence_number),
}))


export const conversationEmbeddings = pgTable("conversations_embeddings", {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
        .notNull()
        .unique()
        .references(() => conversations.id, { onDelete: "cascade" }),
    embedding: vector("embedding", { dimensions: 1024 }).notNull(),
    timestamp: timestamp("timestamp").notNull().defaultNow(),
}, table => ({
    conversationIdIdx: index("conversation_embeddings_idx").on(table.conversationId),
    embeddingIdx: index("embedding_idx").using("hnsw", table.embedding.op('vector_cosine_ops'))
}));

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type ConversationEmbedding = typeof conversationEmbeddings.$inferSelect;
export type NewConversationEmbedding = typeof conversationEmbeddings.$inferInsert;
