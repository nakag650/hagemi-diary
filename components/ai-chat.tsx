'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { User } from '@supabase/supabase-js'

interface AIChatComponentProps {
  user: User
}

export function AIChatComponent({ user }: AIChatComponentProps) {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)

  const handleSendMessage = async () => {
    if (!input.trim()) return

    setIsLoading(true)
    const userMessage = { role: 'user' as const, content: input }
    setMessages(prev => [...prev, userMessage])

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          message: input, 
          conversation_id: conversationId,
          user_id: user.id  // ユーザーIDを送信
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`API request failed: ${errorData.message || response.statusText}`)
      }

      const data = await response.json()
      setConversationId(data.conversation_id)
      const assistantMessage = { role: 'assistant' as const, content: data.answer }
      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Error sending message:', error)
      alert(`メッセージの送信中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setIsLoading(false)
      setInput('')
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>AIチャット</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 mb-4">
          {messages.map((message, index) => (
            <div key={index} className={`p-2 rounded-lg ${message.role === 'user' ? 'bg-blue-100 text-right' : 'bg-gray-100'}`}>
              {message.content}
            </div>
          ))}
        </div>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="メッセージを入力..."
          className="mb-2"
        />
        <Button onClick={handleSendMessage} disabled={isLoading}>
          {isLoading ? '送信中...' : '送信'}
        </Button>
      </CardContent>
    </Card>
  )
}
