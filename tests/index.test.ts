import FlowiseClient from '../src/flowise-sdk';

// Mocking the global fetch API
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('FlowiseClient', () => {
    beforeEach(() => {
        mockFetch.mockClear();
    });

    it('should return a streaming generator when streaming is true', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ isStreaming: true }),
        });

        // Mock the fetch response to simulate streaming behavior
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode('message:\n'));
                controller.enqueue(
                    new TextEncoder().encode(
                        'data:{"event":"token","data":"ol"}\n'
                    )
                );
                controller.enqueue(new TextEncoder().encode('message:\n'));
                controller.enqueue(
                    new TextEncoder().encode(
                        'data:{"event":"token","data":"abilir"}\n'
                    )
                );
                controller.close();
            },
        });

        mockFetch.mockResolvedValueOnce({
            ok: true,
            body: stream,
        });

        const client = new FlowiseClient({
            baseUrl: 'https://flowise.stb.meetgate.ai',
        });
        const result = await client.createPredictionStream({
            chatflowId: 'c4f413b6-640b-41e7-84e2-855bc6567fc1',
            question: 'What is the revenue of Apple?',
            streaming: true,
        });

        const chunks: any = [];
        for await (const chunk of result) {
            chunks.push(chunk);
        }

        expect(chunks).toEqual([
            { event: 'token', data: 'ol' },
            { event: 'token', data: 'abilir' },
        ]);
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should return a full JSON response when streaming is false', async () => {
        const mockJsonResponse = { revenue: '365 billion USD' };

        // Mock the fetch response to simulate non-streaming behavior
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockJsonResponse,
        });

        const client = new FlowiseClient({
            baseUrl: 'https://flowise.stb.meetgate.ai',
        });
        const result = await client.createPredictionRequest({
            chatflowId: 'c4f413b6-640b-41e7-84e2-855bc6567fc1',
            question: 'What is the revenue of Apple?',
            streaming: false,
        });

        expect(result).toEqual(mockJsonResponse);
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should return a full JSON response when streaming is not provided', async () => {
        const mockJsonResponse = { revenue: '365 billion USD' };

        // Mock the fetch response to simulate non-streaming behavior
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockJsonResponse,
        });

        const client = new FlowiseClient({
            baseUrl: 'https://flowise.stb.meetgate.ai',
        });
        const result = await client.createPredictionRequest({
            chatflowId: 'c4f413b6-640b-41e7-84e2-855bc6567fc1',
            question: 'What is the revenue of Apple?',
        });

        expect(result).toEqual(mockJsonResponse);
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should throw an error if the prediction request fails', async () => {
        // Mock the POST request to simulate an error response
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
        });

        const client = new FlowiseClient({
            baseUrl: 'https://flowise.stb.meetgate.ai',
        });

        await expect(
            client.createPredictionRequest({
                chatflowId: 'test-chatflow',
                question: 'What is the revenue of Apple?',
            })
        ).rejects.toThrow('Error creating prediction');

        expect(mockFetch).toHaveBeenCalledTimes(1); // First for chatflow, second for prediction
    });
});
