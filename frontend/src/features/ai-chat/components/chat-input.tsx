"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AI_CHAT_MESSAGE_MAX_LENGTH } from "@/lib/constants";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        data-testid="input-chat-message"
        value={value}
        maxLength={AI_CHAT_MESSAGE_MAX_LENGTH}
        placeholder="Nhắn tin, ví dụ: ăn trưa 50k"
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
      />
      <Button data-testid="btn-chat-send" type="submit" disabled={disabled || !value.trim()}>
        Send
      </Button>
    </form>
  );
}
