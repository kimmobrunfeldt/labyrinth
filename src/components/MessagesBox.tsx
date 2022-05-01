import React, { useEffect, useRef } from 'react'
import * as t from 'src/gameTypes'

export type Message = {
  time: Date
  message: string
  options?: t.MessageFormatOptions
}

export function createMessage(
  msg: string,
  opts?: t.MessageFormatOptions
): Message {
  return {
    time: new Date(),
    message: msg,
    options: opts,
  }
}

export const MessageBox = ({ messages }: { messages: Message[] }) => {
  const containerRef = useRef<HTMLDivElement | null>(null)

  const scrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  return (
    <div
      ref={containerRef}
      style={{
        background: '#eee',
        width: '100%',
        padding: '20px 20px',
        fontSize: '12px',
        height: '100%',
        borderRadius: '5px',
        overflow: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {messages.map((msg, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            fontFamily: 'monospace',
            fontWeight: msg.options?.bold ? 'bold' : 'normal',
            lineHeight: 1.1,
          }}
        >
          <div style={{ marginRight: '10px' }}>
            {msg.time.toLocaleTimeString()}
          </div>
          <div>{msg.message}</div>
        </div>
      ))}
    </div>
  )
}
