

export class EmbeddingQueue {
    private queue: string[] = [];
    private isProcessing: boolean = false;

    private static instance: EmbeddingQueue;

    private constructor() {}

    static getInstance(): EmbeddingQueue {
        if(!EmbeddingQueue.instance){
            EmbeddingQueue.instance = new EmbeddingQueue();
        }
        return this.instance;
    }


    add(conversationId: string) {
        this.queue.push(conversationId);
    }


    processNext(): string | undefined {
 
        if(this.isProcessing || this.queue.length === 0){
            return;
        }
        this.isProcessing = true;
        const conversationId = this.queue.shift();
        this.isProcessing = false;
        return conversationId;
    }

    isEmpty(): boolean {
        return this.queue.length === 0;
    }

    getQueueLength(): number {
        return this.queue.length;
    }
}