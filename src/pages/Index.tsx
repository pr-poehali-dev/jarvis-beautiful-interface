import { useState, useEffect, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}
interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

type Message = {
  id: number;
  role: "user" | "jarvis";
  text: string;
  time: string;
};

const JARVIS_RESPONSES: Record<string, string> = {
  volume: "Управление звуком активировано. Текущий уровень: 75%.",
  network: "Все сети в норме. Пинг: 12ms. Безопасных подключений: 3.",
  brightness: "Яркость экрана установлена на оптимальный уровень — 80%.",
  shield: "Протоколы защиты активны. Угроз не обнаружено. Все системы в норме.",
  status: "Все системы функционируют штатно. ЦП: 23%. ОЗУ: 4.2 ГБ.",
  system: "Панель управления системой открыта. Версия ядра: 7.4.1.",
  default: "Принято. Обрабатываю ваш запрос...",
};

const SUGGESTIONS = [
  "Привет, Джарвис",
  "Статус систем",
  "Анализ угроз",
  "Запусти диагностику",
];

export default function Index() {
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [dark, setDark] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark-theme", dark);
  }, [dark]);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const rec = new SpeechRecognition();
      rec.lang = "ru-RU";
      rec.continuous = false;
      rec.interimResults = true;
      recognitionRef.current = rec;
    }
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, thinking]);

  const addMessage = useCallback((role: "user" | "jarvis", text: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        role,
        text,
        time: new Date().toLocaleTimeString("ru-RU", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ]);
  }, []);

  const processCommand = useCallback(
    (text: string) => {
      addMessage("user", text);
      setThinking(true);
      setTimeout(() => {
        const key = Object.keys(JARVIS_RESPONSES).find((k) =>
          text.toLowerCase().includes(k)
        );
        const response = JARVIS_RESPONSES[key || "default"];
        addMessage("jarvis", response);
        setThinking(false);
      }, 1200);
    },
    [addMessage]
  );

  const handleMic = useCallback(() => {
    const rec = recognitionRef.current;

    if (listening) {
      rec?.stop();
      setListening(false);
      setInterimText("");
      return;
    }

    if (!speechSupported || !rec) {
      addMessage(
        "jarvis",
        "Голосовой ввод не поддерживается вашим браузером. Используйте Chrome или Edge."
      );
      return;
    }

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";
      for (let i = e.results.length - 1; i >= 0; i--) {
        if (e.results[i].isFinal) {
          final = e.results[i][0].transcript;
          break;
        } else {
          interim = e.results[i][0].transcript;
        }
      }
      if (interim) setInterimText(interim);
      if (final) {
        setInterimText("");
        setListening(false);
        processCommand(final);
      }
    };

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      setListening(false);
      setInterimText("");
      if (e.error === "not-allowed") {
        addMessage(
          "jarvis",
          "Доступ к микрофону запрещён. Разрешите доступ в настройках браузера."
        );
      } else if (e.error !== "aborted") {
        addMessage("jarvis", `Ошибка распознавания: ${e.error}. Попробуйте ещё раз.`);
      }
    };

    rec.onend = () => {
      setListening(false);
      setInterimText("");
    };

    try {
      rec.start();
      setListening(true);
    } catch {
      addMessage("jarvis", "Не удалось запустить микрофон. Попробуйте ещё раз.");
    }
  }, [listening, speechSupported, addMessage, processCommand]);

  const handleSend = () => {
    if (!input.trim()) return;
    const cmd = input.trim();
    setInput("");
    processCommand(cmd);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSend();
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="chat-root">
      {/* Header */}
      <header className="chat-header">
        <div className="chat-brand">
          <div className="chat-logo">J</div>
          <div>
            <div className="chat-brand-name">Jarvis</div>
            <div className="chat-brand-status">
              <span className="chat-online-dot" />
              {thinking ? "печатает…" : listening ? "слушает…" : "в сети"}
            </div>
          </div>
        </div>
        <button
          className="theme-toggle"
          onClick={() => setDark((d) => !d)}
          title={dark ? "Светлая тема" : "Тёмная тема"}
        >
          <Icon name={dark ? "Sun" : "Moon"} size={18} />
        </button>
      </header>

      {/* Messages */}
      <main className="chat-main" ref={chatRef}>
        <div className="chat-container">
          {isEmpty ? (
            <div className="chat-empty">
              <div className="chat-empty-orb">J</div>
              <h1 className="chat-empty-title">Чем могу помочь?</h1>
              <p className="chat-empty-sub">
                Задайте вопрос голосом или текстом — я слушаю.
              </p>
              <div className="chat-suggestions">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    className="chat-suggestion"
                    onClick={() => processCommand(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((m) => (
                <div key={m.id} className={`msg-row msg-row--${m.role}`}>
                  {m.role === "jarvis" && <div className="msg-avatar">J</div>}
                  <div className="msg-content">
                    <div className={`msg-bubble msg-bubble--${m.role}`}>
                      {m.text}
                    </div>
                    <div className="msg-time">{m.time}</div>
                  </div>
                </div>
              ))}
              {thinking && (
                <div className="msg-row msg-row--jarvis">
                  <div className="msg-avatar">J</div>
                  <div className="msg-content">
                    <div className="msg-bubble msg-bubble--jarvis msg-typing">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Composer */}
      <footer className="chat-composer">
        {interimText && (
          <div className="composer-interim">
            <span className="composer-interim-dot" />«{interimText}»
          </div>
        )}
        <div className="composer-box">
          <input
            className="composer-input"
            placeholder="Сообщение Джарвису…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
          />
          <button
            className={`composer-mic ${listening ? "composer-mic--active" : ""}`}
            onClick={handleMic}
            title="Голосовой ввод"
          >
            <Icon name={listening ? "MicOff" : "Mic"} size={20} />
          </button>
          <button
            className="composer-send"
            onClick={handleSend}
            disabled={!input.trim()}
            title="Отправить"
          >
            <Icon name="ArrowUp" size={20} />
          </button>
        </div>
        <div className="composer-hint">
          {listening
            ? "Говорите… нажмите на микрофон, чтобы остановить"
            : speechSupported
            ? "Джарвис может слышать вашу речь — нажмите на микрофон"
            : "Голосовой ввод недоступен в этом браузере"}
        </div>
      </footer>
    </div>
  );
}