import { VoyageAIClient } from "voyageai";
import { EmbeddingAdapter } from "./embedding.types";

export class VoyageAdapter implements EmbeddingAdapter {
    private voyageClient: VoyageAIClient

    private embeddingModel: string

    constructor(apiKey: string) {
        this.voyageClient = new VoyageAIClient({
            apiKey: apiKey
        });
        this.embeddingModel = "voyage-3-large";
    }

    async embed(text:string): Promise<number[]> {
        const response = await this.voyageClient.embed({
            input: [text],
            model: this.embeddingModel
        });

        if(!response.data || !response.data[0]?.embedding){ 
            throw new Error("Failed to generate embeddings");
        }

        return response.data[0].embedding;
    }
}