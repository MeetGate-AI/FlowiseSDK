export interface PredictionData {
    chatflowId: string;
    question: string;
    overrideConfig?: Record<string, any>;
    chatId?: string;
    streaming?: boolean;
    history?: IMessage[];
    uploads?: IFileUpload[];
    leadEmail?: string
    action?: IAction
}

interface IAction {
    id?: string;
    elements?: Array<{
        type: string;
        label: string;
    }>;
    mapping?: {
        approve: string;
        reject: string;
        toolCalls: any[];
    };
}

interface IFileUpload {
    data?: string;
    type: string;
    name: string;
    mime: string;
}

interface IMessage {
    message: string;
    type: MessageType;
    role?: MessageType;
    content?: string;
}

type MessageType = 'apiMessage' | 'userMessage';

export interface StreamResponse {
    event: string;
    data: string;
}

interface FlowiseClientOptions {
    baseUrl?: string;
    apiKey?: string;
}

type PredictionResponseRequest = Record<string, any>;
type PredictionResponseStream = AsyncGenerator<StreamResponse, void, unknown>

export default class FlowiseClient {
    private baseUrl: string;
    private apiKey: string;

    constructor(options: FlowiseClientOptions = {}) {
        this.baseUrl = options.baseUrl || 'http://localhost:3000';
        this.apiKey = options.apiKey || '';
    }

    // Method to create a new prediction and handle streaming response
    async createPredictionRequest(
        data: PredictionData
    ): Promise<PredictionResponseRequest> {
        const { chatflowId } = data;


        const predictionUrl = `${this.baseUrl}/api/v1/prediction/${chatflowId}`;

        const options: any = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        };
        if (this.apiKey) {
            options.headers['Authorization'] = `Bearer ${this.apiKey}`;
        }

        return new Promise<PredictionResponseRequest>((resolve, reject) => {
            try {
                fetch(predictionUrl, options)
                    .then(response => {
                        if (response.ok)
                            return response.json()
                        reject(new Error('Error creating prediction'))
                    })
                    .then(data => {
                        resolve(data as PredictionResponseRequest)
                    }).catch(e => {
                        reject(e)
                    })
            } catch (error) {
                reject(new Error('Error creating prediction'))
            }
        })

    }

    async createPredictionStream(
        data: PredictionData
    ): Promise<PredictionResponseStream> {
        const { chatflowId, streaming } = data;


        const predictionUrl = `${this.baseUrl}/api/v1/prediction/${chatflowId}`;

        const options: any = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        };
        if (this.apiKey) {
            options.headers['Authorization'] = `Bearer ${this.apiKey}`;
        }

        return new Promise<PredictionResponseStream>(async (resolve, reject) => {

            try {
                // Check if chatflow is available to stream
                const chatFlowStreamingUrl = `${this.baseUrl}/api/v1/chatflows-streaming/${chatflowId}`;
                const resp = await fetch(chatFlowStreamingUrl, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });
                const chatFlowStreamingData = await resp.json();
                const isChatFlowAvailableToStream =
                    chatFlowStreamingData.isStreaming || false;
                if (!isChatFlowAvailableToStream) {
                    reject(new Error("Flow is not streamable"))
                    return;
                }
            } catch (error) {
                reject(error)
                return;
            }

            const a = {
                async *[Symbol.asyncIterator]() {
                    const response = await fetch(predictionUrl, options);

                    if (!response.ok) {
                        throw new Error(
                            `HTTP error! status: ${response.status}`
                        );
                    }

                    //@ts-ignore
                    const reader = response.body.getReader();
                    const decoder = new TextDecoder();
                    let buffer = '';

                    try {
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;

                            buffer += decoder.decode(value, { stream: true });
                            const lines = buffer.split('\n');
                            buffer = lines.pop() || '';

                            for (const line of lines) {
                                if (line.trim() === '') continue;
                                if (line.startsWith('data:')) {
                                    const stringifiedJson = line.replace(
                                        'data:',
                                        ''
                                    );
                                    const event = JSON.parse(stringifiedJson);
                                    yield event;
                                }
                            }
                        }
                    } catch(error){
                        throw error
                    }
                    finally {
                        reader.releaseLock();
                    }
                },
            };
            resolve(a as unknown as PredictionResponseStream)


        })
    }
}
