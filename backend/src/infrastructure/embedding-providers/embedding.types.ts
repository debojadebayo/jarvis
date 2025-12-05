export interface EmbeddingAdapter {
    embed(text: string): Promise<number[]>;
}

