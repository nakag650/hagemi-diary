import { NextResponse } from 'next/server'

const DIFY_API_URL = process.env.DIFY_API_URL
const DIFY_API_KEY = process.env.DIFY_API_KEY

export async function POST(request: Request) {
  try {
    const { message, conversation_id, user_id } = await request.json()

    if (!user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!DIFY_API_URL || !DIFY_API_KEY) {
      throw new Error('DIFY_API_URL or DIFY_API_KEY is not set')
    }

    const response = await fetch(`${DIFY_API_URL}/chat-messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DIFY_API_KEY}`
      },
      body: JSON.stringify({
        inputs: {},
        query: message,
        response_mode: "blocking", // streamingではなくblockingを使用
        conversation_id: conversation_id || "",
        user: user_id,
        files: [] // ファイルは空配列として送信
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Dify API error:', response.status, errorText)
      throw new Error(`Dify API request failed: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error processing chat message:', error)
    if (error instanceof Error) {
      console.error('Error details:', error.message, error.stack)
    }
    return NextResponse.json({ message: 'Internal Server Error', error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
