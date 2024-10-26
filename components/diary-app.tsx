'use client'

import { useEffect, useState } from 'react'
import { createClient, User } from '@supabase/supabase-js'
import { Calendar } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AIChatComponent } from '@/components/ai-chat'

// Supabaseクライアントの初期化
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const formatDateToLocalTimezone = (date: Date): string => {
  return date.toLocaleDateString('en-CA'); // YYYY-MM-DD形式で返す
};

export function DiaryAppComponent() {
  const [user, setUser] = useState<User | null>(null)
  const [diary, setDiary] = useState('')
  const [date, setDate] = useState(new Date())
  const [diaryDates, setDiaryDates] = useState<Date[]>([])
  const [savedDiary, setSavedDiary] = useState('')
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [showDiaryInput, setShowDiaryInput] = useState(false);
  const [aiMessages, setAiMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const [isAIChatInitialized, setIsAIChatInitialized] = useState(false);

  useEffect(() => {
    // ユーザーの認証状態を確認
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      if (user) {
        fetchDiaryDates(user.id, currentMonth)
      }
    })

    // 認証状態の変更を監視
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      const currentUser = session?.user ?? null
      setUser(currentUser)
      if (currentUser) {
        fetchDiaryDates(currentUser.id, currentMonth)
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [currentMonth])

  const fetchDiaryDates = async (userId: string, month: Date) => {
    if (!userId) return
    const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1)
    const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0)
    
    const { data, error } = await supabase
      .from('diaries')
      .select('date')
      .eq('user_id', userId)
      .gte('date', formatDateToLocalTimezone(startOfMonth))
      .lte('date', formatDateToLocalTimezone(endOfMonth))
    
    if (error) {
      console.error('Error fetching diary dates:', error)
    } else if (data) {
      setDiaryDates(data.map(d => new Date(d.date)))
    }
  }

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
    })
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const handleSaveDiary = async () => {
    if (!user) return
    const formattedDate = formatDateToLocalTimezone(date)

    if (diary.trim() === '') {
      // 日記が空の場合、削除の確認を行う
      const confirmDelete = window.confirm(`${formattedDate}の日記を削除してもよろしいですか？`)
      if (confirmDelete) {
        // 削除の処理
        const { error } = await supabase
          .from('diaries')
          .delete()
          .eq('user_id', user.id)
          .eq('date', formattedDate)

        if (error) {
          console.error('Error deleting diary:', error)
          alert('日記の削除中にエラーが発生しました')
        } else {
          fetchDiaryDates(user.id, currentMonth)
          setSavedDiary('')
          alert('日記が削除されました')
        }
      }
    } else {
      // 日記が空でない場合、通常の保存処理
      const { data, error } = await supabase
        .from('diaries')
        .upsert({ 
          user_id: user.id, 
          date: formattedDate, 
          content: diary 
        }, { 
          onConflict: 'user_id,date' 
        })
      if (error) {
        console.error('Error saving diary:', error)
        alert('日記の保存中にエラーが発生しました')
      } else {
        fetchDiaryDates(user.id, currentMonth)
        alert('日記が保存されました')
      }
    }
  }

  const handleDateChange = async (newDate: Date) => {
    setDate(newDate)
    if (user) {
      const formattedDate = formatDateToLocalTimezone(newDate)
      const { data, error } = await supabase
        .from('diaries')
        .select('content')
        .eq('user_id', user.id)
        .eq('date', formattedDate)
        .maybeSingle()

      if (error) {
        console.error('Error fetching diary:', error)
        setSavedDiary('')
        setDiary('')
      } else if (data) {
        setSavedDiary(data.content)
        setDiary(data.content)
      } else {
        setSavedDiary('')
        setDiary('')
      }
    }
  }

  const handleMakeDiary = (messages: { role: 'user' | 'assistant', content: string }[]) => {
    const diaryContent = messages
      .filter(msg => msg.role === 'assistant')
      .map(msg => {
        const match = msg.content.match(/<diary_entry>([\s\S]*?)<\/diary_entry>/);
        return match ? match[1].trim() : '';
      })
      .filter(entry => entry !== '') // 空のエントリーを除外
      .join('\n\n')
      .trim(); // 最終的な文字列の前後の空白を削除

    if (diaryContent) {
      setDiary(diaryContent);
      setShowDiaryInput(true);
    } else {
      // 日記の内容が空の場合の処理
      alert('有効な日記エントリーが見つかりませんでした。');
      setShowDiaryInput(false);
    }
  };

  const initializeAIChat = async () => {
    if (isAIChatInitialized) return;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          message: 'こんにちは', 
          conversation_id: null,
          user_id: user!.id
        })
      });

      if (!response.ok) {
        throw new Error('Failed to initialize AI chat');
      }

      const data = await response.json();
      const cleanedAnswer = removeAssistantTags(data.answer);
      setAiMessages([
        { role: 'user', content: 'こんにちは' },
        { role: 'assistant', content: cleanedAnswer }
      ]);
      setIsAIChatInitialized(true);
    } catch (error) {
      console.error('Error initializing AI chat:', error);
    }
  };

  const removeAssistantTags = (content: string) => {
    return content.replace(/<assistant>([\s\S]*?)<\/assistant>/g, '$1').trim();
  };

  useEffect(() => {
    if (user && !isAIChatInitialized) {
      initializeAIChat();
    }
  }, [user, isAIChatInitialized]);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-xl md:text-2xl font-bold mb-4 leading-tight">日々励み続ける人のための日記支援アプリ：AIとの簡単な会話で三行日記が生成されます</h1>
      {user ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="col-span-1">
            <AIChatComponent 
              user={user} 
              onMakeDiary={handleMakeDiary} 
              initialMessages={aiMessages}
              isInitialized={isAIChatInitialized}
              initializeChat={initializeAIChat}
            />
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>カレンダー</CardTitle>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={date}
                onSelect={(newDate: Date | undefined) => newDate && handleDateChange(newDate)}
                onMonthChange={(newMonth: Date) => {
                  setCurrentMonth(newMonth)
                  if (user) fetchDiaryDates(user.id, newMonth)
                }}
                className="rounded-md border"
                modifiers={{
                  hasDiary: (date: Date) => diaryDates.some(d => d.toDateString() === date.toDateString())
                }}
                modifiersStyles={{
                  hasDiary: { backgroundColor: 'lightblue' }
                }}
              />
            </CardContent>
          </Card>
          
          {showDiaryInput && (
            <Card className="col-span-1 md:col-span-2">
              <CardHeader>
                <CardTitle>日記を書く</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={diary}
                  onChange={(e) => setDiary(e.target.value)}
                  placeholder="今日の3行日記を書いてください"
                  rows={3}
                  className="mb-4"
                />
                <Button onClick={handleSaveDiary}>保存</Button>
              </CardContent>
            </Card>
          )}
          
          {savedDiary && (
            <Card className="col-span-1 md:col-span-2">
              <CardHeader>
                <CardTitle>{date.toLocaleDateString()} の日記</CardTitle>
              </CardHeader>
              <CardContent>
                <p>{savedDiary}</p>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Button onClick={handleLogin}>Googleでログイン</Button>
      )}
      {user && <Button onClick={handleLogout} className="mt-4">ログアウト</Button>}
    </div>
  );
}
