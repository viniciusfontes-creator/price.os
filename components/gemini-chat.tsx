"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageCircle, Send, X, Bot, User } from "lucide-react"
import type { IntegratedData } from "@/types"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

export function GeminiChat() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [messages])

  const getSystemContext = async () => {
    try {
      const response = await fetch("/api/dashboard/data", { cache: "no-store" })
      const result = await response.json()

      if (!result.success || !result.data) {
        throw new Error("Falha ao carregar dados")
      }

      const data: IntegratedData[] = result.data
      const totalReservas = data.reduce((sum, item) => sum + item.metricas.totalReservas, 0)
      const totalReceita = data.reduce((sum, item) => sum + item.metricas.receitaTotal, 0)

      // Get unique partners from all reservations
      const partners = new Set<string>()
      data.forEach(item => {
        item.reservas.forEach(r => partners.add(r.partnername))
      })

      const agents = new Set<string>()
      data.forEach(item => {
        item.reservas.forEach(r => agents.add(r.agentname))
      })

      return `Dados atuais do sistema:
- Total de propriedades: ${data.length}
- Total de reservas no período: ${totalReservas}
- Receita total: R$ ${totalReceita.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
- Agentes ativos: ${agents.size}
- Canais de venda: ${partners.size}

Você pode responder perguntas sobre:
- Métricas de vendas e performance
- Rankings de agentes e canais
- Análises de receita e reservas
- Comparações de performance
- Tendências e insights dos dados`
    } catch (error) {
      return "Sistema de análise de dados de reservas e vendas da Qavi (Quarto à Vista)."
    }
  }

  const sendMessage = async () => {
    if (!input.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    const currentInput = input
    setInput("")
    setIsLoading(true)

    try {
      const systemContext = await getSystemContext()

      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: currentInput,
          context: systemContext,
        }),
      })

      if (!response.ok || !response.body) {
        throw new Error("Falha na resposta da API ou corpo da resposta indisponível.")
      }

      const assistantMessageId = (Date.now() + 1).toString();
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, assistantMessage]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamedContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        streamedContent += decoder.decode(value, { stream: true });
        setMessages(prev => prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, content: streamedContent }
            : msg
        ));
      }

    } catch (error) {
      console.error("Erro ao enviar mensagem:", error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          "Desculpe, ocorreu um erro ao processar sua pergunta. Verifique se a chave da API do Gemini está configurada no servidor.",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg"
        size="icon"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
    )
  }

  return (
    <Card className="fixed bottom-6 right-6 w-96 h-[500px] shadow-xl z-50 flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Bot className="h-5 w-5" />
          Chat Qavi AI
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-4 space-y-4">
        <ScrollArea className="flex-1 pr-4" ref={scrollAreaRef}>
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground text-sm">
                Olá! Sou seu assistente de análise de dados da Qavi. Pergunte sobre métricas, rankings ou qualquer
                insight dos dados!
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {message.role === "assistant" && <Bot className="h-6 w-6 mt-1 text-primary flex-shrink-0" />}
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}
                >
                  <div className="whitespace-pre-wrap">{message.content}</div>
                  <div className="text-xs opacity-70 mt-1">
                    {message.timestamp.toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                {message.role === "user" && <User className="h-6 w-6 mt-1 text-muted-foreground flex-shrink-0" />}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-2 justify-start">
                <Bot className="h-6 w-6 mt-1 text-primary flex-shrink-0" />
                <div className="bg-muted rounded-lg px-3 py-2 text-sm">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-current rounded-full animate-bounce" />
                    <div
                      className="w-2 h-2 bg-current rounded-full animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    />
                    <div
                      className="w-2 h-2 bg-current rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex gap-2">
          <Input
            placeholder="Digite sua pergunta..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
          />
          <Button onClick={sendMessage} disabled={!input.trim() || isLoading} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
