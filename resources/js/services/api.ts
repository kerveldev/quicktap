export type Score = { id: number; player_name: string; score: number; created_at: string }
export type Submission = { submission_id: string; player_name: string; score: number }
async function request<T>(path: string, body?: Submission): Promise<T> {
    const response = await fetch(`/api/${path}`, {
        method: body ? 'POST' : 'GET',
        headers: {
            Accept: 'application/json',
            ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) {
        if (response.status === 429) throw new Error('A little too fast! Please retry in a minute.')
        if (response.status === 422) throw new Error('Check your player name and try again.')
        throw new Error('The leaderboard is unavailable. Please try again shortly.')
    }
    return (await response.json()).data as T
}
export const getLeaderboard = () => request<Score[]>('leaderboard')
export const saveScore = (submission: Submission) => request<Score>('scores', submission)
