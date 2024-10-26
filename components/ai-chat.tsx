'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { User } from '@supabase/supabase-js'

interface AIChatComponentProps {
  user: User
  onMakeDiary: (messages: { role: 'user' | 'assistant', content: string }[]) => void
  initialMessages: { role: 'user' | 'assistant', content: string }[]
  isInitialized: boolean
  initializeChat: () => Promise<void>
}

export function AIChatComponent({ user, onMakeDiary, initialMessages, isInitialized, initializeChat }: AIChatComponentProps) {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>(initialMessages)
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)

  const hasDiaryEntry = useMemo(() => {
    return messages.some(msg => 
      msg.role === 'assistant' && msg.content.includes('<diary_entry>')
    );
  }, [messages]);

  useEffect(() => {
    if (!isInitialized) {
      initializeChat();
    } else {
      setMessages(initialMessages);
    }
  }, [isInitialized, initialMessages, initializeChat]);

  // <assistant>タグのみを削除し、<diary_entry>タグは保持する関数
  const removeAssistantTags = (content: string) => {
    return content.replace(/<assistant>([\s\S]*?)<\/assistant>/g, '$1').trim();
  };

  const handleSendMessage = async (message: string) => {
    setIsLoading(true)
    setMessages(prev => [...prev, { role: 'user', content: message }])

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          message: message, 
          conversation_id: conversationId,
          user_id: user.id
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`API request failed: ${errorData.message || response.statusText}`)
      }

      const data = await response.json()
      setConversationId(data.conversation_id)
      // <assistant>タグのみを削除
      const cleanedAnswer = removeAssistantTags(data.answer);
      setMessages(prev => [...prev, { role: 'assistant', content: cleanedAnswer }])
    } catch (error) {
      console.error('Error sending message:', error)
      alert(`メッセージの送信中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setIsLoading(false)
      setInput('')
    }
  }

  return (
    <Card className="w-full h-full flex flex-col">
      <CardHeader>
        <CardTitle>AIチャット</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col">
        <div className="space-y-4 mb-4 flex-grow overflow-y-auto">
          {messages.map((message, index) => (
            <div key={index} className={`p-2 rounded-lg ${message.role === 'user' ? 'bg-blue-100 text-right' : 'bg-gray-100'}`}>
              {removeAssistantTags(message.content)}
            </div>
          ))}
        </div>
        <div className="mt-auto">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="メッセージを入力..."
            className="mb-2"
            rows={3}
            disabled={!isInitialized || isLoading}
          />
          <div className="flex justify-between items-center">
            <Button 
              onClick={() => handleSendMessage(input)} 
              disabled={!isInitialized || isLoading || input.trim() === ''}
            >
              {isLoading ? '送信中...' : '送信'}
            </Button>
            <Button 
              onClick={() => onMakeDiary(messages)} 
              disabled={!hasDiaryEntry}
            >
              日記にする
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
